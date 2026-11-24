"""⑤ 분석: 레이아웃 JSON(기하 정보)만 보고 통로망·교차로·점유 격자·자동 검사를 계산한다.

원본 이미지가 필요 없다. 도면 인식 직후에도, 사용자가 편집기에서 선반을 옮긴 뒤에도 똑같이 호출한다.
"""
from __future__ import annotations

import math

import cv2
import numpy as np
from shapely.geometry import Point, Polygon
from skan import Skeleton, summarize
from skimage.morphology import skeletonize

from .config import DEFAULTS
from .geometry import door_polygon, object_polygon

CLASS = {"outside": 0, "free": 1, "wall": 2, "rack": 3, "pillar": 4, "obstacle": 5}
GRID_CHAR = {0: " ", 1: ".", 2: "#", 3: "R", 4: "P", 5: "O"}


def _fill(mask, poly, r, value=1):
    if poly.is_empty:
        return
    polys = [poly] if poly.geom_type == "Polygon" else list(getattr(poly, "geoms", []))
    for p in polys:
        if p.geom_type != "Polygon" or p.is_empty:
            continue
        pts = np.round(np.asarray(p.exterior.coords) / r).astype(np.int32)
        cv2.fillPoly(mask, [pts], value)
        for hole in p.interiors:
            cv2.fillPoly(mask, [np.round(np.asarray(hole.coords) / r).astype(np.int32)], 0)


def rasterize(layout: dict, r: float):
    """레이아웃을 r(m) 해상도의 클래스 이미지로 그린다."""
    W, H = layout["meta"]["bbox_m"]
    w, h = int(math.ceil(W / r)) + 1, int(math.ceil(H / r)) + 1
    lab = np.zeros((h, w), np.uint8)
    _fill(lab, Polygon(layout["boundary"]["polygon"]), r, CLASS["free"])
    for wl in layout.get("walls", []):
        if len(wl["polygon"]) >= 3:
            _fill(lab, Polygon(wl["polygon"]), r, CLASS["wall"])
    for o in layout.get("objects", []):
        _fill(lab, object_polygon(o), r, CLASS.get(o["type"], CLASS["obstacle"]))
    return lab


def make_grid(layout: dict, cell_m: float, r: float, lab_fine=None):
    lab = rasterize(layout, r) if lab_fine is None else lab_fine
    W, H = layout["meta"]["bbox_m"]
    cols, rows = int(math.ceil(W / cell_m)), int(math.ceil(H / cell_m))
    frac = {}
    for name, c in CLASS.items():
        m = (lab == c).astype(np.float32)
        frac[c] = cv2.resize(m, (cols, rows), interpolation=cv2.INTER_AREA)
    out = np.full((rows, cols), CLASS["free"], np.uint8)
    out[frac[CLASS["outside"]] > 0.5] = CLASS["outside"]
    # 장애물은 칸의 30% 이상 차지하면 그 칸을 막힌 칸으로 (보수적으로)
    occ = np.stack([frac[c] for c in (2, 3, 4, 5)])
    blocked = occ.max(0) >= 0.3
    out[blocked] = np.array([2, 3, 4, 5])[occ.argmax(0)][blocked]
    rows_txt = ["".join(GRID_CHAR[v] for v in row) for row in out]
    return {"cell_m": cell_m, "cols": cols, "rows_count": rows,
            "legend": {v: k for k, v in {"free": ".", "wall": "#", "rack": "R", "pillar": "P",
                                          "obstacle": "O", "outside": " "}.items()},
            "rows": rows_txt}, out


