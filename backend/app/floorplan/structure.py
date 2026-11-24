"""② 외곽·벽·출입구: 두꺼운 구조물만 남겨 건물 윤곽, 벽 띠, 출입구, 칸막이벽을 찾는다.

이 단계는 학습 모델 없이 규칙(OpenCV)으로만 동작한다.
결과의 object_mask(벽 안쪽에 남은 덩어리)는 규칙 기반 인식기의 입력이 된다.
"""
from __future__ import annotations

import math

import cv2
import numpy as np
from scipy import ndimage as ndi

from .config import P
from .preprocess import binarize


def remove_text(ink, pm):
    n, cc, st, _ = cv2.connectedComponentsWithStats(ink, connectivity=8)
    out = ink.copy()
    tmax = P["text_max_m"] * pm
    for i in range(1, n):
        x, y, w, h, a = st[i]
        if max(w, h) >= tmax:
            continue
        fill_ratio = a / float(w * h)
        if fill_ratio > 0.6:               # 꽉 찬 작은 사각형 = 기둥일 수 있음
            continue
        sub = cc[y:y + h, x:x + w] == i    # 테두리만 있는 정사각형 = 테두리로 그린 기둥
        border = np.concatenate([sub[0], sub[-1], sub[:, 0], sub[:, -1]]).mean()
        if border > 0.85 and 0.7 < w / h < 1.4 and min(w, h) >= P["pillar_min_m"] * pm:
            continue
        out[cc == i] = 0
    return out


def fill_enclosed(ink, pm, max_width_m, region=None):
    """선으로 둘러싸인 좁은 공간을 채운다 (선반 내부, 이중선 벽 사이, 글자 구멍).
    region을 주면 그 안에 있는 공간만 채운다 (건물 바깥 치수선 사이 공간 등은 제외)."""
    white = (ink == 0).astype(np.uint8)
    n, cc = cv2.connectedComponents(white, connectivity=4)
    border = set(np.unique(np.concatenate([cc[0], cc[-1], cc[:, 0], cc[:, -1]])))
    dist = cv2.distanceTransform(white, cv2.DIST_L2, 5)
    maxd = ndi.maximum(dist, cc, index=np.arange(n))
    ok = np.array([i not in border and 2 * maxd[i] < max_width_m * pm for i in range(n)])
    if region is not None:   # 공간의 대부분이 건물 안에 있어야 함
        inside = ndi.mean(region.astype(float), cc, index=np.arange(n))
        ok &= np.asarray(inside) > 0.9
    ok[0] = False
    out = ink.copy()
    out[ok[cc]] = 1
    return out


def remove_thin(ink, pm):
    k = max(3, int(round(P["thin_line_m"] * pm)) | 1)
    ker = cv2.getStructuringElement(cv2.MORPH_RECT, (k, k))
    return cv2.morphologyEx(ink, cv2.MORPH_OPEN, ker)


def solid_structure(gray, pm):
    """1단계: 아주 좁은 틈(이중선 벽 사이)만 채워 벽 구조로 건물 윤곽을 찾고,
    2단계: 윤곽 안에서만 선반 내부 같은 넓은 칸을 채운다."""
    ink = remove_text(binarize(gray), pm)
    walls_only = remove_thin(fill_enclosed(ink, pm, 0.6), pm)
    # 길이 1m 미만 덩어리(치수선 눈금, 방위표, 기둥 등)는 윤곽 찾기에서 제외
    n, cc, st, _ = cv2.connectedComponentsWithStats(walls_only, connectivity=8)
    long_ids = np.where(np.maximum(st[:, 2], st[:, 3]) >= 1.0 * pm)[0]
    long_ids = long_ids[long_ids > 0]
    fp = building_footprint(np.isin(cc, long_ids).astype(np.uint8), pm)
    solid = remove_thin(fill_enclosed(ink, pm, P["fill_max_width_m"], region=fp), pm)
    return solid & fp, fp


def building_footprint(solid, pm):
    """벽의 끊긴 곳(출입구)을 벽 방향으로만 이어 붙여 닫힌 윤곽을 만들고 속을 채운다.
    그 뒤 1.5m보다 가는 돌출부(근처 방위표·치수 눈금이 붙은 것)는 열림 연산으로 깎는다."""
    k = int(P["max_opening_m"] * pm) | 1      # 홀수 커널이어야 한쪽으로 밀리지 않음
    pad = k + 2
    s = cv2.copyMakeBorder(solid, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
    closed = cv2.morphologyEx(s, cv2.MORPH_CLOSE, np.ones((1, k), np.uint8)) | \
        cv2.morphologyEx(s, cv2.MORPH_CLOSE, np.ones((k, 1), np.uint8))
    closed = closed[pad:-pad, pad:-pad]
    filled = ndi.binary_fill_holes(closed).astype(np.uint8)
    ko = int(1.5 * pm) | 1
    filled = cv2.morphologyEx(filled, cv2.MORPH_OPEN, np.ones((ko, ko), np.uint8))
    n, cc, st, _ = cv2.connectedComponentsWithStats(filled, connectivity=8)
    if n < 2:
        raise ValueError("건물 외곽을 찾지 못했습니다.")
    big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
    return (cc == big).astype(np.uint8)


def outline_polygon(fp, pm):
    cnts, _ = cv2.findContours(fp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cnts, key=cv2.contourArea)
    poly = cv2.approxPolyDP(c, 0.25 * pm, True).reshape(-1, 2).astype(float)
    return orthogonalize(poly)


def orthogonalize(poly, tol_deg=8):
    """거의 가로/세로인 변을 정확히 가로/세로로 맞춘다."""
    pts = poly.copy()
    n = len(pts)
    for _ in range(2):
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            ang = abs(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))) % 180
            if ang < tol_deg or ang > 180 - tol_deg:
                y = (a[1] + b[1]) / 2
                pts[i][1] = y
                pts[(i + 1) % n][1] = y
            elif abs(ang - 90) < tol_deg:
                x = (a[0] + b[0]) / 2
                pts[i][0] = x
                pts[(i + 1) % n][0] = x
    # 같은 직선 위의 중간 점 제거
    keep = []
    for i in range(n):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % n]
        cross = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0])
        if abs(cross) > 1e-6:
            keep.append(p1)
    return np.array(keep)


