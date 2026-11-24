"""④ 정리: 픽셀 결과 → 미터 단위 레이아웃 JSON 초안 (격자 정렬, 확신도 표시)."""
from __future__ import annotations

from datetime import datetime, timezone

import cv2
import numpy as np

from .config import P
from .geometry import snap
from .structure import outline_polygon


def to_layout(det, pm, x0, y0, scale_method, name, source, deskew, M):
    sn = P["snap_m"]

    def m(px, py):
        return ((px - x0) / pm, (py - y0) / pm)

    fp_poly = outline_polygon(det["fp"], pm)
    boundary = [[snap((x - x0) / pm, sn), snap((y - y0) / pm, sn)] for x, y in fp_poly]
    W = max(p[0] for p in boundary)
    H = max(p[1] for p in boundary)

    walls = []
    cnts, _ = cv2.findContours(det["walls"], cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    k = 0
    for c in cnts:
        if cv2.contourArea(c) < 0.05 * pm * pm:
            continue
        poly = cv2.approxPolyDP(c, 0.05 * pm, True).reshape(-1, 2)
        if len(poly) < 3:
            continue
        k += 1
        walls.append({"id": f"wall_{k:02d}", "kind": "exterior",
                      "polygon": [[round(m(*p)[0], 3), round(m(*p)[1], 3)] for p in poly]})
    for poly in det["partitions"]:
        if len(poly) < 3:
            continue
        k += 1
        walls.append({"id": f"wall_{k:02d}", "kind": "interior",
                      "polygon": [[round(m(*p)[0], 3), round(m(*p)[1], 3)] for p in poly]})

    objects, issues = [], []
    counters = {}
    for o in sorted(det["objs"], key=lambda o: (o["type"], round(o["cy"] / pm), o["cx"])):
        counters[o["type"]] = counters.get(o["type"], 0) + 1
        oid = f"{o['type']}_{counters[o['type']]:02d}"
        cx, cy = m(o["cx"], o["cy"])
        w, h, rot = o["w"] / pm, o["h"] / pm, o["rot"]
        if abs(rot) < P["angle_snap_deg"]:
            rot = 0.0
            x_lo, x_hi = snap(cx - w / 2, sn), snap(cx + w / 2, sn)
            y_lo, y_hi = snap(cy - h / 2, sn), snap(cy + h / 2, sn)
            cx, cy, w, h = (x_lo + x_hi) / 2, (y_lo + y_hi) / 2, x_hi - x_lo, y_hi - y_lo
        obj = {"id": oid, "type": o["type"], "cx": round(cx, 3), "cy": round(cy, 3),
               "w": round(w, 3), "h": round(h, 3), "rotation_deg": round(rot, 1),
               "confidence": round(o["conf"], 2), "source": "cv", "movable": o["type"] != "pillar"}
        if "poly" in o:
            obj["polygon"] = [[round(m(*p)[0], 3), round(m(*p)[1], 3)] for p in o["poly"]]
        if o["conf"] < 0.6:
            issues.append({"level": "info", "code": "LOW_CONFIDENCE",
                           "message": f"{oid}의 모양이 사각형이 아니라 종류를 확신하기 어렵습니다. 확인해 주세요.",
                           "target_ids": [oid]})
        objects.append(obj)

    t_m = det["t_px"] / pm
    doors = []
    for i, d in enumerate(sorted(det["doors"], key=lambda d: (d["cy"], d["cx"]))):
        cx, cy = m(d["cx"], d["cy"])
        doors.append({"id": f"door_{i + 1:02d}", "type": "dock" if d["width"] >= P["door_dock_m"] else "door",
                      "cx": snap(cx, sn / 2), "cy": snap(cy, sn / 2), "width": snap(d["width"], sn),
                      "orientation": d["orientation"]})
    if scale_method == "assumed_wall":
        issues.insert(0, {"level": "warning", "code": "SCALE_ASSUMED",
                          "message": f"축척 정보가 없어 외벽 두께를 {P['assumed_wall_m']}m로 가정했습니다. "
                                     f"실제 길이 하나를 입력하면 정확해집니다.", "target_ids": []})
    return {
        "schema_version": "0.1",
        "meta": {
            "name": name, "source_file": source, "created_by": "floorplan2layout",
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "bbox_m": [round(W, 3), round(H, 3)],
            "scale": {"px_per_m": round(float(pm), 3), "method": scale_method},
            "wall_thickness_m": round(t_m, 3),
            "image_transform": {"deskew_deg": round(deskew, 3), "rotation_matrix": np.round(M, 6).tolist(),
                                "origin_px": [round(x0, 1), round(y0, 1)], "px_per_m": round(float(pm), 3),
                                "note": "원본 픽셀 p → 보정 픽셀 q = M·[p,1] → 레이아웃 m = (q - origin_px)/px_per_m"},
        },
        "boundary": {"polygon": boundary},
        "walls": walls,
        "objects": objects,
        "doors": doors,
        "issues": issues,
    }