def _prune(skel, keep_mask, dist, r, rounds=4):
    """짧은 곁가지(넓은 공간의 모서리로 뻗는 가지) 제거.
    끝점이 keep_mask(출입구) 위에 있는 가지는 남긴다."""
    for _ in range(rounds):
        if skel.sum() < 3:
            break
        S = Skeleton(skel)
        df = summarize(S, separator="_")
        changed = False
        for i, row in df.iterrows():
            if row["branch_type"] != 1:          # 1 = 교차점-끝점 가지
                continue
            idx = S.path(i)
            coords = S.coordinates[idx].astype(int)
            end_first = S.degrees[idx[0]] == 1
            end, junc = (coords[0], coords[-1]) if end_first else (coords[-1], coords[0])
            if keep_mask[end[0], end[1]]:
                continue
            if row["branch_distance"] * r < max(1.0, 1.05 * 2 * dist[junc[0], junc[1]] * r):
                pts = coords[:-1] if end_first else coords[1:]   # 교차점 픽셀은 남김
                skel[pts[:, 0], pts[:, 1]] = False
                changed = True
        skel = skeletonize(skel)
        if not changed:
            break
    return skel


def _simplify(coords, tol):
    if len(coords) <= 2:
        return np.asarray(coords).tolist()
    pts = np.asarray(coords, np.float32).reshape(-1, 1, 2)
    return cv2.approxPolyDP(pts, tol, False).reshape(-1, 2).tolist()


def _rc_to_m(coords_rc, r):
    return [[round(float(c) * r, 2), round(float(rr) * r, 2)] for rr, c in coords_rc]


def _width_stats(line_m, dist, r):
    """중심선을 따라 0.25m 간격으로 폭(=2×벽까지 거리)을 잰다. 양 끝 0.6m는 교차로라 제외."""
    from shapely.geometry import LineString
    L = LineString(line_m)
    n = max(2, int(L.length / 0.25))
    ss = np.linspace(0, L.length, n)
    if L.length > 1.6:
        ss = ss[(ss >= 0.6) & (ss <= L.length - 0.6)]
    w = []
    for s in ss:
        p = L.interpolate(s)
        yy, xx = int(round(p.y / r)), int(round(p.x / r))
        if 0 <= yy < dist.shape[0] and 0 <= xx < dist.shape[1]:
            w.append(2 * dist[yy, xx] * r)
    w = np.array(w) if w else np.array([0.0])
    return float(w.min()), float(np.median(w))


def _door_inside_point(d, bnd, t):
    """출입구 중심에서 건물 안쪽으로 (벽 두께 + 0.5m) 들어간 점."""
    off = t + 0.5
    cands = [(d["cx"], d["cy"] - off), (d["cx"], d["cy"] + off)] if d["orientation"] == "horizontal" \
        else [(d["cx"] - off, d["cy"]), (d["cx"] + off, d["cy"])]
    for c in cands:
        if bnd.contains(Point(c)):
            return c
    return cands[0]


