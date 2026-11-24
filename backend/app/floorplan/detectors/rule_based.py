"""규칙 기반 인식기: 덩어리의 크기·모양으로 선반 / 기둥 / 기타 장애물을 나눈다.

학습 데이터가 필요 없다. 메인 인식기(YOLO-OBB)의 비교 기준선이자, 실패 시 대체용이다.
"""
from __future__ import annotations

import cv2
import numpy as np

from ..config import P
from ..geometry import rect_params
from .base import Detection, Detector


class RuleBasedDetector(Detector):
    name = "rule_based"

    def detect(self, image: np.ndarray, object_mask: np.ndarray, px_per_m: float) -> list[Detection]:
        return [_to_detection(o) for o in classify_objects(object_mask, px_per_m)]


def _to_detection(o: dict) -> Detection:
    extra = {"shape": o["shape"]} if "shape" in o else {}
    return Detection(type=o["type"], cx=o["cx"], cy=o["cy"], w=o["w"], h=o["h"], rot=o["rot"],
                     conf=o["conf"], poly=o.get("poly"), extra=extra)


def classify_objects(inner, pm):
    """inner: 칸막이벽을 뺀 물체 후보 마스크 → 물체 목록 (픽셀 단위 dict)"""
    n, cc, st, _ = cv2.connectedComponentsWithStats(inner, connectivity=8)
    objs = []
    for i in range(1, n):
        area_px = st[i, cv2.CC_STAT_AREA]
        if area_px < P["min_object_m2"] * pm * pm:
            continue
        x, y, w, h = st[i, :4]
        sub = (cc[y:y + h, x:x + w] == i).astype(np.uint8)
        cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnt = max(cnts, key=cv2.contourArea) + np.array([x, y])
        cx, cy, ow, oh, rot = rect_params(cnt)
        rect_area = ow * oh
        rectangularity = area_px / rect_area if rect_area else 0
        long_side, short_side = max(ow, oh) / pm, min(ow, oh) / pm
        hull_area = cv2.contourArea(cv2.convexHull(cnt))
        solidity = area_px / hull_area if hull_area else 0
        small_compact = (long_side <= P["pillar_max_m"] and long_side / max(short_side, 1e-6) < 1.3
                         and short_side >= P["pillar_min_m"])
        if small_compact and solidity > 0.9 and rectangularity < 0.85:   # 원형·팔각 기둥
            d = (ow + oh) / 2
            objs.append(dict(type="pillar", cx=cx, cy=cy, w=d, h=d, rot=0.0, conf=0.85, shape="round"))
            continue
        if rectangularity >= 0.85:
            if long_side <= P["pillar_max_m"] and long_side / max(short_side, 1e-6) < 1.8:
                if short_side < P["pillar_min_m"]:
                    continue
                typ = "pillar"
            else:
                typ = "rack"
            conf = float(min(1.0, (rectangularity - 0.85) / 0.12 * 0.3 + 0.7))
            objs.append(dict(type=typ, cx=cx, cy=cy, w=ow, h=oh, rot=rot, conf=conf))
        else:
            poly = cv2.approxPolyDP(cnt, 0.1 * pm, True).reshape(-1, 2).astype(float)
            objs.append(dict(type="obstacle", cx=cx, cy=cy, w=ow, h=oh, rot=rot, conf=0.4, poly=poly))
    return objs
