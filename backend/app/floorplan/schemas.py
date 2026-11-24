"""레이아웃 JSON v0.1 형식 (Pydantic). 전체 설명은 docs/floorplan/LAYOUT_SCHEMA.md.

API 입력 검증에 필요한 핵심 필드만 엄격하게 정의하고, 나머지는 extra로 허용한다.
(분석 결과인 aisles·grid 등은 서버가 다시 계산하므로 느슨하게 둔다.)
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Point = list[float]  # [x, y] (m)


class _Loose(BaseModel):
    model_config = ConfigDict(extra="allow")


class Scale(_Loose):
    px_per_m: float | None = None
    method: str


class Meta(_Loose):
    name: str
    bbox_m: list[float] = Field(min_length=2, max_length=2)
    scale: Scale | None = None
    wall_thickness_m: float = 0.3


class Boundary(_Loose):
    polygon: list[Point] = Field(min_length=3)


class Wall(_Loose):
    id: str
    kind: Literal["exterior", "interior"]
    polygon: list[Point]


class LayoutObject(_Loose):
    id: str
    type: Literal["rack", "pillar", "machine", "obstacle"]
    cx: float
    cy: float
    w: float = Field(gt=0)
    h: float = Field(gt=0)
    rotation_deg: float = 0.0
    confidence: float | None = None
    movable: bool = True
    polygon: list[Point] | None = None


class Door(_Loose):
    id: str
    type: Literal["door", "dock"] | None = None
    cx: float
    cy: float
    width: float = Field(gt=0)
    orientation: Literal["horizontal", "vertical"]


class Layout(_Loose):
    schema_version: str = "0.1"
    meta: Meta
    boundary: Boundary
    walls: list[Wall] = []
    objects: list[LayoutObject] = []
    doors: list[Door] = []


class FloorplanResponse(BaseModel):
    layout: dict
    overlay_png_base64: str | None = None
