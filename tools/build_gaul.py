"""Build src/data/gaul.js from Natural Earth (public domain) + researched coordinates.
Projection: spherical Lambert azimuthal equal-area centred on Gaul (lat0 47, lon0 2.5),
fitted to the map's existing viewBox 0 0 400 420.

Usage:  GEO_DIR=path/to/geo python3 tools/build_gaul.py src/data/gaul.js
GEO_DIR must contain (Natural Earth, public domain, from
https://github.com/nvkelso/natural-earth-vector/tree/master/geojson):
  ne_50m_land.geojson, ne_50m_lakes.geojson, ne_10m_rivers_lake_centerlines.geojson"""
import json, math, os, sys

GEO = os.environ.get('GEO_DIR', 'geo')  # folder with the Natural Earth GeoJSON files
OUT = sys.argv[1]
W, H = 400, 420
LAT0, LON0 = math.radians(47.0), math.radians(2.5)
BBOX = (-5.6, 42.0, 10.6, 52.3)  # lon/lat frame: Gaul + Kent/Thames + Rhine


def laea(lon, lat):
    p, l = math.radians(lat), math.radians(lon) - LON0
    k = math.sqrt(2 / (1 + math.sin(LAT0) * math.sin(p) + math.cos(LAT0) * math.cos(p) * math.cos(l)))
    return k * math.cos(p) * math.sin(l), k * (math.cos(LAT0) * math.sin(p) - math.sin(LAT0) * math.cos(p) * math.cos(l))


pts = [laea(x, y) for x in (BBOX[0], (BBOX[0] + BBOX[2]) / 2, BBOX[2]) for y in (BBOX[1], (BBOX[1] + BBOX[3]) / 2, BBOX[3])]
minx, maxx = min(p[0] for p in pts), max(p[0] for p in pts)
miny, maxy = min(p[1] for p in pts), max(p[1] for p in pts)
S = min(W / (maxx - minx), H / (maxy - miny))
OX = (W - (maxx - minx) * S) / 2 - minx * S
OY = (H - (maxy - miny) * S) / 2 + maxy * S


def P(lon, lat):
    x, y = laea(lon, lat)
    return (x * S + OX, OY - y * S)


def dp(points, tol):
    if len(points) < 3:
        return points
    keep = [False] * len(points); keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]; bx, by = points[b]
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy) or 1e-9
        best, bi = -1, -1
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > best:
                best, bi = d, i
        if best > tol:
            keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(points, keep) if k]


def dp_ring(points, tol):
    # a closed ring starts and ends on the same point: simplify its two halves separately
    if len(points) < 6:
        return points
    m = len(points) // 2
    return dp(points[:m + 1], tol)[:-1] + dp(points[m:], tol)


M = 30


def clip_poly(poly, x0=-M, y0=-M, x1=W + M, y1=H + M):
    def clip(pts, inside, cut):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
        return out

    def xcut(xv):
        return lambda a, b: (xv, a[1] + (b[1] - a[1]) * (xv - a[0]) / ((b[0] - a[0]) or 1e-9))

    def ycut(yv):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (yv - a[1]) / ((b[1] - a[1]) or 1e-9), yv)

    for inside, cut in ((lambda p: p[0] >= x0, xcut(x0)), (lambda p: p[0] <= x1, xcut(x1)),
                        (lambda p: p[1] >= y0, ycut(y0)), (lambda p: p[1] <= y1, ycut(y1))):
        if not poly:
            break
        poly = clip(poly, inside, cut)
    return poly


def fmt(p):
    return f'{p[0]:.1f},{p[1]:.1f}'


def ring_d(pts, close=True):
    return 'M' + ' L'.join(fmt(p) for p in pts) + (' Z' if close else '')


def area(pts):
    return 0.5 * sum(pts[i - 1][0] * p[1] - p[0] * pts[i - 1][1] for i, p in enumerate(pts))


land = json.load(open(f'{GEO}/ne_50m_land.geojson'))
cont, isles = [], []
for f in land['features']:
    g = f['geometry']
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    for poly in polys:
        ring = poly[0]
        if not any(BBOX[0] - 3 < x < BBOX[2] + 3 and BBOX[1] - 3 < y < BBOX[3] + 3 for x, y in ring):
            continue
        pr = clip_poly(dp_ring([P(x, y) for x, y in ring], 0.35))
        if len(pr) < 3 or abs(area(pr)) < 6:
            continue
        cx = sum(x for x, _ in ring) / len(ring); cy = sum(y for _, y in ring) / len(ring)
        (isles if (cy > 49.8 and cx < 2.0) else cont).append(pr)
