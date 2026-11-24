"""③ 물체 인식기 공통 형식.

모든 인식기(규칙 기반, YOLO-OBB …)는 같은 입력을 받아 같은 형식의 Detection 목록을 돌려준다.
그래서 pipeline에서 인식기 이름만 바꿔 끼우며 비교할 수 있다.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field

import numpy as np

OBJECT_TYPES = ("rack", "pillar", "machine", "obstacle")


@dataclass
class Detection:
    """인식된 물체 하나 (픽셀 단위, 기울기 보정된 이미지 기준)."""

    type: str                  # rack / pillar / machine / obstacle
    cx: float                  # 중심 x
    cy: float                  # 중심 y
    w: float                   # 회전 전 x 방향 길이
    h: float                   # 회전 전 y 방향 길이
    rot: float = 0.0           # 회전(도, 화면 시계 방향 +)
    conf: float = 1.0          # 확신도 0~1
    poly: np.ndarray | None = None   # 사각형이 아닌 장애물의 다각형 [N,2]
    extra: dict = field(default_factory=dict)  # shape="round" 등 부가 정보

    def as_dict(self) -> dict:
        d = asdict(self)
        if d["poly"] is None:
            d.pop("poly")
        d.update(d.pop("extra"))
        return d


class Detector(ABC):
    """물체 인식기 인터페이스."""

    name: str = "base"

    @abstractmethod
    def detect(self, image: np.ndarray, object_mask: np.ndarray, px_per_m: float) -> list[Detection]:
        """image: 기울기 보정된 컬러 도면, object_mask: 벽 안쪽 물체 후보(규칙 기반용),
        px_per_m: 축척. 반환: Detection 목록."""
