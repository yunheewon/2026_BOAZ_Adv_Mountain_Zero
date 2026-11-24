"""
인식 결과를 정답(*.gt.json)과 비교해 정확도를 잰다.

사용법 (저장소 루트에서, backend 가상환경 사용):
    python ml/floorplan/evaluate.py                       # data/samples 전체, 건물 가로 길이로 축척
    python ml/floorplan/evaluate.py --scale px_per_m      # 정답 축척(px_per_m)을 그대로 사용
    python ml/floorplan/evaluate.py --detector yolo_obb   # 인식기 바꿔서 비교 (가중치 필요)

결과: 표 출력 + ml/floorplan/data/eval/<detector>_<scale>.json

지표
  외곽 IoU      : 건물 외곽 다각형이 얼마나 겹치는지 (1.0 = 완벽)
  재현율        : 정답 물체 중 찾아낸 비율
  정밀도        : 찾아낸 것 중 진짜인 비율
  중심 오차     : 짝지어진 물체끼리 중심 좌표 차이 (m)
  크기 오차     : 가로·세로 길이 차이 (m)
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[1] / "backend"))
from app.floorplan import floorplan_to_layout  # noqa: E402
from app.floorplan.geometry import object_polygon  # noqa: E402

SAMPLES = ROOT / "data" / "samples"


def match_objects(gt, pr, typ):
    g = [o for o in gt if o["type"] == typ]
    p = [o for o in pr if o["type"] == typ]
    gp = [object_polygon(o) for o in g]
    pp = [object_polygon(o) for o in p]
    pairs, used = [], set()
    cand = []
    for i, a in enumerate(gp):
        for j, b in enumerate(pp):
            inter = a.intersection(b).area
            if inter > 0:
                cand.append((inter / a.union(b).area, i, j))
    used_g = set()
    for iou, i, j in sorted(cand, reverse=True):
        if iou < 0.5 or i in used_g or j in used:
            continue
        used_g.add(i); used.add(j)
        pairs.append((g[i], p[j], iou))
    ce = [np.hypot(a["cx"] - b["cx"], a["cy"] - b["cy"]) for a, b, _ in pairs]
    se = [max(abs(a["w"] - b["w"]), abs(a["h"] - b["h"])) for a, b, _ in pairs]
    return {"gt": len(g), "pred": len(p), "matched": len(pairs),
            "recall": len(pairs) / len(g) if g else 1.0,
            "precision": len(pairs) / len(p) if p else 1.0,
            "center_err_mean": float(np.mean(ce)) if ce else None,
            "center_err_max": float(np.max(ce)) if ce else None,
            "size_err_max": float(np.max(se)) if se else None,
            "iou_mean": float(np.mean([x[2] for x in pairs])) if pairs else None}


def match_doors(gt, pr):
    pairs, used = [], set()
    for a in gt:
        best = None
        for j, b in enumerate(pr):
            if j in used or a["orientation"] != b["orientation"]:
                continue
            d = np.hypot(a["cx"] - b["cx"], a["cy"] - b["cy"])
            if d < 1.0 and (best is None or d < best[0]):
                best = (d, j)
        if best:
            used.add(best[1]); pairs.append((a, pr[best[1]], best[0]))
    return {"gt": len(gt), "pred": len(pr), "matched": len(pairs),
            "recall": len(pairs) / len(gt) if gt else 1.0,
            "precision": len(pairs) / len(pr) if pr else 1.0,
            "center_err_max": float(max(p[2] for p in pairs)) if pairs else None,
            "width_err_max": float(max(abs(a["width"] - b["width"]) for a, b, _ in pairs)) if pairs else None,
            "type_correct": sum(a["type"] == b["type"] for a, b, _ in pairs)}


def evaluate(gt: dict, pr: dict):
    bg, bp = Polygon(gt["boundary"]["polygon"]), Polygon(pr["boundary"]["polygon"])
    iw_g = [Polygon(w["polygon"]) for w in gt.get("walls", []) if w["kind"] == "interior"]
    iw_p = [Polygon(w["polygon"]) for w in pr.get("walls", []) if w["kind"] == "interior" and len(w["polygon"]) >= 3]
    iw_cover = None
    if iw_g:
        from shapely.ops import unary_union
        ug, up = unary_union(iw_g), unary_union(iw_p) if iw_p else Polygon()
        iw_cover = ug.buffer(0.1).intersection(up).area / max(up.area, 1e-9) if iw_p else 0.0
        iw_found = up.intersection(ug.buffer(0.1)).area / ug.area if iw_p else 0.0
    return {
        "file": pr["meta"]["source_file"],
        "scale_method": pr["meta"]["scale"]["method"],
        "scale_err_pct": 100 * abs(pr["meta"]["scale"]["px_per_m"] - gt["meta"]["scale"]["px_per_m"]) / gt["meta"]["scale"]["px_per_m"],
        "boundary_iou": bg.intersection(bp).area / bg.union(bp).area,
        "wall_thickness": [gt["meta"]["wall_thickness_m"], pr["meta"]["wall_thickness_m"]],
        "rack": match_objects(gt["objects"], pr["objects"], "rack"),
        "pillar": match_objects(gt["objects"], pr["objects"], "pillar"),
        "door": match_doors(gt["doors"], pr["doors"]),
        "interior_wall_found": None if not iw_g else round(min(1.0, iw_found), 3),
        "interior_wall_precision": None if not iw_g else round(iw_cover, 3),
        "obstacles_unknown": sum(o["type"] == "obstacle" for o in pr["objects"]),
        "issues": [i["code"] for i in pr.get("issues", [])],
    }


def fmt(x, nd=2):
    return "-" if x is None else (f"{x:.{nd}f}" if isinstance(x, float) else str(x))


def run(detector="rule_based", scale="width"):
    rows = []
    for gt_path in sorted(SAMPLES.glob("*.gt.json")):
        gt = json.loads(gt_path.read_text(encoding="utf-8"))
        img = SAMPLES / gt["meta"]["source_file"]
        if not img.exists():
            continue
        kw = {"width_m": gt["meta"]["bbox_m"][0]} if scale == "width" else \
             {"px_per_m": gt["meta"]["scale"]["px_per_m"]}
        pr = floorplan_to_layout(img, detector=detector, **kw).layout
        rows.append(evaluate(gt, pr))
    print("| 도면 | 축척 오차 | 외곽 IoU | 선반 찾음 | 선반 중심오차(최대) | 기둥 찾음 | 출입구 찾음 | 출입구 위치오차(최대) | 칸막이벽 |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        print(f"| {r['file']} | {r['scale_err_pct']:.2f}% | {r['boundary_iou']:.3f} "
              f"| {r['rack']['matched']}/{r['rack']['gt']} (오탐 {r['rack']['pred'] - r['rack']['matched']}) "
              f"| {fmt(r['rack']['center_err_max'], 3)}m "
              f"| {r['pillar']['matched']}/{r['pillar']['gt']} (오탐 {r['pillar']['pred'] - r['pillar']['matched']}) "
              f"| {r['door']['matched']}/{r['door']['gt']} (오탐 {r['door']['pred'] - r['door']['matched']}) "
              f"| {fmt(r['door']['center_err_max'], 3)}m "
              f"| {fmt(r['interior_wall_found'])} |")
    out = ROOT / "data" / "eval"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{detector}_{scale}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1),
                                                   encoding="utf-8")
    return rows


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--detector", default="rule_based")
    ap.add_argument("--scale", default="width", choices=["width", "px_per_m"])
    a = ap.parse_args()
    run(a.detector, a.scale)