LAND = ' '.join(ring_d(r) for r in cont)
BRITAIN = ' '.join(ring_d(r) for r in isles)

NAMES = {
    'rhin': ('Rhein', 'Rhin', 'Rhine', 'Nederrijn', 'Waal', 'Lek'), 'rhone': ('Rhône', 'Rhne'), 'saone': ('Saône', 'Sane'),
    'seine': ('Seine',), 'loire': ('Loire',), 'garonne': ('Garonne',), 'meuse': ('Maas', 'Meuse'), 'moselle': ('Mosel', 'Moselle'),
    'marne': ('Marne',), 'yonne': ('Yonne',), 'dordogne': ('Dordogne',), 'doubs': ('Doubs',), 'thames': ('Thames',),
    'vienne': ('Vienne',), 'tarn': ('Tarn',), 'escaut': ('Schelde',), 'durance': ('Durance',),
}
MAJOR = {'rhin', 'rhone', 'seine', 'loire', 'garonne'}
rv = json.load(open(f'{GEO}/ne_10m_rivers_lake_centerlines.geojson'))
rivers = {}
for f in rv['features']:
    n = f['properties'].get('name')
    rid = next((k for k, v in NAMES.items() if n in v), None)
    if not rid:
        continue
    g = f['geometry']
    lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
    for line in lines:
        run = []
        for x, y in line + [(999, 999)]:
            p = P(x, y) if abs(x) < 900 else None
            if p and -M < p[0] < W + M and -M < p[1] < H + M:
                run.append(p)
            else:
                if len(run) > 1:
                    rivers.setdefault(rid, []).append(dp(run, 0.45))
                run = []
RIVERS = [{'id': k, 'major': k in MAJOR, 'd': ' '.join(ring_d(l, False) for l in ls)} for k, ls in rivers.items()]
lk = json.load(open(f'{GEO}/ne_50m_lakes.geojson'))
LAKES = []
for f in lk['features']:
    g = f['geometry']
    for poly in (g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]):
        ring = poly[0]
        if all(BBOX[0] < x < BBOX[2] and BBOX[1] < y < BBOX[3] for x, y in ring[::5]):
            pr = dp_ring([P(x, y) for x, y in ring], 0.3)
            if abs(area(pr)) > 2:
                LAKES.append(ring_d(pr))

SEEDS = {  # several centres per region so cells follow the peoples (e.g. Treveri are Belgic)
    'belgae': [(50.0, 3.6), (49.75, 6.4), (49.5, 2.0)], 'armorica': [(47.9, -2.6), (48.6, -0.9)],
    'aquitania': [(44.0, -0.4), (43.3, 0.6)], 'arverni': [(46.3, 2.2), (45.3, 2.8), (47.6, 1.4)],
    'aedui': [(47.0, 4.3), (47.3, 6.0), (47.95, 5.3), (48.2, 3.5)], 'helvetii': [(46.85, 7.5)],
}
LABEL_AT = {'belgae': (49.95, 3.9), 'armorica': (47.95, -2.0), 'aquitania': (44.55, -0.85),
            'arverni': (45.95, 2.0), 'aedui': (46.45, 4.5), 'helvetii': (46.7, 7.95)}
seedp = [(k, P(lon, lat)) for k, pts in SEEDS.items() for lat, lon in pts]
big = [(-200, -200), (W + 200, -200), (W + 200, H + 200), (-200, H + 200)]


def halfplane(poly, a, b):
    mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2; nx, ny = b[0] - a[0], b[1] - a[1]
    f = lambda p: (p[0] - mx) * nx + (p[1] - my) * ny
    out = []
    for i, cur in enumerate(poly):
        prev = poly[i - 1]; fc, fp = f(cur), f(prev)
        if fc <= 0:
            if fp > 0:
                t = fp / (fp - fc); out.append((prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t))
            out.append(cur)
        elif fp <= 0:
            t = fp / (fp - fc); out.append((prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t))
    return out


REGION_NAMES = {'belgae': ('Belges', 'Belgae', 57), 'armorica': ('Vénètes', 'Veneti', 56), 'aquitania': ('Aquitains', 'Aquitani', 56),
                'arverni': ('Arvernes', 'Arverni', 53), 'aedui': ('Éduens', 'Aedui', 58), 'helvetii': ('Helvètes', 'Helvetii', 58)}