def aisle_network(layout: dict, lab: np.ndarray, r: float, opts: dict):
    """빈 공간의 중심선(skeleton)으로 통로 그래프를 만든다.
    반환: aisles(간선), nodes(교차로 ix_* + 끝점 end_*)"""
    from shapely.geometry import LineString
    from shapely.ops import substring

    free = (lab == CLASS["free"]).astype(np.uint8)
    free = cv2.morphologyEx(free, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    dist = cv2.distanceTransform(free, cv2.DIST_L2, 5)
    t = layout["meta"].get("wall_thickness_m", 0.3)
    bnd = Polygon(layout["boundary"]["polygon"])

    doors = layout.get("doors", [])
    door_masks = []
    door_mask = np.zeros_like(free)
    for d in doors:
        m = np.zeros_like(free)
        _fill(m, door_polygon(d, t * 2.5).buffer(0.3), r, 1)
        door_masks.append(m)
        door_mask |= m

    skel = _prune(skeletonize(free > 0), door_mask > 0, dist, r)
    if skel.sum() < 3:
        return [], []
    S = Skeleton(skel)
    df = summarize(S, separator="_")

    # --- 노드 만들기: 1m 안에 모인 교차 픽셀은 교차로 하나로 묶음
    node_rc = {}
    for _, row in df.iterrows():
        for key in ("node_id_src", "node_id_dst"):
            node_rc[int(row[key])] = S.coordinates[int(row[key])]
    junction = [n for n in node_rc if S.degrees[n] >= 3]
    cluster_of, clusters = {}, []
    # 두 교차점이 서로의 '빈 원'(벽까지 거리) 안에 있으면 같은 열린 공간이므로 하나로 합친다
    rad = {n: max(1.0 / r, 0.8 * dist[int(node_rc[n][0]), int(node_rc[n][1])]) for n in junction}
    for n in junction:
        for ci, c in enumerate(clusters):
            if any(np.hypot(*(node_rc[n] - node_rc[m])) <= min(rad[n], rad[m]) for m in c):
                c.append(n)
                cluster_of[n] = ci
                break
        else:
            clusters.append([n])
            cluster_of[n] = len(clusters) - 1

    nodes = {}
    for ci, c in enumerate(clusters):
        yy, xx = np.array([node_rc[n] for n in c], float).mean(0) * r
        nodes[f"ix_{ci + 1:02d}"] = {"id": f"ix_{ci + 1:02d}", "x": round(float(xx), 2), "y": round(float(yy), 2)}
    end_of = {}

    def node_id(n):
        if n in cluster_of:
            return f"ix_{cluster_of[n] + 1:02d}"
        if n not in end_of:
            yy, xx = node_rc[n]
            eid = f"end_{len(end_of) + 1:02d}"
            end_of[n] = eid
            door_id = next((doors[j]["id"] for j, m in enumerate(door_masks) if m[int(yy), int(xx)]), None)
            nodes[eid] = {"id": eid, "x": round(float(xx * r), 2), "y": round(float(yy * r), 2),
                          "kind": "door" if door_id else "dead_end", "door_id": door_id}
        return end_of[n]

    edges = []
    for i, row in df.iterrows():
        a, b = node_id(int(row["node_id_src"])), node_id(int(row["node_id_dst"]))
        length_m = float(row["branch_distance"]) * r
        if a == b and length_m < 2.0:       # 같은 교차로 안의 짧은 고리
            continue
        line = _rc_to_m(_simplify(S.path_coordinates(i)[:, :2], 0.2 / r), r)
        # 끝을 노드 좌표에 정확히 붙임
        line[0] = [nodes[a]["x"], nodes[a]["y"]]
        line[-1] = [nodes[b]["x"], nodes[b]["y"]]
        edges.append({"from": a, "to": b, "line": line})

    # --- 통로망에 연결되지 않은 출입구(넓은 화물 출입구 등)를 가장 가까운 통로에 연결
    for d in doors:
        if any(n.get("door_id") == d["id"] for n in nodes.values()):
            continue
        pin = Point(_door_inside_point(d, bnd, t))
        best = None
        for ei, e in enumerate(edges):
            Ls = LineString(e["line"])
            dd = Ls.distance(pin)
            if best is None or dd < best[0]:
                best = (dd, ei)
        if best is None:
            continue
        e = edges[best[1]]
        Ls = LineString(e["line"])
        s = Ls.project(pin)
        q = Ls.interpolate(s)
        if s < 0.5:
            hub = e["from"]
        elif s > Ls.length - 0.5:
            hub = e["to"]
        else:   # 통로 중간을 잘라 새 교차로를 만든다
            hub = f"ix_{len([k for k in nodes if k.startswith('ix_')]) + 1:02d}"
            nodes[hub] = {"id": hub, "x": round(q.x, 2), "y": round(q.y, 2)}
            first = [list(c) for c in substring(Ls, 0, s).coords]
            second = [list(c) for c in substring(Ls, s, Ls.length).coords]
            edges[best[1]] = {"from": e["from"], "to": hub, "line": first}
            edges.append({"from": hub, "to": e["to"], "line": second})
        eid = f"end_{len(end_of) + 1:02d}"
        end_of[("door", d["id"])] = eid
        nodes[eid] = {"id": eid, "x": round(d["cx"], 2), "y": round(d["cy"], 2), "kind": "door", "door_id": d["id"]}
        edges.append({"from": eid, "to": hub,
                      "line": [[nodes[eid]["x"], nodes[eid]["y"]], [round(pin.x, 2), round(pin.y, 2)],
                               [nodes[hub]["x"], nodes[hub]["y"]]]})

    # --- 연결 수가 2인 교차로(그냥 꺾이는 점)는 없애고 양쪽 통로를 하나로 합침
    while True:
        deg = {}
        for e in edges:
            for k in (e["from"], e["to"]):
                deg[k] = deg.get(k, 0) + 1
        two = [k for k, v in deg.items() if v == 2 and k.startswith("ix_")
               and sum((e["from"] == k) + (e["to"] == k) for e in edges) == 2
               and not any(e["from"] == k and e["to"] == k for e in edges)]
        if not two:
            break
        k = two[0]
        e1, e2 = [e for e in edges if k in (e["from"], e["to"])]
        l1 = e1["line"] if e1["to"] == k else e1["line"][::-1]
        a = e1["from"] if e1["to"] == k else e1["to"]
        l2 = e2["line"] if e2["from"] == k else e2["line"][::-1]
        b = e2["to"] if e2["from"] == k else e2["from"]
        edges = [e for e in edges if e is not e1 and e is not e2]
        edges.append({"from": a, "to": b, "line": l1 + l2[1:]})
        nodes.pop(k)

    # --- 번호를 다시 매기고 폭·길이 계산
    order = sorted(nodes.values(), key=lambda n: (not n["id"].startswith("ix_"), n["y"], n["x"]))
    rename, cnt = {}, {"ix": 0, "end": 0}
    for n in order:
        pre = "ix" if n["id"].startswith("ix_") else "end"
        cnt[pre] += 1
        rename[n["id"]] = f"{pre}_{cnt[pre]:02d}"
    aisles = []
    for e in sorted(edges, key=lambda e: (e["line"][0][1], e["line"][0][0])):
        L = LineString(e["line"])
        wmin, wmed = _width_stats(e["line"], dist, r)
        door_end = next((nodes[k]["door_id"] for k in (e["from"], e["to"])
                         if nodes[k].get("kind") == "door"), None)
        if door_end:   # 출입구 연결선: 폭은 출입구 폭으로 본다
            dw = next(d["width"] for d in doors if d["id"] == door_end)
            wmin = wmed = dw
            kind = "door_link"
        else:
            kind = "shared" if wmed >= opts["forklift_min_m"] else "narrow"
        aisles.append({"id": f"aisle_{len(aisles) + 1:02d}",
                       "centerline": [[round(x, 2), round(y, 2)] for x, y in e["line"]],
                       "length_m": round(L.length, 2), "width_min_m": round(wmin, 2),
                       "width_median_m": round(wmed, 2), "kind": kind,
                       "from": rename[e["from"]], "to": rename[e["to"]]})
    deg = {}
    for a in aisles:
        for k in (a["from"], a["to"]):
            deg[k] = deg.get(k, 0) + 1
    out_nodes = []
    for n in order:
        n = dict(n, id=rename[n["id"]])
        if n["id"].startswith("ix_"):
            n["degree"] = deg.get(n["id"], 0)
        out_nodes.append(n)
    return aisles, out_nodes


def check_issues(layout, lab, r, opts):
    issues = [i for i in layout.get("issues", []) if i.get("code") in ("SCALE_ASSUMED", "LOW_CONFIDENCE", "DETECTION_NOTE")]
    objs = layout.get("objects", [])
    polys = [object_polygon(o) for o in objs]
    for i in range(len(objs)):
        for j in range(i + 1, len(objs)):
            if polys[i].intersection(polys[j]).area > 0.01:
                issues.append({"level": "warning", "code": "OBJECT_OVERLAP",
                               "message": f"{objs[i]['id']}와 {objs[j]['id']}가 겹칩니다.",
                               "target_ids": [objs[i]["id"], objs[j]["id"]]})
    bnd = Polygon(layout["boundary"]["polygon"])
    for o, p in zip(objs, polys):
        if not bnd.buffer(0.05).contains(p):
            issues.append({"level": "error", "code": "OUTSIDE_BOUNDARY",
                           "message": f"{o['id']}가 작업장 바깥으로 나가 있습니다.", "target_ids": [o["id"]]})
    if not layout.get("doors"):
        issues.append({"level": "error", "code": "NO_DOOR", "message": "출입구를 찾지 못했습니다. 직접 지정해 주세요.",
                       "target_ids": []})
    for a in layout.get("aisles", []):
        if a["width_min_m"] < opts["pedestrian_min_m"]:
            issues.append({"level": "warning", "code": "NARROW_AISLE",
                           "message": f"{a['id']} 최소 폭 {a['width_min_m']}m — 보행 최소 폭 {opts['pedestrian_min_m']}m보다 좁습니다.",
                           "target_ids": [a["id"]]})
        elif a["kind"] == "narrow":
            issues.append({"level": "info", "code": "FORKLIFT_BLOCKED",
                           "message": f"{a['id']} 폭 {a['width_median_m']}m — 지게차 기준 {opts['forklift_min_m']}m 미만이라 보행 전용 후보입니다.",
                           "target_ids": [a["id"]]})
    # 출입구와 이어지지 않은 빈 공간
    free = (lab == CLASS["free"]).astype(np.uint8)
    n, cc, stats, _ = cv2.connectedComponentsWithStats(free, connectivity=4)
    door_mask = np.zeros_like(free)
    t = layout["meta"].get("wall_thickness_m", 0.3)
    for d in layout.get("doors", []):
        _fill(door_mask, door_polygon(d, t * 2.5).buffer(0.2), r, 1)
    reach = set(np.unique(cc[(door_mask > 0) & (free > 0)])) - {0}
    for c in range(1, n):
        area = stats[c, cv2.CC_STAT_AREA] * r * r
        if c not in reach and area >= 1.0:
            x, y = stats[c, cv2.CC_STAT_LEFT] * r, stats[c, cv2.CC_STAT_TOP] * r
            issues.append({"level": "warning", "code": "UNREACHABLE_AREA",
                           "message": f"출입구와 이어지지 않는 빈 공간 {area:.1f}㎡ (위치 약 x={x:.1f}, y={y:.1f}m)",
                           "target_ids": []})
    return issues


def analyze_layout(layout: dict, **kw) -> dict:
    opts = {**DEFAULTS, **kw}
    r = opts["raster_m"]
    lab = rasterize(layout, r)
    # 개구부(출입구)는 벽이 아니라 통과 가능한 공간으로 본다
    t = layout["meta"].get("wall_thickness_m", 0.3)
    bnd = Polygon(layout["boundary"]["polygon"])
    for d in layout.get("doors", []):
        m = np.zeros_like(lab)
        _fill(m, door_polygon(d, t * 2.2).intersection(bnd), r, 1)
        lab[(m > 0) & (lab == CLASS["wall"])] = CLASS["free"]
    for d in layout.get("doors", []):
        d["type"] = d.get("type") or ("dock" if d["width"] >= opts["door_dock_m"] else "door")
    aisles, nodes = aisle_network(layout, lab, r, opts)
    layout["aisles"] = aisles
    layout["intersections"] = [n for n in nodes if n["id"].startswith("ix_")]
    layout["endpoints"] = [n for n in nodes if n["id"].startswith("end_")]
    layout["grid"], _ = make_grid(layout, opts["cell_m"], r, lab)
    layout["issues"] = check_issues(layout, lab, r, opts)
    return layout
