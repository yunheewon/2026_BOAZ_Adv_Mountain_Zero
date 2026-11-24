"""도면 → 레이아웃 (평면도 자동 분석, Raster-to-Vector Floor Plan Conversion).

사용 예:
    from app.floorplan import floorplan_to_layout
    res = floorplan_to_layout("plan.png", width_m=40)
    res.layout   # 레이아웃 JSON (dict)
"""
from .analysis import analyze_layout
from .pipeline import PipelineResult, floorplan_to_layout

__all__ = ["floorplan_to_layout", "analyze_layout", "PipelineResult"]