cells = {}
for i, (k, a) in enumerate(seedp):
    cell = big
    for j, (_, b) in enumerate(seedp):
        if j != i:
            cell = halfplane(cell, a, b)
    cells.setdefault(k, []).append(ring_d(cell))
REGIONS = []
for k in SEEDS:
    fr, en, yr = REGION_NAMES[k]
    lx, ly = P(LABEL_AT[k][1], LABEL_AT[k][0])
    REGIONS.append({'id': k, 'name': {'fr': fr, 'en': en}, 'label': [round(lx), round(ly)], 'd': ' '.join(cells[k]), 'year': yr})

PROV = [(42.3, 1.7), (42.8, 1.3), (43.6, 1.1), (44.1, 1.9), (44.3, 3.0), (44.9, 4.0), (45.6, 4.6), (45.95, 5.25),
        (46.15, 5.9), (46.3, 6.4), (46.1, 7.0), (45.4, 7.1), (44.6, 7.0), (43.9, 7.6), (43.3, 8.2), (41.0, 8.2), (41.0, 1.7)]
pl = P(4.35, 43.95)
PROVINCE = {'id': 'province', 'name': {'fr': 'Province romaine', 'en': 'Roman Province'}, 'label': [round(pl[0]), round(pl[1])],
            'd': ring_d(clip_poly([P(lon, lat) for lat, lon in PROV]))}

# Gaul's outer border c. 58 BC (approx.): the Rhine, the Alps crest, the Pyrenees; drawn out into the sea
GAUL_B = [(51.95, 3.2), (51.9, 4.1), (51.85, 6.1), (51.4, 6.6), (50.9, 7.0), (50.35, 7.6), (50.0, 8.25), (49.4, 8.45),
          (48.6, 7.85), (47.9, 7.55), (47.6, 7.6), (47.6, 8.6), (47.55, 9.6), (47.2, 9.6), (46.6, 9.3), (46.4, 8.4),
          (45.9, 7.0), (45.2, 6.9), (44.4, 6.95), (43.8, 7.5), (43.4, 7.7), (42.6, 7.7), (41.9, 3.4), (42.4, 3.15),
          (42.6, 2.0), (42.75, 0.7), (42.85, -0.3), (43.1, -1.4), (43.35, -1.8), (43.6, -3.5), (46.5, -6.8), (48.6, -6.6),
          (49.7, -2.5), (50.2, -0.5), (50.95, 1.45), (51.35, 2.4)]
GAUL = ring_d(clip_poly([P(lon, lat) for lat, lon in GAUL_B]))
NEIGH = {'germanie': (50.9, 9.3, 'Germanie', 'Germania'), 'hispanie': (42.25, -2.2, 'Hispanie', 'Hispania'),
         'italie': (44.9, 9.0, 'Italie', 'Italia'), 'bretagne': (51.65, -1.4, 'Bretagne', 'Britain'),
         'ocean': (46.3, -4.4, 'Océan', 'Ocean'), 'mer': (42.8, 5.4, 'Mer intérieure', 'Inner Sea')}
NEIGHBOURS = [{'id': k, 'x': round(P(lon, lat)[0]), 'y': round(P(lon, lat)[1]), 'name': {'fr': fr, 'en': en}}
              for k, (lat, lon, fr, en) in NEIGH.items()]

