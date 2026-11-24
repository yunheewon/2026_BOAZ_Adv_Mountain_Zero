# FORKSIGHT 레이아웃 JSON 형식 (v0.1)

> 코드 정의: `backend/app/floorplan/schemas.py` (API 입력 검증용 Pydantic 모델)

도면 인식 파이프라인의 **출력**이자, 2D 편집기(React)가 **읽고 저장**하고, 시뮬레이터가 **입력**으로 받는 공통 형식이다.
자동 인식이든 사용자가 직접 그리든 결과는 같은 형식으로 저장한다.

## 좌표 규칙

| 항목 | 규칙 |
|---|---|
| 단위 | 미터(m) |
| 원점 | 건물 외곽(외벽 바깥면)을 감싸는 사각형의 **왼쪽 위** 꼭짓점 |
| 축 방향 | x는 오른쪽, **y는 아래쪽**. 화면·이미지 좌표와 같은 방향이다 (React Konva와 같음) |
| 각도 | `rotation_deg`는 도(degree) 단위이고, 화면에서 시계 방향이 + |
| 사각형 물체 | `cx, cy`는 **중심** 좌표, `w`는 회전 전 x 방향 길이, `h`는 회전 전 y 방향 길이 |

> Konva의 `Rect`는 왼쪽 위 기준이므로 `x=cx, y=cy, offsetX=w/2, offsetY=h/2, rotation=rotation_deg`로 그리면 된다.
> 시뮬레이터에서 y축을 위로 쓰고 싶으면 `y_sim = bbox_height - y` 로 바꾸면 된다.

## 최상위 구조

```json
{
  "schema_version": "0.1",
  "meta": { ... },
  "boundary": { "polygon": [[x, y], ...] },
  "walls": [ ... ],
  "objects": [ ... ],
  "doors": [ ... ],
  "aisles": [ ... ],
  "intersections": [ ... ],
  "endpoints": [ ... ],
  "grid": { ... },
  "issues": [ ... ]
}
```

### meta

| 필드 | 의미 |
|---|---|
| `name` | 레이아웃 이름 |
| `source_file` | 원본 도면 파일명 (직접 그린 경우 `null`) |
| `created_by` | `"floorplan2layout"` (자동 인식) / `"editor"` (사용자 편집) |
| `detector` | 물체 인식기 이름: `"rule_based"` / `"yolo_obb"` |
| `bbox_m` | `[가로, 세로]` 건물 외곽 크기 (m) |
| `scale` | `{ "px_per_m": 40.0, "method": "px_per_m" \| "two_point" \| "building_width" \| "assumed_wall" }` 축척과 그 출처. `assumed_wall`은 사용자가 축척을 주지 않아 벽 두께를 0.3m로 가정한 값이라 **확인 필요** |
| `wall_thickness_m` | 추정된 외벽 두께 |
| `image_transform` | 원본 이미지 픽셀 ↔ 레이아웃 좌표 변환 정보 (편집기에서 원본 도면을 반투명 배경으로 깔 때 사용) |

### boundary
작업장 외곽(외벽 바깥면) 다각형. 점은 시계 방향 순서다. ㄱ자 건물이면 꼭짓점이 6개다.

### walls
```json
{ "id": "wall_01", "kind": "exterior" | "interior", "polygon": [[x, y], ...] }
```
벽은 두께가 있는 다각형으로 저장한다. `exterior`는 외벽, `interior`는 사무실 칸막이 같은 내부 벽이다.

### objects (편집기에서 옮길 수 있는 물체)
```json
{
  "id": "rack_01",
  "type": "rack" | "pillar" | "machine" | "obstacle",
  "cx": 11.0, "cy": 0.9, "w": 14.0, "h": 1.2, "rotation_deg": 0,
  "confidence": 0.95,
  "source": "cv" | "user",
  "movable": true
}
```
- `rack`: 선반. 앞뒤로 붙은 선반(back-to-back)은 하나의 사각형으로 인식된다.
- `pillar`: 기둥. 기본값은 `movable: false`. 원형 기둥은 `"shape": "round"`이고 `w=h=지름`
- `machine`: 고정 설비 (YOLO-OBB 학습 클래스, 라벨 확보 시). 기본값 `movable: false` 권장
- `obstacle`: 사각형이 아닌 기타 장애물. `polygon` 필드를 추가로 가진다.

