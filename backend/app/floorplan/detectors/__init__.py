"""물체 인식기 모음. get_detector(이름)으로 꺼내 쓴다."""
from __future__ import annotations

from .base import Detection, Detector
from .rule_based import RuleBasedDetector
from .yolo_obb import YoloObbDetector

_REGISTRY = {"rule_based": RuleBasedDetector, "yolo_obb": YoloObbDetector}


def get_detector(name: str = "rule_based", **kwargs) -> Detector:
    if name not in _REGISTRY:
        raise ValueError(f"알 수 없는 인식기: {name} (가능: {list(_REGISTRY)})")
    return _REGISTRY[name](**kwargs)


__all__ = ["Detection", "Detector", "get_detector", "RuleBasedDetector", "YoloObbDetector"]
