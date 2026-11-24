"""
합성 창고 도면 생성기 v1 (정답 레이아웃을 알고 있는 테스트 도면).

정답 레이아웃(미터 단위)을 먼저 정하고, 그걸 CAD 도면처럼 그린 이미지를 만든다.
그래서 인식 결과를 정답과 비교해 정확도를 잴 수 있다.

일부러 넣은 방해 요소: 치수선, 글자(한글/영문), 문 열림 호, 선반 칸막이선·X 해칭,
도면 표제란, 방위표, 이중선 벽, 선반이 벽에 붙은 경우, 스캔 잡음·기울기, 컬러·검은 배경.

사용법 (저장소 루트에서):
    python ml/floorplan/synth/make_test_plans.py
    → ml/floorplan/data/samples/ 에 PNG/JPG/PDF + 정답 JSON(*.gt.json) 저장

다음 단계(2주차): 스타일 1,000가지 이상 무작위화 + 원본 배치 ID 기록 + YOLO-OBB 라벨 출력
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from shapely import affinity
from shapely.geometry import Polygon, box

OUT = Path(__file__).resolve().parents[1] / "data" / "samples"

# 운영체제별 글꼴 후보 (처음 찾은 것을 사용)
FONT_EN_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]
FONT_KR_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "C:/Windows/Fonts/malgun.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
]


def _first_existing(paths):
    return next((p for p in paths if Path(p).exists()), None)


FONT_EN = _first_existing(FONT_EN_CANDIDATES)
FONT_KR = _first_existing(FONT_KR_CANDIDATES) or FONT_EN


def font(path, px):
    size = max(8, int(px))
    if path:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default(size)


class Plan:
    """미터 좌표로 그리면 픽셀로 바꿔 그려주는 도우미."""

    def __init__(self, bbox_m, s=40, margin_m=6.0):
        self.s = s
        self.m = margin_m * s
        w = int(bbox_m[0] * s + 2 * self.m + 10 * s)  # 오른쪽에 표제란 공간
        h = int(bbox_m[1] * s + 2 * self.m)
        self.img = Image.new("L", (w, h), 255)
        self.d = ImageDraw.Draw(self.img)
        self.lw = max(1, round(s / 20))  # 얇은 선 두께 (px)

    def p(self, x, y):
        return (self.m + x * self.s, self.m + y * self.s)

    def poly_fill(self, coords, fill=0):
        self.d.polygon([self.p(*c) for c in coords], fill=fill)

    def poly_line(self, coords, width=None, fill=0, closed=True):
        pts = [self.p(*c) for c in coords]
        if closed:
            pts = pts + [pts[0]]
        self.d.line(pts, fill=fill, width=width or self.lw, joint="curve")

    def line(self, a, b, width=None, fill=0):
        self.d.line([self.p(*a), self.p(*b)], fill=fill, width=width or self.lw)

    def text(self, x, y, s, size_m=0.5, kr=False, anchor="mm", fill=0):
        f = font(FONT_KR if kr else FONT_EN, size_m * self.s)
        self.d.text(self.p(x, y), s, font=f, fill=fill, anchor=anchor)

    def rect_fill(self, x0, y0, x1, y1, fill=0):
        self.d.rectangle([self.p(x0, y0), self.p(x1, y1)], fill=fill)


def draw_walls_filled(P, outer, t):
    outer_poly = Polygon(outer)
    inner = outer_poly.buffer(-t, join_style=2)
    P.poly_fill(outer, 0)
    P.poly_fill(list(inner.exterior.coords), 255)
    return inner


def draw_walls_double(P, outer, t):
    outer_poly = Polygon(outer)
    inner = outer_poly.buffer(-t, join_style=2)
    P.poly_line(outer)
    P.poly_line(list(inner.exterior.coords)[:-1])
    return inner


def cut_opening(P, door, t, double_line=False):
    """벽에 개구부를 뚫는다. door: dict(cx, cy, width, orientation)"""
    cx, cy, w = door["cx"], door["cy"], door["width"]
    e = t * 0.6 + 0.05
    if door["orientation"] == "horizontal":   # 가로 벽에 뚫린 구멍
        x0, x1, y0, y1 = cx - w / 2, cx + w / 2, cy - e, cy + e
        P.rect_fill(x0, y0, x1, y1, 255)
        if double_line:  # 이중선 벽은 개구부 양끝을 막는 선(문틀)을 그린다
            P.line((x0, cy - t / 2), (x0, cy + t / 2))
            P.line((x1, cy - t / 2), (x1, cy + t / 2))
    else:
        x0, x1, y0, y1 = cx - e, cx + e, cy - w / 2, cy + w / 2
        P.rect_fill(x0, y0, x1, y1, 255)
        if double_line:
            P.line((cx - t / 2, y0), (cx + t / 2, y0))
            P.line((cx - t / 2, y1), (cx + t / 2, y1))


def draw_swing(P, door, t, inward):
    """문 열림 표시(문짝 선 + 4분원 호). inward = 실내 방향 단위벡터 (ux, uy)"""
    cx, cy, w = door["cx"], door["cy"], door["width"]
    ux, uy = inward
    if door["orientation"] == "horizontal":
        hx, hy = cx - w / 2, cy + uy * t / 2
        vx, vy = 1.0, 0.0
    else:
        hx, hy = cx + ux * t / 2, cy - w / 2
        vx, vy = 0.0, 1.0
    P.line((hx, hy), (hx + ux * w, hy + uy * w))
    pts = []
    for k in range(25):
        a = (math.pi / 2) * k / 24
        pts.append((hx + w * (math.cos(a) * ux + math.sin(a) * vx),
                    hy + w * (math.cos(a) * uy + math.sin(a) * vy)))
    P.poly_line(pts, closed=False)


def draw_rack(P, r, style="bays", label=None):
    rect = affinity.rotate(box(r["cx"] - r["w"] / 2, r["cy"] - r["h"] / 2,
                               r["cx"] + r["w"] / 2, r["cy"] + r["h"] / 2),
                           r.get("rotation_deg", 0), origin="center")
    coords = list(rect.exterior.coords)[:-1]
    P.poly_fill(coords, 225)   # 연한 회색 채움
    P.poly_line(coords)
    rot = r.get("rotation_deg", 0)
    if rot == 0:
        x0, x1 = r["cx"] - r["w"] / 2, r["cx"] + r["w"] / 2
        y0, y1 = r["cy"] - r["h"] / 2, r["cy"] + r["h"] / 2
        long_x = r["w"] >= r["h"]
        L = r["w"] if long_x else r["h"]
        nb = max(1, round(L / 2.7))
        for i in range(nb):
            if long_x:
                a, b = x0 + L * i / nb, x0 + L * (i + 1) / nb
                if i:
                    P.line((a, y0), (a, y1))
                if style == "x":
                    P.line((a, y0), (b, y1)); P.line((a, y1), (b, y0))
            else:
                a, b = y0 + L * i / nb, y0 + L * (i + 1) / nb
                if i:
                    P.line((x0, a), (x1, a))
                if style == "x":
                    P.line((x0, a), (x1, b)); P.line((x1, a), (x0, b))
        if r["h"] >= 2.0 and long_x:   # 앞뒤로 붙은 선반의 가운데 선
            P.line((x0, r["cy"]), (x1, r["cy"]))
    if label:
        P.text(r["cx"], r["cy"], label, size_m=0.45 if r["h"] < 2 else 0.6)


def draw_pillar(P, c):
    x0, y0 = c["cx"] - c["w"] / 2, c["cy"] - c["h"] / 2
    P.rect_fill(x0, y0, x0 + c["w"], y0 + c["h"], 0)


def draw_dimension(P, a, b, offset, text):
    """치수선: a→b 구간, offset 만큼 바깥으로 띄움"""
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * offset, dx / L * offset
    A, B = (ax + nx, ay + ny), (bx + nx, by + ny)
    P.line(a, (A[0] + nx * 0.15, A[1] + ny * 0.15))
    P.line(b, (B[0] + nx * 0.15, B[1] + ny * 0.15))
    P.line(A, B)
    for q in (A, B):  # 사선 눈금
        P.line((q[0] - 0.3, q[1] + 0.3), (q[0] + 0.3, q[1] - 0.3), width=P.lw * 2)
    mx, my = (A[0] + B[0]) / 2 + nx * 0.6, (A[1] + B[1]) / 2 + ny * 0.6
    P.text(mx, my, text, size_m=0.6)


def draw_title_block(P, x, y, name, scale_txt):
    P.poly_line([(x, y), (x + 9, y), (x + 9, y + 4), (x, y + 4)])
    P.line((x, y + 1.5), (x + 9, y + 1.5))
    P.text(x + 4.5, y + 0.75, "FORKSIGHT", size_m=0.7)
    P.text(x + 4.5, y + 2.3, name, size_m=0.55)
    P.text(x + 4.5, y + 3.3, scale_txt, size_m=0.5)


def draw_north(P, x, y):
    P.poly_line([(x, y - 1.2), (x + 0.5, y + 0.6), (x, y + 0.2), (x - 0.5, y + 0.6)])
    P.text(x, y - 1.8, "N", size_m=0.6)


def rect_obj(i, typ, cx, cy, w, h, rot=0):
    return {"id": f"{typ}_{i:02d}", "type": typ, "cx": cx, "cy": cy, "w": w, "h": h,
            "rotation_deg": rot}


def plan_a():
    W, H, t = 40.0, 25.0, 0.3
    outer = [(0, 0), (W, 0), (W, H), (0, H)]
    racks = []
    k = 1
    for (x0, x1) in [(4.0, 18.0), (22.0, 36.0)]:
        racks.append(rect_obj(k, "rack", (x0 + x1) / 2, t + 0.6, x1 - x0, 1.2)); k += 1  # 벽에 붙은 선반
        for yc in (5.7, 11.1):
            racks.append(rect_obj(k, "rack", (x0 + x1) / 2, yc, x1 - x0, 2.4)); k += 1
    pillars = []
    j = 1
    for x in (10.0, 20.0, 30.0):
        for y in (17.0, 21.5):
            pillars.append(rect_obj(j, "pillar", x, y, 0.5, 0.5)); j += 1
    doors = [
        {"id": "door_01", "type": "door", "cx": t / 2, "cy": 19.6, "width": 1.2, "orientation": "vertical"},
        {"id": "door_02", "type": "door", "cx": 6.5, "cy": H - t / 2, "width": 1.0, "orientation": "horizontal"},
        {"id": "door_03", "type": "dock", "cx": 27.0, "cy": H - t / 2, "width": 4.0, "orientation": "horizontal"},
        {"id": "door_04", "type": "dock", "cx": 33.0, "cy": H - t / 2, "width": 4.0, "orientation": "horizontal"},
    ]
    gt = dict(name="plan_A", outer=outer, t=t, racks=racks, pillars=pillars, doors=doors,
              interior_walls=[])

    P = Plan((W, H))
    draw_walls_filled(P, outer, t)
    for d in doors:
        cut_opening(P, d, t)
    draw_swing(P, doors[0], t, (1, 0))
    draw_swing(P, doors[1], t, (0, -1))
    for i, r in enumerate(racks):
        draw_rack(P, r, "bays", f"RACK {chr(65 + i)}")
    for c in pillars:
        draw_pillar(P, c)
    P.text(11.0, 3.15, "AISLE 1", size_m=0.45)
    P.text(29.0, 8.4, "AISLE 2", size_m=0.45)
    P.text(20.0, 8.4, "통로", size_m=0.55, kr=True)
    P.text(15.0, 19.3, "STAGING AREA  적치 구역", size_m=0.6, kr=True)
    P.text(27.0, 23.6, "DOCK 1", size_m=0.45)
    P.text(33.0, 23.6, "DOCK 2", size_m=0.45)
    draw_dimension(P, (0, 0), (W, 0), -2.5, "40000")
    draw_dimension(P, (0, H), (0, 0), -2.5, "25000")
    draw_dimension(P, (4, 0), (18, 0), -1.2, "14000")
    draw_title_block(P, W + 2.5, H - 4, "TEST PLAN A", "SCALE 1:200")
    draw_north(P, W + 7, 2)
    return P, gt


def plan_b():
    t = 0.25
    outer = [(0, 0), (50, 0), (50, 20), (30, 20), (30, 35), (0, 35)]
    racks = []
    k = 1
    # 위쪽 가로 선반들
    for yc in (4.5, 9.9, 15.3):
        for (x0, x1) in [(3.0, 15.0), (18.0, 27.0)]:
            racks.append(rect_obj(k, "rack", (x0 + x1) / 2, yc, x1 - x0, 2.4)); k += 1
    # 오른쪽 날개: 세로 선반 (벽에 붙은 것 포함)
    racks.append(rect_obj(k, "rack", 50 - t - 0.6, 10.0, 1.2, 12.0)); k += 1
    for xc in (37.0, 42.0):
        racks.append(rect_obj(k, "rack", xc, 10.0, 2.4, 12.0)); k += 1
    # 아래 날개
    racks.append(rect_obj(k, "rack", 20.0, 26.0, 12.0, 1.2)); k += 1
    pillars = []
    j = 1
    for (x, y) in [(10, 22), (20, 21), (33, 3), (45, 3), (15, 31), (25, 31)]:
        pillars.append(rect_obj(j, "pillar", float(x), float(y), 0.6, 0.6)); j += 1
    doors = [
        {"id": "door_01", "type": "dock", "cx": 40.0, "cy": 20.0 - t / 2, "width": 3.5, "orientation": "horizontal"},
        {"id": "door_02", "type": "dock", "cx": 30.0 - t / 2, "cy": 26.0, "width": 3.5, "orientation": "vertical"},
        {"id": "door_03", "type": "door", "cx": 22.0, "cy": 35 - t / 2, "width": 1.2, "orientation": "horizontal"},
        {"id": "door_04", "type": "door", "cx": t / 2, "cy": 12.0, "width": 1.0, "orientation": "vertical"},
    ]
    # 사무실 칸막이 (왼쪽 아래 구석)
    pt = 0.15
    interior_walls = [
        {"id": "iwall_01", "polygon": [(t, 28.0), (8.0, 28.0), (8.0, 28.0 + pt), (t, 28.0 + pt)]},
        {"id": "iwall_02", "polygon": [(8.0, 28.0), (8.0 + pt, 28.0), (8.0 + pt, 35 - t), (8.0, 35 - t)]},
    ]
    office_door = {"cx": 8.0 + pt / 2, "cy": 31.0, "width": 1.0, "orientation": "vertical"}
    gt = dict(name="plan_B", outer=outer, t=t, racks=racks, pillars=pillars, doors=doors,
              interior_walls=interior_walls)

    P = Plan((50, 35))
    draw_walls_double(P, outer, t)
    for d in doors:
        cut_opening(P, d, t, double_line=True)
    draw_swing(P, doors[2], t, (0, -1))
    draw_swing(P, doors[3], t, (1, 0))
    # 칸막이 (이중선) + 사무실 문
    for w in interior_walls:
        P.poly_line(w["polygon"])
    cut_opening(P, office_door, pt, double_line=True)
    draw_swing(P, dict(office_door), pt, (1, 0))
    P.text(4.0, 31.5, "사무실", size_m=0.7, kr=True)
    for i, r in enumerate(racks):
        draw_rack(P, r, "x", None if r["w"] < 3 else f"R-{i + 1:02d}")
    for c in pillars:
        draw_pillar(P, c)
    P.text(40.0, 18.3, "DOCK", size_m=0.45)
    P.text(15.0, 7.2, "MAIN AISLE", size_m=0.5)
    draw_dimension(P, (0, 0), (50, 0), -2.5, "50000")
    draw_dimension(P, (0, 35), (0, 0), -2.5, "35000")
    draw_dimension(P, (50, 0), (50, 20), -2.5, "20000")
    draw_title_block(P, 52.5, 30, "TEST PLAN B", "SCALE 1:250")
    draw_north(P, 57, 25)
    return P, gt


def scanify(img, angle=1.5, seed=0):
    rng = np.random.default_rng(seed)
    im = img.convert("L").rotate(angle, resample=Image.BICUBIC, expand=True, fillcolor=255)
    im = im.filter(ImageFilter.GaussianBlur(1.0))
    a = np.asarray(im).astype(np.float32)
    a = 245 - (245 - a) * 0.8                      # 잉크를 약간 흐리게
    a += rng.normal(0, 12, a.shape)                # 잡음
    # 종이 얼룩(밝기 불균일)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    a -= 15 * np.sin(xx / a.shape[1] * 3.1) * np.cos(yy / a.shape[0] * 2.3)
    a = np.clip(a, 0, 255).astype(np.uint8)
    return Image.fromarray(a)


def gt_json(gt, P, source):
    W = max(x for x, _ in gt["outer"])
    H = max(y for _, y in gt["outer"])
    objs = gt["racks"] + gt["pillars"]
    return {
        "schema_version": "0.1",
        "meta": {"name": gt["name"], "source_file": source, "created_by": "ground_truth",
                 "bbox_m": [W, H], "scale": {"px_per_m": P.s, "method": "ground_truth"},
                 "wall_thickness_m": gt["t"]},
        "boundary": {"polygon": [list(p) for p in gt["outer"]]},
        "walls": [{"id": w["id"], "kind": "interior", "polygon": [list(p) for p in w["polygon"]]}
                  for w in gt["interior_walls"]],
        "objects": objs,
        "doors": gt["doors"],
    }


def plan_c(dark=False):
    """컬러 선, 테두리 없이 색만 칠한 선반, 원형 기둥, 문 열림 호 없음.
    dark=True면 검은 배경(CAD 화면 캡처 스타일)."""
    W, H, t = 36.0, 22.0, 0.35
    s, margin = 32, 5.0
    bg = (20, 22, 28) if dark else (255, 255, 255)
    wall_c = (230, 230, 235) if dark else (30, 60, 140)
    rack_c = (200, 120, 40) if dark else (245, 190, 130)
    pil_c = (150, 150, 160) if dark else (90, 90, 90)
    txt_c = (120, 220, 120) if dark else (200, 40, 40)
    img = Image.new("RGB", (int((W + 2 * margin) * s), int((H + 2 * margin) * s)), bg)
    d = ImageDraw.Draw(img)
    m = margin * s
    p = lambda x, y: (m + x * s, m + y * s)
    d.rectangle([p(0, 0), p(W, H)], fill=wall_c)
    d.rectangle([p(t, t), p(W - t, H - t)], fill=bg)
    doors = [
        {"id": "door_01", "type": "dock", "cx": 9.0, "cy": t / 2, "width": 3.0, "orientation": "horizontal"},
        {"id": "door_02", "type": "door", "cx": W - t / 2, "cy": 17.0, "width": 1.0, "orientation": "vertical"},
        {"id": "door_03", "type": "dock", "cx": 24.0, "cy": H - t / 2, "width": 3.5, "orientation": "horizontal"},
    ]
    for dr in doors:
        e = t * 0.7
        if dr["orientation"] == "horizontal":
            d.rectangle([p(dr["cx"] - dr["width"] / 2, dr["cy"] - e), p(dr["cx"] + dr["width"] / 2, dr["cy"] + e)], fill=bg)
        else:
            d.rectangle([p(dr["cx"] - e, dr["cy"] - dr["width"] / 2), p(dr["cx"] + e, dr["cy"] + dr["width"] / 2)], fill=bg)
    racks = []
    k = 1
    for xc in (4.0, 8.5, 13.0, 17.5, 22.0):    # 세로 선반 열
        hgt = 1.2 if xc == 4.0 else 2.2
        racks.append(rect_obj(k, "rack", xc, 9.0, hgt, 10.0)); k += 1
    racks.append(rect_obj(k, "rack", 30.0, t + 0.5, 8.0, 1.0)); k += 1     # 벽에 붙은 선반
    racks.append(rect_obj(k, "rack", 30.0, 9.0, 6.0, 2.0)); k += 1
    for r in racks:
        d.rectangle([p(r["cx"] - r["w"] / 2, r["cy"] - r["h"] / 2), p(r["cx"] + r["w"] / 2, r["cy"] + r["h"] / 2)],
                    fill=rack_c)
    pillars = []
    for j, (x, y) in enumerate([(6.0, 18.0), (16.0, 18.0), (28.0, 16.0)]):
        R = 0.3
        d.ellipse([p(x - R, y - R), p(x + R, y + R)], fill=pil_c)
        pillars.append(rect_obj(j + 1, "pillar", x, y, 2 * R, 2 * R))
    f = font(FONT_KR, 0.6 * s)
    d.text(p(13.0, 2.2), "보관 구역 A", font=f, fill=txt_c, anchor="mm")
    d.text(p(30.0, 13.0), "PICKING", font=font(FONT_EN, 0.5 * s), fill=txt_c, anchor="mm")
    d.text(p(W / 2, -2.2), f"{int(W * 1000)}", font=font(FONT_EN, 0.6 * s), fill=wall_c, anchor="mm")
    d.line([p(0, -1.4), p(W, -1.4)], fill=wall_c, width=1)
    gt = dict(name="plan_C" + ("_dark" if dark else ""), outer=[(0, 0), (W, 0), (W, H), (0, H)], t=t,
              racks=racks, pillars=pillars, doors=doors, interior_walls=[])

    class _P:   # gt_json이 쓰는 축척 정보
        pass
    PP = _P(); PP.s = s
    return img, PP, gt


def main_ab():
    OUT.mkdir(exist_ok=True)
    cases = []
    PA, ga = plan_a()
    PA.img.save(OUT / "plan_A.png")
    cases.append(("plan_A.png", PA, ga))

    PB, gb = plan_b()
    PB.img.save(OUT / "plan_B.png")
    cases.append(("plan_B.png", PB, gb))

    # 스캔본처럼 만든 A (기울기 1.5도, 잡음, 흐림, JPG)
    scanify(PA.img, 1.5).save(OUT / "plan_A_scan.jpg", quality=70)
    cases.append(("plan_A_scan.jpg", PA, ga))

    # B를 PDF로
    import pymupdf
    doc = pymupdf.open()
    w, h = PB.img.size
    page = doc.new_page(width=w * 72 / 150, height=h * 72 / 150)
    page.insert_image(page.rect, filename=str(OUT / "plan_B.png"))
    doc.save(OUT / "plan_B.pdf")
    cases.append(("plan_B.pdf", PB, gb))

    for src, P, g in cases:
        stem = Path(src).name.replace(".", "_")
        (OUT / f"{stem}.gt.json").write_text(json.dumps(gt_json(g, P, src), ensure_ascii=False, indent=1))
    print("saved:", [c[0] for c in cases])


def main_c():
    for dark in (False, True):
        img, PP, g = plan_c(dark)
        name = "plan_C_dark.png" if dark else "plan_C_color.png"
        img.save(OUT / name)
        (OUT / f"{name.replace('.', '_')}.gt.json").write_text(json.dumps(gt_json(g, PP, name), ensure_ascii=False, indent=1))
        print("saved:", name)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    main_ab()
    main_c()


if __name__ == "__main__":
    main()
