"""명령줄에서 도면 한 장 돌려보기 (backend 폴더에서 실행).

    python -m app.floorplan.cli 도면.png --width-m 40
    python -m app.floorplan.cli 도면.pdf --px-per-m 40 --out out
    python -m app.floorplan.cli 도면.jpg --two-point 240,1240,1840,1240,40

out 폴더에 *.layout.json, *.overlay.png(원본 위 겹침), *.render.png(JSON만으로 그린 그림) 저장.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2

from .pipeline import floorplan_to_layout
from .render import draw_layout


def save_outputs(res, out_dir: str | Path) -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    layout = res.layout
    stem = Path(layout["meta"]["source_file"]).name.replace(".", "_")
    path = out_dir / f"{stem}.layout.json"
    path.write_text(json.dumps(layout, ensure_ascii=False, indent=1), encoding="utf-8")
    img = res.image if res.image.ndim == 3 else cv2.cvtColor(res.image, cv2.COLOR_GRAY2BGR)
    over = draw_layout(layout, img.copy(), res.px_per_m, res.origin_px)
    cv2.imencode(".png", over)[1].tofile(str(out_dir / f"{stem}.overlay.png"))
    cv2.imencode(".png", draw_layout(layout, pm=25))[1].tofile(str(out_dir / f"{stem}.render.png"))
    return path


def main(argv=None):
    ap = argparse.ArgumentParser(description="도면 이미지 → FORKSIGHT 레이아웃 JSON")
    ap.add_argument("input")
    ap.add_argument("--px-per-m", type=float)
    ap.add_argument("--width-m", type=float, help="건물 외곽 가로 길이(m)")
    ap.add_argument("--two-point", type=str, help="x1,y1,x2,y2,길이m")
    ap.add_argument("--detector", default="rule_based", choices=["rule_based", "yolo_obb"])
    ap.add_argument("--cell", type=float, default=0.25, help="점유 격자 칸 크기(m)")
    ap.add_argument("--out", default="out")
    a = ap.parse_args(argv)
    tp = tuple(float(v) for v in a.two_point.split(",")) if a.two_point else None
    res = floorplan_to_layout(a.input, a.px_per_m, a.width_m, tp, detector=a.detector, cell_m=a.cell)
    path = save_outputs(res, a.out)
    L = res.layout
    n = {t: sum(o["type"] == t for o in L["objects"]) for t in ("rack", "pillar", "machine", "obstacle")}
    print(f"{path}\n  축척 {L['meta']['scale']}  |  선반 {n['rack']} 기둥 {n['pillar']} 설비 {n['machine']} "
          f"기타 {n['obstacle']}  |  출입구 {len(L['doors'])}  |  통로 {len(L['aisles'])} "
          f"교차로 {len(L['intersections'])}  |  검사 {len(L['issues'])}건")


if __name__ == "__main__":
    main()
