"""① 표준화: 불러오기 → 잉크 추출 → 기울기 보정."""
from __future__ import annotations

import math
from pathlib import Path

import cv2
import numpy as np


def load_image(path: str | Path, dpi: int = 150) -> np.ndarray:
    """컬러(BGR)로 불러온다. 색으로 구분된 도면도 다루기 위해 흑백으로 바꾸지 않는다."""
    path = Path(path)
    if path.suffix.lower() == ".pdf":
        import pymupdf
        doc = pymupdf.open(path)
        pix = doc[0].get_pixmap(dpi=dpi, colorspace=pymupdf.csRGB, alpha=False)
        rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, 3)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    img = cv2.imdecode(np.fromfile(str(path), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"이미지를 읽을 수 없습니다: {path}")
    return img


def background_color(img: np.ndarray) -> np.ndarray:
    """가장 많이 나오는 색 = 종이(배경) 색. 흰 종이든 검은 CAD 화면이든 상관없다."""
    q = (img[::4, ::4].reshape(-1, 3) // 16).astype(np.int32)
    keys = q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2]
    k = np.bincount(keys).argmax()
    sel = img[::4, ::4].reshape(-1, 3)[keys == k]
    return np.median(sel, axis=0)


def binarize(img: np.ndarray) -> np.ndarray:
    """배경색과 충분히 다른 픽셀 = 잉크(1).
    ① 선·글자처럼 진하게 다른 것은 오츠 자동 임계값으로,
    ② 색만 연하게 칠한 면(테두리 없는 선반 등)은 낮은 임계값 + 일정 크기 이상 덩어리만 추가."""
    img = cv2.GaussianBlur(img, (3, 3), 0)
    bg = background_color(img)
    dev = np.abs(img.astype(np.float32) - bg).max(axis=2)
    dev8 = np.clip(dev, 0, 255).astype(np.uint8)
    otsu, strong = cv2.threshold(dev8, 0, 1, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # 배경(종이)의 잡음·얼룩 수준을 재서, 그보다 확실히 큰 차이만 '연한 칠'로 인정
    bgpix = dev[dev < otsu / 2]
    t_weak = max(25.0, float(bgpix.mean() + 5 * bgpix.std())) if bgpix.size else 25.0
    weak = (dev > t_weak).astype(np.uint8)
    weak = cv2.morphologyEx(weak, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    return (strong | weak).astype(np.uint8)


def estimate_skew(ink: np.ndarray) -> float:
    """긴 직선들의 각도 중앙값 (도). 도면은 대부분 가로/세로 선이라는 가정."""
    edges = cv2.Canny(ink * 255, 50, 150)
    L = min(ink.shape) // 6
    lines = cv2.HoughLinesP(edges, 1, np.pi / 1800, threshold=120, minLineLength=L, maxLineGap=8)
    if lines is None:
        return 0.0
    angs, wts = [], []
    for x1, y1, x2, y2 in lines.reshape(-1, 4):
        a = math.degrees(math.atan2(y2 - y1, x2 - x1))
        a = (a + 45) % 90 - 45          # 가로·세로를 같은 기준으로
        if abs(a) < 15:
            angs.append(a)
            wts.append(math.hypot(x2 - x1, y2 - y1))
    if not angs:
        return 0.0
    order = np.argsort(angs)
    cw = np.cumsum(np.array(wts)[order])
    return float(np.array(angs)[order][np.searchsorted(cw, cw[-1] / 2)])


def rotate(img: np.ndarray, deg: float) -> tuple[np.ndarray, np.ndarray]:
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), deg, 1.0)
    bg = tuple(float(v) for v in background_color(img))
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=bg), M


def standardize(path: str | Path) -> tuple[np.ndarray, np.ndarray, float]:
    """도면 파일 → (기울기를 바로잡은 컬러 이미지, 회전 행렬 M, 보정 각도[도])."""
    raw = load_image(path)
    deskew = estimate_skew(binarize(raw))
    if abs(deskew) > 0.05:
        img, M = rotate(raw, deskew)
    else:
        img, M = raw, cv2.getRotationMatrix2D((0, 0), 0, 1)
    return img, M, deskew
