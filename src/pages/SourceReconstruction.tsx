import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { CircleMarker, Circle, Polygon, Polyline, Tooltip } from 'react-leaflet';
import OceanMap from '../components/map/OceanMap';
import {
  mockEnvironmentalInputs,
  mockObservedSlickCoords,
  mockSourceZones,
} from '../data/mockData';

type LatLng = [number, number];
type ClusterId = 'A' | 'B' | 'C' | 'drift';

const CYAN = '#00B8D4';
const AMBER = '#F59E0B';
const FLAGSHIP = 'INC-204';

const MAX_K = 6;
const STEP_LABELS = ['NOW', 'T-6H', 'T-12H', 'T-18H', 'T-24H', 'T-30H', 'T-36H'];
const STEP_CAPTIONS = [
  'DETECTION INSTANT — ENSEMBLE SEEDED ACROSS ALL OBSERVED FRAGMENTS',
  'PARTICLES BEGIN BACKWARD ADVECTION THROUGH REVERSING CURRENT FIELD',
  'WIND-DRIVEN TRANSPORT DOMINATES — ENSEMBLE SPREAD WIDENS',
  'CURRENT REGIME SHIFTS — TRAJECTORIES SEPARATE INTO DISTINCT BRANCHES',
  'PROBABILITY ACCUMULATES — CANDIDATE SOURCE REGIONS EMERGE',
  'DOMINANT HYPOTHESIS STABILIZES — SECONDARY ZONES PERSIST',
  'FULL 36 H HINDCAST — UNCERTAINTY ENVELOPE AT MAXIMUM',
];

const DETECTION_MS = Date.parse('2026-08-18T04:32:00Z');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const FORCING_BY_STEP = [
  { wind: '18 KM/H · SW', current: '1.2 M/S · NE' },
  { wind: '19 KM/H · SW', current: '1.1 M/S · NNE' },
  { wind: '21 KM/H · WSW', current: '1.3 M/S · NNE' },
  { wind: '16 KM/H · SW', current: '1.0 M/S · NE' },
  { wind: '14 KM/H · SSW', current: '1.4 M/S · NE' },
  { wind: '15 KM/H · SW', current: '1.2 M/S · ENE' },
  { wind: '17 KM/H · WSW', current: '1.1 M/S · NE' },
];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function syntheticFragment(center: LatLng, bearingDeg: number, lenKm: number, widKm: number): LatLng[] {
  const k = Math.PI / 180;
  const brg = bearingDeg * k;
  const shape: [number, number][] = [
    [0.05, 0],
    [0.3, 0.4],
    [0.62, 0.48],
    [0.9, 0.26],
    [1.0, -0.08],
    [0.78, -0.4],
    [0.4, -0.46],
    [0.12, -0.24],
  ];
  return shape.map(([a, p]) => {
    const along = (a - 0.5) * lenKm;
    const perp = p * (widKm / 2);
    const north = along * Math.cos(brg) - perp * Math.sin(brg);
    const east = along * Math.sin(brg) + perp * Math.cos(brg);
    return [center[0] + north / 111, center[1] + east / (111 * Math.cos(center[0] * k))] as LatLng;
  });
}