TOWNS = {
    'alesia': (47.5375, 4.4908, 'Alésia'), 'bibracte': (46.9231, 4.0375, 'Bibracte'), 'gergovie': (45.7083, 3.125, 'Gergovie'),
    'avaricum': (47.0794, 2.3958, 'Avaricum'), 'geneve': (46.204, 6.143, 'Genève'), 'vesontio': (47.24, 6.02, 'Vesontio'),
    'lutetia': (48.8567, 2.3522, 'Lutèce'), 'cenabum': (47.9025, 1.909, 'Cenabum'), 'narbo': (43.1836, 3.0042, 'Narbonne'),
    'massalia': (43.2964, 5.37, 'Marseille'), 'durocortorum': (49.2628, 4.0347, 'Reims'), 'agedincum': (48.1975, 3.2877, 'Sens'),
    'portus': (50.7264, 1.6147, 'Portus Itius'), 'deal': (51.2226, 1.4006, 'Deal'), 'rhinebridge': (50.43, 7.46, 'Pont du Rhin'),
    'sabis': (50.25, 3.85, 'Sabis'), 'quiberon': (47.48, -3.12, 'Quiberon'), 'uxellodunum': (44.82, 1.73, 'Uxellodunum'),
}
PLACES = {k: {'x': round(P(lon, lat)[0], 1), 'y': round(P(lon, lat)[1], 1), 'name': n} for k, (lat, lon, n) in TOWNS.items()}
PEOPLES = {
    'Arvernes': (45.5, 3.1), 'Éduens': (46.9, 4.3), 'Séquanes': (47.1, 6.2), 'Helvètes': (47.0, 7.4), 'Bituriges': (47.0, 2.2),
    'Carnutes': (48.2, 1.5), 'Sénons': (48.2, 3.3), 'Parisii': (48.7, 2.8), 'Rèmes': (49.3, 4.0), 'Nerviens': (50.3, 3.9),
    'Bellovaques': (49.4, 2.1), 'Trévires': (49.8, 6.6), 'Éburons': (50.8, 5.5), 'Vénètes': (47.6, -2.8), 'Aquitains': (44.0, -0.5),
    'Allobroges': (45.3, 5.4), 'Lingons': (47.9, 5.3), 'Mandubiens': (47.5, 4.5), 'Pictons': (46.5, -0.3), 'Santons': (45.7, -0.6),
    'Cadurques': (44.45, 1.44), 'Lémovices': (45.8, 1.3), 'Osismes': (48.4, -4.0), 'Andécaves': (47.5, -0.5), 'Turons': (47.4, 0.7),
    'Ambiens': (49.9, 2.3), 'Atrébates': (50.3, 2.8), 'Morins': (50.7, 2.0), 'Ménapes': (51.0, 3.5), 'Médiomatriques': (49.1, 6.2),
    'Leuques': (48.6, 5.8), 'Rauraques': (47.5, 7.6), 'Ségusiaves': (45.6, 4.1), 'Rutènes': (44.35, 2.6), 'Gabales': (44.5, 3.5),
    'Vellaves': (45.05, 3.85), 'Pétrocores': (45.2, 0.7), 'Nitiobroges': (44.2, 0.6), 'Volques': (43.6, 1.9), 'Helviens': (44.6, 4.4),
    'Voconces': (44.4, 5.3), 'Salyens': (43.6, 5.6), 'Namnètes': (47.2, -1.6), 'Redones': (48.1, -1.7), 'Unelles': (49.3, -1.4),
    'Lexoviens': (49.1, 0.2), 'Aulerques': (48.3, 0.2), 'Calètes': (49.7, 0.6), 'Véliocasses': (49.3, 1.4), 'Suessions': (49.4, 3.3),
    'Viromanduens': (49.85, 3.2), 'Tongres': (50.75, 5.4), 'Bataves': (51.8, 5.3), 'Médulles': (45.3, -1.0), 'Bituriges Vivisques': (44.9, -0.5),
    'Tarbelles': (43.6, -1.1), 'Ausques': (43.65, 0.6), 'Convènes': (43.1, 0.6), 'Consoranni': (42.95, 1.1), 'Tricasses': (48.3, 4.1),
}
PEOPLE = [{'n': n, 'x': round(P(lon, lat)[0], 1), 'y': round(P(lon, lat)[1], 1)} for n, (lat, lon) in PEOPLES.items()]
OPPIDA = [[p['x'], p['y']] for p in PEOPLE]
FIRES = []
for i in range(9):
    a = i * 2.39996; r = 0.35 + 0.08 * (i % 4)
    x, y = P(2.3 + r * 1.4 * math.cos(a), 47.05 + r * math.sin(a))
    FIRES.append([round(x, 1), round(y, 1)])

