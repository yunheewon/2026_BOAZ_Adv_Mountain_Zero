"""도면 → 레이아웃 테스트. 정답(gt.json)이 있는 테스트 도면으로 정확도를 확인한다.

실행 (backend 폴더에서):  python -m pytest -q
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from shapely.geometry import Polygon

from app.floorplan import floorplan_to_layout
from app.main import app

FIX = Path(__file__).parent / "fixtures" / "floorplans"
CASES = [("plan_A.png", 40.0), ("plan_B.png", 50.0), ("plan_C_color.png", 36.0)]
client = TestClient(app)


def _gt(name: str) -> dict:
    return json.loads((FIX / f"{name.replace('.', '_')}.gt.json").read_text(encoding="utf-8"))


def _match(gt_objs, pr_objs, tol_m):
    """같은 종류끼리 중심이 tol_m 안에 있으면 짝. 반환: (짝 수, 최대 중심 오차)"""
    used, errs = set(), []
    for g in gt_objs:
        best = None
        for j, p in enumerate(pr_objs):
            if j in used or p["type"] != g["type"]:
                continue
            d = math.hypot(g["cx"] - p["cx"], g["cy"] - p["cy"])
            if d <= tol_m and (best is None or d < best[0]):
                best = (d, j)
        if best:
            used.add(best[1])
            errs.append(best[0])
    return len(errs), max(errs, default=0.0)


@pytest.fixture(scope="module")
def results():
    return {name: floorplan_to_layout(FIX / name, width_m=w).layout for name, w in CASES}


@pytest.mark.parametrize("name", [c[0] for c in CASES])
def test_recognition_accuracy(results, name):
    L, G = results[name], _gt(name)
    bg, bp = Polygon(G["boundary"]["polygon"]), Polygon(L["boundary"]["polygon"])
    assert bg.intersection(bp).area / bg.union(bp).area > 0.99

    for typ in ("rack", "pillar"):
        gt = [o for o in G["objects"] if o["type"] == typ]
        pr = [o for o in L["objects"] if o["type"] == typ]
        matched, max_err = _match(gt, pr, tol_m=0.5)
        assert matched == len(gt) == len(pr), f"{typ}: 정답 {len(gt)}, 인식 {len(pr)}, 짝 {matched}"
        assert max_err < 0.15, f"{typ} 최대 중심 오차 {max_err:.3f}m"

    assert len(L["doors"]) == len(G["doors"])


@pytest.mark.parametrize("name", [c[0] for c in CASES])
def test_every_door_connected_to_aisles(results, name):
    L = results[name]
    linked = {e.get("door_id") for e in L["endpoints"] if e.get("kind") == "door"}
    assert linked == {d["id"] for d in L["doors"]}
    assert not [i for i in L["issues"] if i["code"] in ("UNREACHABLE_AREA", "NO_DOOR")]


def test_pdf_input(tmp_path):
    import pymupdf

    doc = pymupdf.open()
    page = doc.new_page(width=1000, height=700)
    page.insert_image(page.rect, filename=str(FIX / "plan_B.png"))
    pdf = tmp_path / "plan_B.pdf"
    doc.save(pdf)
    L = floorplan_to_layout(pdf, width_m=50).layout
    assert sum(o["type"] == "rack" for o in L["objects"]) == 10


def test_api_upload_returns_layout_and_overlay():
    with open(FIX / "plan_A.png", "rb") as f:
        r = client.post("/api/v1/floorplans", files={"file": ("plan_A.png", f, "image/png")},
                        data={"width_m": "40"})
    assert r.status_code == 200
    body = r.json()
    assert body["layout"]["meta"]["source_file"] == "plan_A.png"
    assert len(body["layout"]["objects"]) == 12
    assert body["overlay_png_base64"]


def test_api_rejects_bad_input():
    r = client.post("/api/v1/floorplans", files={"file": ("x.txt", b"hi", "text/plain")})
    assert r.status_code == 400
    with open(FIX / "plan_A.png", "rb") as f:
        r = client.post("/api/v1/floorplans", files={"file": ("plan_A.png", f, "image/png")},
                        data={"width_m": "40", "two_point": "1,2,3"})
    assert r.status_code == 400


def test_yolo_without_weights_is_reported():
    with open(FIX / "plan_A.png", "rb") as f:
        r = client.post("/api/v1/floorplans", files={"file": ("plan_A.png", f, "image/png")},
                        data={"width_m": "40", "detector": "yolo_obb", "with_overlay": "false"})
    assert r.status_code == 422
    assert "가중치" in r.json()["detail"]


def test_api_reanalyze_after_edit(results):
    layout = json.loads(json.dumps(results["plan_B.png"]))
    rack = next(o for o in layout["objects"] if o["id"] == "rack_01")
    rack["cy"] += 2.4  # 아래 선반 쪽으로 옮겨 통로를 좁힘
    r = client.post("/api/v1/layouts/analyze", json=layout)
    assert r.status_code == 200
    codes = {i["code"] for i in r.json()["issues"]}
    assert codes & {"NARROW_AISLE", "OBJECT_OVERLAP"}