function pointInPoly(pt: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function sampleInPoly(poly: LatLng[], rng: () => number): LatLng {
  const lats = poly.map(p => p[0]);
  const lngs = poly.map(p => p[1]);
  const [latMin, latMax] = [Math.min(...lats), Math.max(...lats)];
  const [lngMin, lngMax] = [Math.min(...lngs), Math.max(...lngs)];
  for (let attempt = 0; attempt < 500; attempt++) {
    const pt: LatLng = [latMin + rng() * (latMax - latMin), lngMin + rng() * (lngMax - lngMin)];
    if (pointInPoly(pt, poly)) return pt;
  }
  return [(latMin + latMax) / 2, (lngMin + lngMax) / 2];
}

function convexHull(points: LatLng[]): LatLng[] {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: LatLng[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LatLng[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

const CORRIDORS: Record<ClusterId, LatLng[]> = {
  A: [[12.857, 80.35], [12.852, 80.338], [12.845, 80.325], [12.84, 80.317]],
  B: [[12.857, 80.35], [12.838, 80.368], [12.81, 80.392], [12.792, 80.404]],
  C: [[12.857, 80.35], [12.868, 80.325], [12.888, 80.298], [12.902, 80.282]],
  drift: [[12.857, 80.35], [12.862, 80.41], [12.9, 80.46], [12.948, 80.515]],
};

const CLUSTER_WEIGHTS: [ClusterId, number][] = [
  ['A', 0.66],
  ['B', 0.83],
  ['C', 0.91],
];

interface Particle {
  cluster: ClusterId;
  pts: LatLng[];
}

interface Simulation {
  particles: Particle[];
  fragments: { id: string; poly: LatLng[] }[];
  density: number[][];
  densityMax: number[];
  spreadKm: number[];
  hulls: Record<'A' | 'B' | 'C', LatLng[]>[];
}

function buildSimulation(): Simulation {
  const rng = mulberry32(20260818);
  const spare = { value: 0, ready: false };
  const gauss = () => {
    if (spare.ready) {
      spare.ready = false;
      return spare.value;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare.value = mag * Math.sin(2 * Math.PI * v);
    spare.ready = true;
    return mag * Math.cos(2 * Math.PI * v);
  };

  const fragments = [
    { id: 'F-1', poly: mockObservedSlickCoords as unknown as LatLng[], count: 148 },
    { id: 'F-2', poly: syntheticFragment([12.838, 80.393], 118, 3.4, 1.5), count: 55 },
    { id: 'F-3', poly: syntheticFragment([12.885, 80.322], 205, 2.6, 1.2), count: 37 },
  ];

  const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

  const corridorPos = (wps: LatLng[], s: number): LatLng => {
    const seg = Math.min(wps.length - 1 - 1e-6, s * (wps.length - 1));
    const i = Math.floor(seg);
    const f = smoother(seg - i);
    return [lerp(wps[i][0], wps[i + 1][0], f), lerp(wps[i][1], wps[i + 1][1], f)];
  };

  const corridorNormal = (wps: LatLng[], s: number): LatLng => {
    const e = 0.01;
    const a = corridorPos(wps, clamp01(s - e));
    const b = corridorPos(wps, clamp01(s + e));
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-9;
    return [-dy / len, dx / len];
  };

  function clamp01(v: number) {
    return Math.min(1, Math.max(0, v));
  }

  const particles: Particle[] = [];
  const STEPS = 12;

  for (const frag of fragments) {
    for (let n = 0; n < frag.count; n++) {
      const r = rng();
      let cluster: ClusterId = 'drift';
      for (const [cid, w] of CLUSTER_WEIGHTS) {
        if (r < w) {
          cluster = cid;
          break;
        }
      }
      const wps = CORRIDORS[cluster];
      const baseSeed = sampleInPoly(frag.poly, rng);
      const lateral = gauss() * (cluster === 'drift' ? 0.012 : 0.006);
      const lateralSign = gauss() > 0 ? 1 : -1;
      const phase = rng() * 100;
      const lag = 0.82 + rng() * 0.36;

      const pts: LatLng[] = [];
      for (let jj = 0; jj <= STEPS; jj++) {
        const raw = jj / STEPS;
        const s = clamp01(raw * lag);
        const base = corridorPos(wps, s);
        const nrm = corridorNormal(wps, s);
        const grow = Math.exp(1.45 * s) - 1;
        const off =
          lateral * lateralSign * grow +
          0.0016 * (raw + 0.25) * Math.sin(phase * 1.7 + raw * 9.4) +
          0.0011 * (raw + 0.25) * Math.cos(phase * 2.3 + raw * 12.1);
        const turb = 0.0009 * (raw + 0.2) * Math.sin(phase * 3.1 + raw * 21);
        const target: LatLng = [
          base[0] + nrm[0] * off + turb,
          base[1] + nrm[1] * off - turb * 0.6,
        ];
        const w = clamp01(raw / 0.25);
        pts.push([
          baseSeed[0] * (1 - w) + target[0] * w,
          baseSeed[1] * (1 - w) + target[1] * w,
        ]);
      }
      particles.push({ cluster, pts });
    }
  }

  const GRID_NX = 18;
  const GRID_NY = 16;
  const LAT_MIN = 12.7;
  const LAT_MAX = 13.02;
  const LNG_MIN = 80.2;
  const LNG_MAX = 80.58;

  const density: number[][] = [];
  const densityMax: number[] = [];
  const spreadKm: number[] = [];

  for (let k = 0; k <= MAX_K; k++) {
    const grid = Array.from({ length: GRID_NX * GRID_NY }, () => 0);
    let sx = 0;
    let sy = 0;
    for (const p of particles) {
      const [la, ln] = p.pts[k * 2];
      sx += la;
      sy += ln;
      const gx = Math.floor(((ln - LNG_MIN) / (LNG_MAX - LNG_MIN)) * GRID_NX);
      const gy = Math.floor(((la - LAT_MIN) / (LAT_MAX - LAT_MIN)) * GRID_NY);
      if (gx >= 0 && gx < GRID_NX && gy >= 0 && gy < GRID_NY) grid[gy * GRID_NX + gx]++;
    }
    let variance = 0;
    for (const p of particles) {
      const [la, ln] = p.pts[k * 2];
      variance += (la - sx / particles.length) ** 2 + ((ln - sy / particles.length) * 0.978) ** 2;
    }
    spreadKm.push(Math.sqrt(variance / particles.length) * 111);
    density.push(grid);
    densityMax.push(Math.max(...grid, 1));
  }

  const hulls: Record<'A' | 'B' | 'C', LatLng[]>[] = [];
  for (let k = 0; k <= MAX_K; k++) {
    const build = (cid: 'A' | 'B' | 'C') => {
      const pts = particles.filter(p => p.cluster === cid).map(p => p.pts[k * 2]);
      return pts.length >= 6 ? convexHull(pts) : [];
    };
    hulls.push({ A: build('A'), B: build('B'), C: build('C') });
  }

  return { particles, fragments, density, densityMax, spreadKm, hulls };
}

const SIM = buildSimulation();

function fmtSimTime(k: number): string {
  const d = new Date(DETECTION_MS - k * 6 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} · ${String(
    d.getUTCHours()
  ).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

export default function SourceReconstruction() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selectedZone, setSelectedZone] = useState<'A' | 'B' | 'C' | null>(null);

  useEffect(() => {
    if (!playing || k >= MAX_K) return;
    const t = setTimeout(() => {
      if (k + 1 >= MAX_K) setPlaying(false);
      setK(k + 1);
    }, 1400 / speed);
    return () => clearTimeout(t);
  }, [playing, k, speed]);

  const j = k * 2;
  const zonesEmerged = k >= 4;
  const zoneAlpha = Math.min(1, Math.max(0, (k - 3) / 2.5));
  const densityAlpha = Math.min(1, 0.35 + k * 0.12);
  const forcing = FORCING_BY_STEP[k];

  const densityCells: { center: LatLng; ratio: number }[] = [];
  const grid = SIM.density[k];
  for (let gy = 0; gy < 16; gy++) {
    for (let gx = 0; gx < 18; gx++) {
      const c = grid[gy * 18 + gx];
      if (c >= 2) {
        densityCells.push({
          center: [12.7 + (gy + 0.5) * (0.32 / 16), 80.2 + (gx + 0.5) * (0.38 / 18)],
          ratio: c / SIM.densityMax[k],
        });
      }
    }
  }

  const toggleZone = (z: 'A' | 'B' | 'C') => setSelectedZone(prev => (prev === z ? null : z));

  const zoneExtentKm = (z: 'A' | 'B' | 'C') => {
    const h = SIM.hulls[k][z];
    if (!h || h.length < 3) return null;
    return Math.hypot(h[0][0] - h[2][0], h[0][1] - h[2][1]) * 111;
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-[10]">
        <OceanMap center={[12.85, 80.38]} zoom={11}>
          {SIM.fragments.map((frag, fi) => (
            <Polygon
              key={frag.id}
              positions={frag.poly}
              pathOptions={{
                color: CYAN,
                weight: fi === 0 ? 2 : 1.3,
                opacity: 0.9,
                fillColor: CYAN,
                fillOpacity: fi === 0 ? 0.09 : 0.06,
              }}
            >
              <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.95}>
                <span className="font-mono text-[9px] tracking-wider">
                  {fi === 0 ? 'OBSERVED SLICK · T₀ EVIDENCE' : `${frag.id} · OBSERVED FRAGMENT`}
                </span>
              </Tooltip>
            </Polygon>
          ))}

          {densityCells.map((cell, ci) => (
            <Circle
              key={`d-${ci}`}
              center={cell.center}
              radius={900}
              interactive={false}
              pathOptions={{
                stroke: false,
                fillColor: AMBER,
                fillOpacity: Math.min(0.42, cell.ratio * 0.5) * densityAlpha,
              }}
            />
          ))}

          {SIM.particles.map((p, pi) => (
            <Polyline
              key={`t-${pi}`}
              positions={p.pts.slice(0, j + 1)}
              interactive={false}
              pathOptions={{ color: CYAN, weight: 0.7, opacity: k === 0 ? 0 : 0.14 }}
            />
          ))}

          {SIM.particles.map((p, pi) => (
            <CircleMarker
              key={`h-${pi}`}
              center={p.pts[j]}
              radius={2}
              interactive={false}
              pathOptions={{
                stroke: false,
                fillColor: p.cluster === 'drift' ? '#94A3B8' : '#67E8F9',
                fillOpacity: k === 0 ? 0.65 : 0.5,
              }}
            />
          ))}

          {zonesEmerged &&
            (['A', 'B', 'C'] as const).map(z => {
              const hull = SIM.hulls[k][z];
              if (hull.length < 3) return null;
              const zone = mockSourceZones.find(zn => zn.id === `ZONE ${z}`);
              const sel = selectedZone === z;
              return (
                <Polygon
                  key={`zone-${z}`}
                  positions={hull}
                  pathOptions={{
                    color: AMBER,
                    weight: sel ? 2 : 1.2,
                    opacity: (sel ? 0.95 : 0.6) * zoneAlpha,
                    dashArray: z === 'A' ? undefined : '4 4',
                    fillColor: AMBER,
                    fillOpacity: (sel ? 0.12 : 0.06) * zoneAlpha,
                  }}
                  eventHandlers={{ click: () => toggleZone(z) }}
                >
                  <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.95}>
                    <span className="font-mono text-[9px] tracking-wider">
                      ZONE {z} · {zone?.probability ?? '—'}%
                    </span>
                  </Tooltip>
                </Polygon>
              );
            })}
        </OceanMap>
      </div>

      <div className="pointer-events-none absolute left-5 top-4 z-[500]">
        <p className="font-mono text-[10px] tracking-[0.18em] text-slate-300">
          BACKWARD ENSEMBLE HINDCAST · OT-HINDCAST v2.4
        </p>
        <p className={`mt-1 font-mono text-[10px] tracking-[0.16em] ${playing ? 'text-accent-cyan animate-pulse' : 'text-slate-500'}`}>
          {playing ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED'} · {STEP_LABELS[k]} · {SIM.particles.length} PARTICLES
        </p>
      </div>

      <div className="pointer-events-none absolute bottom-5 left-5 z-[500] flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          {[
            { swatch: <span className="inline-block h-2 w-3.5 border border-accent-cyan" />, label: 'OBSERVED SLICK · EVIDENCE (F-1…F-3)' },
            { swatch: <span className="inline-block h-px w-4 bg-accent-cyan/50" />, label: 'BACKWARD TRAJECTORY' },
            { swatch: <span className="inline-block h-2 w-2 rounded-full bg-accent-amber/60" />, label: 'PROBABILITY DENSITY' },
            { swatch: <span className="inline-block h-2 w-3.5 border border-dashed border-accent-amber" />, label: 'SOURCE REGION (EMERGENT)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              {item.swatch}
              <span className="font-mono text-[9px] tracking-[0.12em] text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="max-w-[340px] font-mono text-[9px] leading-relaxed tracking-[0.08em] text-slate-500">
          FRAGMENTS F-1…F-3 ARE SIMULATED AS INDEPENDENT SUB-ENSEMBLES CONTRIBUTING TO ONE PROBABILITY FIELD.
        </p>
      </div>

      <aside className="absolute inset-y-0 right-0 z-[500] flex w-[340px] flex-col border-l border-slate-700/40 bg-abyssal/90 backdrop-blur-md">
        <div className="custom-scrollbar flex-1 divide-y divide-slate-800/60 overflow-y-auto">
          <section className="px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">ENVIRONMENTAL FORCING</h3>
            <dl className="mt-3 space-y-2">
              {[
                ['SURFACE CURRENT', forcing.current],
                ['WIND', forcing.wind],
                ['DIFFUSION', `K̄ ${(0.8 + k * 0.26).toFixed(1)} M²/S`],
                ['ENSEMBLE SPREAD', `≈ ${SIM.spreadKm[k].toFixed(1)} KM`],
                ['SIMULATION WINDOW', 'NOW → T-36 H'],
                ['TIME STEP', mockEnvironmentalInputs.timeStep.toUpperCase()],
                ['PARTICLE COUNT', `${mockEnvironmentalInputs.simulationParticles} MODEL · ${SIM.particles.length} VISUAL`],
              ].map(([kk, vv]) => (
                <div key={kk} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 font-mono text-[9.5px] tracking-[0.1em] text-slate-500">{kk}</dt>
                  <dd className={`truncate text-right font-mono text-[10.5px] ${vv.startsWith('K̄') || vv.includes('SPREAD') ? 'text-accent-cyan' : 'text-slate-200'}`}>{vv}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">SOURCE HYPOTHESES</h3>
              <span className="font-mono text-[8.5px] tracking-[0.14em] text-slate-600">
                {zonesEmerged ? 'EMERGED FROM ENSEMBLE' : 'ACCUMULATING…'}
              </span>
            </div>

            {!zonesEmerged ? (
              <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-slate-600">
                RUN THE HINDCAST BACKWARD — HYPOTHESES APPEAR ONCE THE PARTICLE DISTRIBUTION STABILIZES.
              </p>
            ) : (
              <div className="mt-3 space-y-2 ot-fade-in">
                {(['A', 'B', 'C'] as const).map(z => {
                  const zone = mockSourceZones.find(zn => zn.id === `ZONE ${z}`);
                  if (!zone) return null;
                  const sel = selectedZone === z;
                  return (
                    <button
                      key={z}
                      onClick={() => toggleZone(z)}
                      className={`relative block w-full px-3 py-2.5 text-left transition-colors ${
                        sel ? 'bg-accent-amber/[0.07]' : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className="absolute inset-y-0 left-0 w-[2px]"
                        style={{ backgroundColor: AMBER, opacity: sel ? 1 : 0.4 }}
                      />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[11px] text-slate-100">{zone.id}</span>
                        <span className="font-mono text-[11px] text-accent-amber">{zone.probability}%</span>
                      </div>
                      <div className="mt-1.5 h-[2px] w-full bg-slate-800">
                        <div className="h-full bg-accent-amber/70" style={{ width: `${zone.probability}%` }} />
                      </div>
                      <dl className="mt-2 space-y-1">
                        <div className="flex justify-between gap-3">
                          <dt className="font-mono text-[9px] text-slate-500">SPATIAL EXTENT</dt>
                          <dd className="font-mono text-[9px] text-slate-300">
                            {zoneExtentKm(z) !== null ? `≈ ${zoneExtentKm(z)!.toFixed(1)} KM · IRREGULAR` : '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="font-mono text-[9px] text-slate-500">RELEASE WINDOW</dt>
                          <dd className="font-mono text-[9px] text-slate-300">{zone.estimatedWindow.toUpperCase()}</dd>
                        </div>
                      </dl>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-accent-amber/90">UNCERTAINTY</h3>
            <p className="mt-2.5 text-[11px] leading-relaxed text-slate-300">
              Probability regions expand because environmental uncertainty accumulates as the simulation moves
              backward in time.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Multiple regions can remain plausible simultaneously — probabilities express relative likelihood,
              not proof of origin. The ensemble is seeded across the full observed area, including disconnected
              fragments, never from a single assumed origin point.
            </p>
          </section>
        </div>

        <footer className="border-t border-slate-800/60 p-3">
          {zonesEmerged ? (
            <button
              onClick={() => navigate(`/investigations/${id ?? FLAGSHIP}/vessels`)}
              className="group flex w-full items-center justify-between px-1 py-1 text-left"
            >
              <span className="font-mono text-[10px] tracking-[0.18em] text-accent-cyan transition-colors group-hover:text-white">
                CONTINUE TO VESSEL CORRELATION
              </span>
              <ChevronRight size={14} className="text-accent-cyan transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="block px-1 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-600">
              COMPLETE HINDCAST TO CONTINUE
            </span>
          )}
        </footer>
      </aside>

      <div className="absolute bottom-5 left-1/2 z-[500] flex w-[860px] -translate-x-1/2 items-center gap-5 border border-slate-700/40 bg-abyssal/90 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setK(prev => Math.max(0, prev - 1))}
            disabled={k === 0}
            className="flex h-7 w-7 items-center justify-center text-slate-400 transition-colors hover:text-white disabled:opacity-30"
            aria-label="Previous time step"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => {
              if (k >= MAX_K) setK(0);
              setPlaying(prev => !prev);
            }}
            className="flex h-9 w-9 items-center justify-center border border-accent-cyan/40 text-accent-cyan transition-colors hover:bg-accent-cyan/10"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setK(prev => Math.min(MAX_K, prev + 1));
            }}
            disabled={k === MAX_K}
            className="flex h-7 w-7 items-center justify-center text-slate-400 transition-colors hover:text-white disabled:opacity-30"
            aria-label="Next time step"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-1 font-mono text-[9px] tracking-[0.12em] text-slate-500">
          <span>SPEED</span>
          <div className="flex gap-px">
            {[0.5, 1, 2].map(sv => (
              <button
                key={sv}
                onClick={() => setSpeed(sv)}
                className={`px-2 py-0.5 transition-colors ${
                  speed === sv ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {sv}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="relative h-6">
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-800" />
            <div
              className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-accent-cyan/70 transition-all duration-500"
              style={{ width: `${(k / MAX_K) * 100}%` }}
            />
            {STEP_LABELS.map((label, i) => (
              <button
                key={label}
                onClick={() => {
                  setPlaying(false);
                  setK(i);
                }}
                className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${(i / MAX_K) * 100}%` }}
              >
                <span
                  className={`block h-2.5 w-2.5 rotate-45 border transition-colors ${
                    i <= k ? 'border-accent-cyan bg-accent-cyan' : 'border-slate-600 bg-abyssal group-hover:border-slate-400'
                  }`}
                />
              </button>
            ))}
          </div>
          <div className="relative mt-1 h-3">
            {STEP_LABELS.map((label, i) => (
              <span
                key={label}
                className={`absolute -translate-x-1/2 font-mono text-[8.5px] tracking-[0.1em] ${
                  i <= k ? 'text-slate-300' : 'text-slate-600'
                }`}
                style={{ left: `${(i / MAX_K) * 100}%` }}
              >
                {label}
              </span>
            ))}
          </div>
          <p className="mt-1 truncate text-center font-mono text-[8.5px] tracking-[0.14em] text-slate-500">
            {STEP_CAPTIONS[k]}
          </p>
        </div>

        <div className="text-right">
          <p className="font-mono text-lg leading-none text-slate-100">{STEP_LABELS[k]}</p>
          <p className="mt-1 font-mono text-[9px] tabular-nums text-slate-500">{fmtSimTime(k)}</p>
        </div>
      </div>
    </div>
  );
}
