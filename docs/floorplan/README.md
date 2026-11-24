# 도면 → 레이아웃 (평면도 자동 분석)

공장·창고 **도면 이미지(PNG/JPG/PDF)**를 넣으면 벽, 선반, 기둥, 출입구를 인식해서
편집기와 시뮬레이터가 함께 쓰는 **레이아웃 JSON**(`LAYOUT_SCHEMA.md`)으로 바꾼다.
통로망·교차로·점유 격자·자동 검사(좁은 통로, 막힌 공간 등)도 같이 계산한다.

> 원칙: "AI가 완벽하게 읽는다"가 아니라 **"자동으로 초안을 만들고, 사람이 편집기에서 확인·수정한다."**

## 폴더 구성

```
backend/app/floorplan/          ← 서비스 코드 (FastAPI에 연결됨)
    preprocess.py               ① 표준화: 불러오기, 잉크 추출, 기울기 보정
    structure.py                ② 외곽·벽·출입구·칸막이벽 (규칙 기반)
    detectors/
        base.py                 ③ 인식기 공통 형식 (Detection, Detector)
        rule_based.py              규칙 기반 인식기 (비교·대체용, 현재 기본값)
        yolo_obb.py                YOLO-OBB 인식기 (메인, 3주차 구현 예정)
    postprocess.py              ④ 픽셀 → m, 격자 정렬 → 레이아웃 초안
    analysis.py                 ⑤ 통로망·교차로·격자·자동 검사 (JSON만 사용)
    render.py                   확인용 그림
    pipeline.py                 ①~⑤ 연결 (floorplan_to_layout)
    schemas.py                  레이아웃 JSON 형식 (Pydantic)
    router.py                   API
    cli.py                      명령줄 실행
    config.py                   기준값 (벽 두께 가정, 최소 통로 폭 등)

backend/tests/test_floorplan.py ← 정답 있는 테스트 도면으로 정확도 검사
backend/tests/fixtures/floorplans/

ml/floorplan/                   ← 학습·실험 (서비스와 분리)
    synth/make_test_plans.py    합성 도면 생성기 v1
    evaluate.py                 정답과 비교해 정확도 측정
    data/, weights/             (깃허브 제외)
```

## 실행 (backend 폴더, 가상환경 켠 상태)

```powershell
# 도면 한 장 돌려보기 → out/ 에 JSON + 겹침 그림
python -m app.floorplan.cli tests/fixtures/floorplans/plan_A.png --width-m 40

# 테스트
python -m pytest -q

# 서버 → http://127.0.0.1:8000/docs 에서 직접 업로드해 볼 수 있음
python -m uvicorn app.main:app --reload
```

축척은 셋 중 하나를 꼭 넣는다 (안 넣으면 벽 두께 0.3m 가정 → 크기 약 4% 오차).
- `--width-m 40` 건물 외곽 가로 길이
- `--px-per-m 40` 도면 1m가 몇 픽셀인지
- `--two-point x1,y1,x2,y2,40` 두 점 사이 실제 길이 (편집기의 "두 점 클릭" 방식)

## API

| 메서드 | 주소 | 하는 일 |
|---|---|---|
| POST | `/api/v1/floorplans` | 도면 업로드(form: `file`, `width_m`/`px_per_m`/`two_point`, `detector`) → `{layout, overlay_png_base64}` |
| POST | `/api/v1/layouts/analyze` | 수정한 레이아웃 JSON → 통로망·격자·경고 다시 계산 |

## 합성 도면 생성·평가 (저장소 루트에서)

```powershell
python ml/floorplan/synth/make_test_plans.py   # ml/floorplan/data/samples 에 도면 + 정답 생성
python ml/floorplan/evaluate.py                # 정답과 비교한 정확도 표
```

현재 규칙 기반 결과 (테스트 도면 6장): 선반·기둥·출입구 모두 검출, 오탐 0, 위치 오차 최대 약 11cm.
**테스트 도면은 우리가 만든 것**이라 실제 도면 검증이 별도로 필요하다.

## 인식기 추가하는 법

`detectors/base.py`의 `Detector`를 상속해 `detect(image, object_mask, px_per_m) -> list[Detection]`을 구현하고
`detectors/__init__.py`의 `_REGISTRY`에 등록하면 `detector="새이름"`으로 바로 비교할 수 있다.