### doors
```json
{ "id": "door_01", "type": "door" | "dock", "cx": 0.15, "cy": 19.6, "width": 1.2, "orientation": "vertical" | "horizontal", "wall_id": "wall_01" }
```
- 벽이 끊긴 곳(개구부)을 출입구로 본다. 폭 2.5m 이상은 `dock`(화물 출입구), 그보다 좁으면 `door`(사람 출입구)로 일단 분류한다.
- `orientation`은 개구부가 놓인 벽의 방향이다.

### aisles (통로) / intersections (교차로) / endpoints (끝점)
빈 공간의 중심선(skeleton)을 따라 자동으로 뽑은 통로 네트워크(그래프)다. 경로 탐색(A*)과 교차로 위험 분석에 쓴다.
```json
{ "id": "aisle_01", "centerline": [[x, y], ...], "length_m": 14.0, "width_min_m": 2.9, "width_median_m": 3.0,
  "kind": "shared" | "narrow" | "door_link", "from": "ix_01", "to": "ix_02" }
{ "id": "ix_01", "x": 20.0, "y": 3.0, "degree": 3 }
{ "id": "end_01", "x": 0.55, "y": 19.6, "kind": "door" | "dead_end", "door_id": "door_01" }
```
- `kind`: 폭이 지게차 통행 기준(기본 2.5m) 이상이면 `shared`, 미만이면 `narrow`(보행 전용 후보), 출입구와 통로망을 잇는 짧은 선은 `door_link`. 사용자가 나중에 `pedestrian`, `forklift`로 바꿀 수 있다.
- `degree`: 교차로에 연결된 통로 수 (3 = T자, 4 = 십자)
- `endpoints`: 통로가 끝나는 점. 출입구에 닿으면 `door`(어느 출입구인지 `door_id`), 막다른 곳이면 `dead_end`
- 모든 출입구는 통로망에 연결된다 (넓은 화물 출입구는 가장 가까운 통로에 자동 연결)
- 넓은 빈 공간(적치 구역 등)에서는 기둥을 돌아가는 고리 모양 경로가 생긴다. 시뮬레이터가 격자 기반 A*를 쓰면 이 그래프는 교차로 위치 파악용으로만 써도 된다.

### grid (점유 격자)
시뮬레이터가 바로 쓸 수 있는 격자. 한 줄이 문자열 하나다.
```json
{ "cell_m": 0.25, "cols": 160, "rows_count": 100,
  "legend": { ".": "free", "#": "wall", "R": "rack", "P": "pillar", "O": "obstacle", " ": "outside" },
  "rows": ["################...", "#....RRRRRR...", ...] }
```

### issues (자동 검사 결과)
```json
{ "level": "warning" | "error" | "info", "code": "NARROW_AISLE", "message": "...", "target_ids": ["aisle_03"] }
```
| code | 의미 |
|---|---|
| `SCALE_ASSUMED` | 축척을 받지 못해 가정값을 씀 |
| `OBJECT_OVERLAP` | 물체끼리 겹침 |
| `OUTSIDE_BOUNDARY` | 물체가 작업장 바깥으로 나감 |
| `NARROW_AISLE` | 통로 폭이 보행 최소 폭(기본 0.8m)보다 좁음 |
| `FORKLIFT_BLOCKED` | 지게차 통행 기준보다 좁은 통로 (정보) |
| `UNREACHABLE_AREA` | 어떤 출입구와도 이어지지 않는 빈 공간 |
| `NO_DOOR` | 출입구를 하나도 찾지 못함 |
| `LOW_CONFIDENCE` | 인식 확신도가 낮은 물체 → 사용자 확인 필요 |
