"""여러 모듈이 함께 쓰는 기하 도우미."""
from __future__ import annotations

import math

import cv2
import numpy as np
from shapely import affinity
from shapely.geometry import Polygon, box


def rect_params(cnt):
    (cx, cy), (w, h), _ = cv2.minAreaRect(cnt)
    box = cv2.boxPoints(cv2.minAreaRect(cnt))
    e1, e2 = box[1] - box[0], box[2] - box[1]
    long_e = e1 if np.linalg.norm(e1) >= np.linalg.norm(e2) else e2
    theta = math.degrees(math.atan2(long_e[1], long_e[0]))
    theta = (theta + 90) % 180 - 90                       # [-90, 90)
    wl, ws = max(w, h), min(w, h)
    if abs(theta) <= 45:
        return cx, cy, wl, ws, theta
    return cx, cy, ws, wl, theta - 90 if theta > 0 else theta + 90


def snap(v, s):
    return round(round(v / s) * s, 3)


def object_polygon(o: dict) -> Polygon:
    if o.get("polygon"):
        return Polygon(o["polygon"])
    r = box(o["cx"] - o["w"] / 2, o["cy"] - o["h"] / 2, o["cx"] + o["w"] / 2, o["cy"] + o["h"] / 2)
    rot = o.get("rotation_deg", 0) or 0
    return affinity.rotate(r, rot, origin=(o["cx"], o["cy"])) if rot else r


def door_polygon(d: dict, depth: float) -> Polygon:
    if d["orientation"] == "horizontal":
        return box(d["cx"] - d["width"] / 2, d["cy"] - depth / 2, d["cx"] + d["width"] / 2, d["cy"] + depth / 2)
    return box(d["cx"] - depth / 2, d["cy"] - d["width"] / 2, d["cx"] + depth / 2, d["cy"] + d["width"] / 2)
