"""도면 인식·분석 기준값 (프로젝트 가정값). 값을 바꾸면 인식 결과가 달라진다."""

# 도면 인식(구조 추출) 기준값. 단위가 m인 값은 축척(px_per_m)을 곱해 픽셀로 바꿔 쓴다.
P = dict(
    assumed_wall_m=0.3,      # 축척을 모를 때 가정하는 외벽 두께
    text_max_m=1.0,          # 이보다 작은 속 빈 덩어리는 글자로 봄
    fill_max_width_m=3.0,    # 둘러싸인 공간의 폭이 이보다 좁으면 '속이 찬 물체'로 채움
    thin_line_m=0.12,        # 이보다 얇은 선은 지움
    max_opening_m=6.0,       # 이보다 넓은 개구부는 없다고 가정 (건물 윤곽 찾기용)
    min_object_m2=0.12,      # 이보다 작은 덩어리는 무시
    pillar_max_m=1.2,        # 기둥 최대 한 변
    pillar_min_m=0.35,
    partition_max_m=0.45,    # 이보다 얇은 내부 구조물은 칸막이벽
    partition_min_len_m=1.0, # 칸막이벽 최소 길이 (짧으면 글자 획으로 보고 버림)
    min_door_m=0.6,
    door_dock_m=2.5,
    snap_m=0.05,             # 좌표 정렬 단위 (5cm)
    angle_snap_deg=3.0,      # 이 각도 이내면 0/90도로 맞춤
)

# 레이아웃 분석(통로망·격자·검사) 기준값
DEFAULTS = dict(
    raster_m=0.05,          # 분석용 고해상도 래스터 1칸 크기
    cell_m=0.25,            # 출력 점유 격자 1칸 크기
    forklift_min_m=2.5,     # 지게차 통행 최소 폭 (이보다 좁으면 narrow)
    pedestrian_min_m=0.8,   # 보행 최소 폭 (이보다 좁으면 경고)
    door_dock_m=2.5,        # 이 폭 이상의 개구부는 dock
)