def wall_thickness(solid, fp, pm):
    d = cv2.distanceTransform(fp, cv2.DIST_L2, 3)
    """외곽에서 안쪽으로 한 픽셀씩 들어가며, 구조물 비율이 벽 구간의 절반 아래로
    떨어지는 깊이를 벽 두께로 본다 (가장자리 1~2px의 흐림은 무시)."""
    maxd = int(1.0 * pm)
    ratios = []
    for t in range(1, maxd):
        ring = (d > t - 0.5) & (d <= t + 0.5)
        ratios.append(solid[ring].mean() if ring.sum() else 0.0)
    ratios = np.array(ratios)
    head = int(np.argmax(ratios[:max(3, int(0.15 * pm))]))
    ref = ratios[head]
    for i in range(head, len(ratios)):
        if ratios[i] < 0.5 * ref:
            return float(i + 0.5), d          # i번째 링 = 깊이 i+1, 경계는 그 사이
    return P["assumed_wall_m"] * pm, d


def find_doors(band, solid, pm, t_px):
    """벽 띠에서 구조물이 비어 있는 곳 = 개구부. 진짜 개구부는 벽 두께 전체가 비어 있으므로
    벽 두께의 60% 크기로 열림 연산을 해서 벽 안쪽 가장자리의 얇은 틈은 지운다."""
    gap = (band & (1 - solid)).astype(np.uint8)
    k = max(3, int(0.6 * t_px))
    gap = cv2.morphologyEx(gap, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    n, cc, st, _ = cv2.connectedComponentsWithStats(gap, connectivity=8)
    doors = []
    for i in range(1, n):
        cnts, _ = cv2.findContours((cc == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        (cx, cy), (w, h), _ = cv2.minAreaRect(max(cnts, key=cv2.contourArea))
        x, y, bw, bh = st[i, :4]
        width = max(bw, bh) / pm
        if width < P["min_door_m"]:
            continue
        doors.append(dict(cx=x + bw / 2, cy=y + bh / 2, width=width,
                          orientation="horizontal" if bw >= bh else "vertical"))
    return doors


def split_partitions(inner: np.ndarray, pm: float) -> tuple[np.ndarray, list[np.ndarray]]:
    """벽 안쪽 덩어리 중 얇은 것(칸막이벽)을 떼어 낸다.

    반환: (물체 후보 마스크, 칸막이벽 다각형 목록[픽셀])
    얇은데 1m보다 짧은 덩어리는 글자 획 같은 잡음으로 보고 버린다.
    """
    n, cc, st, _ = cv2.connectedComponentsWithStats(inner, connectivity=8)
    keep = np.zeros_like(inner)
    partitions = []
    for i in range(1, n):
        x, y, w, h = st[i, :4]
        sub = (cc[y:y + h, x:x + w] == i).astype(np.uint8)
        thick = 2 * cv2.distanceTransform(np.pad(sub, 1), cv2.DIST_L2, 5).max()
        if thick < P["partition_max_m"] * pm:
            if max(w, h) >= P["partition_min_len_m"] * pm:
                cnts, _ = cv2.findContours(sub, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                cnt = max(cnts, key=cv2.contourArea) + np.array([x, y])
                poly = cv2.approxPolyDP(cnt, 0.05 * pm, True).reshape(-1, 2)
                partitions.append(poly.astype(float))
            continue
        keep[cc == i] = 1
    return keep, partitions


def extract_structure(img: np.ndarray, pm: float) -> dict:
    """도면 이미지 + 축척 → 구조 정보 (모두 픽셀 단위).

    반환 키: solid, fp(건물 윤곽 마스크), t_px(벽 두께), walls(벽 마스크),
            object_mask(물체 후보), partitions(칸막이벽), doors(출입구)
    """
    solid, fp = solid_structure(img, pm)
    t_px, dist_in = wall_thickness(solid, fp, pm)
    band = ((dist_in > 0) & (dist_in <= t_px + max(1.5, 0.15 * t_px))).astype(np.uint8)
    band_exact = ((dist_in > 0) & (dist_in <= t_px + 0.5)).astype(np.uint8)
    walls = solid & band
    inner = solid & fp & (1 - band_exact)
    # 벽 띠 바로 안쪽에서 벽에 붙어 생기는 얇은 찌꺼기 제거
    inner = cv2.morphologyEx(inner, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    object_mask, partitions = split_partitions(inner, pm)
    doors = find_doors(band, solid, pm, t_px)
    return dict(solid=solid, fp=fp, t_px=t_px, walls=walls, object_mask=object_mask,
                partitions=partitions, doors=doors)
