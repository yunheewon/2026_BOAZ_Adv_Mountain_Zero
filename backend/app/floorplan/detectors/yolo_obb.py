"""YOLO-OBB 인식기 (메인). 3주차에 학습된 가중치로 구현한다.

계획:
  1. 기울기 보정된 도면을 1px = 5cm 로 리샘플링
  2. 1024×1024 조각으로 겹치게 자르기 (겹침 약 20%)
  3. 조각마다 YOLO-OBB 추론 → 회전 박스 [cls, cx, cy, w, h, angle, conf]
  4. 원래 좌표로 되돌리고 겹친 박스는 회전 NMS로 합치기
  5. Detection 목록으로 반환 (선반/기둥/설비)
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from .base import Detection, Detector

CLASS_NAMES = {0: "rack", 1: "pillar", 2: "machine"}


class YoloObbDetector(Detector):
    name = "yolo_obb"

    def __init__(self, weights: str | Path | None = None, tile: int = 1024, overlap: float = 0.2,
                 conf: float = 0.25):
        self.weights = Path(weights) if weights else None
        self.tile, self.overlap, self.conf = tile, overlap, conf

    def detect(self, image: np.ndarray, object_mask: np.ndarray, px_per_m: float) -> list[Detection]:
        if self.weights is None or not self.weights.exists():
            raise RuntimeError("YOLO-OBB 가중치가 없습니다. 3주차 학습 후 weights 경로를 지정하세요.")
        raise NotImplementedError("YOLO-OBB 추론은 3주차에 구현합니다.")