RIDGES = {
    'alpes': [(43.8, 7.35), (44.4, 6.9), (45.1, 6.95), (45.7, 6.9), (46.2, 7.4), (46.5, 8.4), (46.6, 9.4), (46.9, 10.5)],
    'pyrenees': [(42.45, 3.1), (42.6, 2.1), (42.7, 1.0), (42.8, 0.0), (42.95, -0.9), (43.15, -1.7)],
    'massif-central': [(44.3, 3.8), (44.8, 3.1), (45.4, 2.75), (45.9, 2.9)],
    'cevennes': [(43.9, 3.4), (44.35, 3.9), (44.9, 4.35)],
    'jura': [(46.2, 5.9), (46.6, 6.3), (47.0, 6.8), (47.4, 7.4)],
    'vosges': [(47.75, 6.95), (48.2, 7.1), (48.65, 7.25)],
    'ardennes': [(49.85, 4.6), (50.15, 5.35), (50.35, 6.15)],
}
MOUNTAINS = []
for k, pts in RIDGES.items():
    pp = [P(lon, lat) for lat, lon in pts]
    ticks = []
    for i in range(len(pp) - 1):
        (ax, ay), (bx, by) = pp[i], pp[i + 1]
        L = math.hypot(bx - ax, by - ay); n = max(2, int(L / 3.2))
        tx, ty = (bx - ax) / L, (by - ay) / L; nx, ny = -ty, tx
        for s in range(n):
            t = s / n; x, y = ax + (bx - ax) * t, ay + (by - ay) * t
            l1 = 5.5 + 2.0 * math.sin(i * 3 + s * 1.7); l2 = 3.2 + 1.2 * math.cos(s * 2.3)
            ticks.append(f'M{x:.1f},{y:.1f} l{nx * l1:.1f},{ny * l1:.1f}')
            ticks.append(f'M{x:.1f},{y:.1f} l{-nx * l2:.1f},{-ny * l2:.1f}')
    MOUNTAINS.append({'id': k, 'ridge': ring_d(pp, False), 'ticks': ' '.join(ticks)})

GRAT = []
for lon in range(-6, 12, 2):
    GRAT.append(ring_d([P(lon, lat / 4) for lat in range(41 * 4, 53 * 4 + 1)], False))
for lat in range(42, 54, 2):
    GRAT.append(ring_d([P(lon / 4, lat) for lon in range(-7 * 4, 12 * 4 + 1)], False))

js = f'''/*
 * Map of Gaul (viewBox 0 0 400 420) — generated by a build script from REAL geography:
 * coastline, rivers and lakes from Natural Earth (public domain, 1:50m / 1:10m), projected
 * with a Lambert azimuthal equal-area projection centred on Gaul (lat0 47°, lon0 2.5°).
 * Towns from Wikipedia coordinates. Peoples' centres, the six regions (Voronoi cells
 * around approximate centres) and the Province's 58 BC boundary are APPROXIMATE —
 * ancient borders weren't surveyed; this is a reconstruction for teaching.
 */
export const LAND = {json.dumps(LAND)};
export const BRITAIN = {json.dumps(BRITAIN)};
/* Gaul's outer border (approx.: the Rhine, the Alps, the Pyrenees) — clip for Gallic land */
export const GAUL = {json.dumps(GAUL)};
/* lands and seas around Gaul */
export const NEIGHBOURS = {json.dumps(NEIGHBOURS, ensure_ascii=False)};
export const LAKES = {json.dumps(LAKES)};
/* Regions are drawn larger than the land and clipped to it. */
export const REGIONS = {json.dumps(REGIONS, ensure_ascii=False)};
export const PROVINCE = {json.dumps(PROVINCE, ensure_ascii=False)};
export const RIVERS = {json.dumps(RIVERS)};
export const PLACES = {json.dumps(PLACES, ensure_ascii=False)};
/* the peoples of Gaul (approximate centres) */
export const PEOPLE = {json.dumps(PEOPLE, ensure_ascii=False)};
export const OPPIDA = {json.dumps(OPPIDA)};
/* villages burned in 52 (beat 7) — around the Bituriges' land */
export const FIRES = {json.dumps(FIRES)};
/* mountain ranges: ridge line + hachure ticks */
export const MOUNTAINS = {json.dumps(MOUNTAINS)};
/* graticule, every 2° */
export const GRATICULE = {json.dumps(' '.join(GRAT))};
/* project(lon, lat) → map px, for anything else placed on this map */
export const project = (lon, lat) => {{
  const r = Math.PI / 180; const p = lat * r; const l = lon * r - {LON0!r}; const p0 = {LAT0!r};
  const k = Math.sqrt(2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)));
  return [k * Math.cos(p) * Math.sin(l) * {S!r} + {OX!r}, {OY!r} - k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)) * {S!r}];
}};
'''
open(OUT, 'w').write(js)
print('bytes', len(js), 'land rings', len(cont), 'isles', len(isles), 'rivers', {r['id']: len(r['d']) for r in RIVERS}, 'lakes', len(LAKES))
print({k: (v['x'], v['y']) for k, v in PLACES.items()})
print({r['id']: r['label'] for r in REGIONS}, PROVINCE['label'])
