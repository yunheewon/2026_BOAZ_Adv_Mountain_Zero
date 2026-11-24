"""확인용 그림: 레이아웃 JSON을 그리거나 원본 도면 위에 겹쳐 그린다."""
from __future__ import annotations

import cv2
import numpy as np

from .geometry import object_polygon

COLORS = {"rack": (0, 140, 255), "pillar": (180, 60, 160), "obstacle": (60, 60, 220), "machine": (120, 90, 40),
          "wall": (70, 70, 70), "door": (40, 170, 40), "dock": (0, 120, 0), "aisle": (200, 170, 0),
          "ix": (0, 0, 230), "boundary": (220, 90, 30)}


def draw_layout(layout, canvas=None, pm=None, origin=(0, 0), alpha=0.45):
    """레이아웃 JSON만으로 그림을 그린다. canvas를 주면 그 위에 겹쳐 그린다 (오버레이)."""
    W, H = layout["meta"]["bbox_m"]
    if pm is None:
        pm = 30.0
    if canvas is None:
        pad = 40
        canvas = np.full((int(H * pm) + 2 * pad, int(W * pm) + 2 * pad, 3), 255, np.uint8)
        origin = (pad, pad)
    ox, oy = origin

    def P_(x, y):
        return (int(round(ox + x * pm)), int(round(oy + y * pm)))

    def poly_px(pts):
        return np.array([P_(*p) for p in pts], np.int32)

    base = canvas.copy()
    over = canvas.copy()
    for w in layout.get("walls", []):
        cv2.fillPoly(over, [poly_px(w["polygon"])], COLORS["wall"] if w["kind"] == "exterior" else (110, 110, 110))
    for o in layout.get("objects", []):
        pts = list(object_polygon(o).exterior.coords)[:-1]
        cv2.fillPoly(over, [poly_px(pts)], COLORS[o["type"]])
    for d in layout.get("doors", []):
        hw = d["width"] / 2
        t = layout["meta"].get("wall_thickness_m", 0.3)
        a, b = ((d["cx"] - hw, d["cy"] - t), (d["cx"] + hw, d["cy"] + t)) if d["orientation"] == "horizontal" \
            else ((d["cx"] - t, d["cy"] - hw), (d["cx"] + t, d["cy"] + hw))
        cv2.rectangle(over, P_(*a), P_(*b), COLORS[d["type"]], -1)
    out = cv2.addWeighted(over, alpha, base, 1 - alpha, 0)
    cv2.polylines(out, [poly_px(layout["boundary"]["polygon"])], True, COLORS["boundary"], 2)
    for a in layout.get("aisles", []):
        col = {"shared": COLORS["aisle"], "narrow": (0, 200, 255), "door_link": (40, 170, 40)}.get(a["kind"], COLORS["aisle"])
        cv2.polylines(out, [poly_px(a["centerline"])], False, col, 2)
    for ix in layout.get("intersections", []):
        cv2.circle(out, P_(ix["x"], ix["y"]), max(4, int(0.25 * pm)), COLORS["ix"], -1)
    fs = max(0.35, pm / 80)
    for o in layout.get("objects", []):
        if o["type"] != "pillar":
            cv2.putText(out, o["id"], P_(o["cx"] - min(o["w"], 3) / 2, o["cy"] + 0.2), cv2.FONT_HERSHEY_SIMPLEX,
                        fs, (0, 0, 0), 1, cv2.LINE_AA)
    for d in layout.get("doors", []):
        cv2.putText(out, d["id"], P_(d["cx"] + 0.3, d["cy"] - 0.4), cv2.FONT_HERSHEY_SIMPLEX, fs, (0, 100, 0), 1, cv2.LINE_AA)
    return out
