"""도면 → 레이아웃 API.

POST /api/v1/floorplans          도면 업로드 + 축척 → 레이아웃 초안 + 확인용 겹침 그림(base64 PNG)
POST /api/v1/layouts/analyze     (편집기에서 고친) 레이아웃 → 통로망·격자·경고 다시 계산
"""
from __future__ import annotations

import base64
import tempfile
from pathlib import Path

import cv2
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .analysis import analyze_layout
from .pipeline import floorplan_to_layout
from .render import draw_layout
from .schemas import FloorplanResponse, Layout

router = APIRouter(prefix="/api/v1", tags=["floorplan"])

ALLOWED = {".png", ".jpg", ".jpeg", ".pdf", ".bmp", ".tif", ".tiff"}
DETECTORS = {"rule_based", "yolo_obb"}


def _parse_two_point(text: str | None):
    if not text:
        return None
    try:
        vals = tuple(float(v) for v in text.split(","))
    except ValueError:
        vals = ()
    if len(vals) != 5 or vals[4] <= 0:
        raise HTTPException(400, "two_point 형식: x1,y1,x2,y2,길이m")
    return vals


@router.post("/floorplans", response_model=FloorplanResponse)
async def create_from_floorplan(
    file: UploadFile = File(..., description="도면 이미지(PNG/JPG/PDF)"),
    px_per_m: float | None = Form(None, description="도면 1m가 몇 픽셀인지"),
    width_m: float | None = Form(None, description="건물 외곽 가로 길이(m)"),
    two_point: str | None = Form(None, description="x1,y1,x2,y2,실제길이m (원본 이미지 픽셀 좌표)"),
    detector: str = Form("rule_based", description="물체 인식기: rule_based / yolo_obb"),
    cell_m: float = Form(0.25, description="점유 격자 칸 크기(m)"),
    with_overlay: bool = Form(True),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED:
        raise HTTPException(400, f"지원하지 않는 형식입니다: {suffix}")
    if detector not in DETECTORS:
        raise HTTPException(400, f"detector는 {sorted(DETECTORS)} 중 하나")
    tp = _parse_two_point(two_point)
    with tempfile.TemporaryDirectory() as td:
        path = Path(td) / f"upload{suffix}"
        path.write_bytes(await file.read())
        try:
            res = floorplan_to_layout(path, px_per_m=px_per_m, width_m=width_m, two_point=tp,
                                      detector=detector, name=Path(file.filename).stem, cell_m=cell_m)
        except (ValueError, RuntimeError, NotImplementedError) as e:
            raise HTTPException(422, str(e)) from e
    res.layout["meta"]["source_file"] = file.filename
    overlay = None
    if with_overlay:
        img = res.image if res.image.ndim == 3 else cv2.cvtColor(res.image, cv2.COLOR_GRAY2BGR)
        ok, buf = cv2.imencode(".png", draw_layout(res.layout, img.copy(), res.px_per_m, res.origin_px))
        overlay = base64.b64encode(buf.tobytes()).decode() if ok else None
    return FloorplanResponse(layout=res.layout, overlay_png_base64=overlay)


@router.post("/layouts/analyze")
async def analyze(layout: Layout, cell_m: float = 0.25) -> dict:
    """기하 정보(boundary/walls/objects/doors)만 있으면 된다. 기존 분석 결과는 버리고 새로 계산."""
    data = layout.model_dump(exclude_none=True)
    for key in ("aisles", "intersections", "endpoints", "grid"):
        data.pop(key, None)
    data["issues"] = [i for i in data.get("issues", []) if i.get("code") == "SCALE_ASSUMED"]
    return analyze_layout(data, cell_m=cell_m)
