"""도면 → 레이아웃 전체 흐름을 묶는다.

    ① preprocess.standardize     도면 파일 → 기울기 보정된 이미지
    ② structure.extract_structure 외곽·벽·출입구·칸막이벽 + 물체 후보 마스크
    ③ detectors.get_detector     물체 인식 (rule_based / yolo_obb)
    ④ postprocess.to_layout      픽셀 → m, 격자 정렬 → 레이아웃 JSON 초안
    ⑤ analysis.analyze_layout    통로망·교차로·격자·자동 검사
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .analysis import analyze_layout
from .config import P
from .detectors import get_detector
from .postprocess import to_layout
from .preprocess import standardize
from .structure import extract_structure


@dataclass
class PipelineResult:
    layout: dict            # 레이아웃 JSON (dict)
    image: np.ndarray       # 기울기 보정된 도면 이미지 (확인용 그림에 사용)
    origin_px: tuple        # 레이아웃 (0,0)이 이미지에서 어디인지 (x0, y0)
    px_per_m: float


def resolve_scale(img: np.ndarray, px_per_m=None, width_m=None, two_point=None) -> tuple[float, str]:
    """축척 정하기. 셋 중 하나를 주면 되고, 아무것도 없으면 외벽 두께를 0.3m로 가정한다.

    px_per_m  : 도면 1m가 몇 픽셀인지
    width_m   : 건물 외곽 가로 길이(m)
    two_point : (x1, y1, x2, y2, 실제길이m)  원본 이미지 픽셀 좌표
    """
    if px_per_m:
        return float(px_per_m), "px_per_m"
    if two_point:
        x1, y1, x2, y2, length = two_point
        return math.hypot(x2 - x1, y2 - y1) / length, "two_point"
    # 임시 축척으로 한 번 돌려 건물 크기/벽 두께를 잰다
    s0 = extract_structure(img, 0.7 * img.shape[1] / 40.0)
    if width_m:
        xs = np.where(s0["fp"].any(0))[0]
        return (xs[-1] - xs[0] + 1) / width_m, "building_width"
    return s0["t_px"] / P["assumed_wall_m"], "assumed_wall"


def floorplan_to_layout(path: str | Path, px_per_m=None, width_m=None, two_point=None,
                        detector: str = "rule_based", detector_kwargs: dict | None = None,
                        name: str | None = None, **analysis_opts) -> PipelineResult:
    """도면 파일 → 레이아웃. analysis_opts는 analysis.DEFAULTS 값을 덮어쓴다 (예: cell_m=0.25)."""
    path = Path(path)
    img, M, deskew = standardize(path)
    pm, method = resolve_scale(img, px_per_m, width_m, two_point)

    s = extract_structure(img, pm)
    dets = get_detector(detector, **(detector_kwargs or {})).detect(img, s["object_mask"], pm)

    ys, xs = np.where(s["fp"])
    x0, y0 = float(xs.min()), float(ys.min())
    det = dict(s, objs=[d.as_dict() for d in dets])
    layout = to_layout(det, pm, x0, y0, method, name or path.stem, path.name, deskew, M)
    layout["meta"]["detector"] = detector
    layout = analyze_layout(layout, **analysis_opts)
    return PipelineResult(layout=layout, image=img, origin_px=(x0, y0), px_per_m=pm)
