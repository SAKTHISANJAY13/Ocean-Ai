import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { Circle, CircleMarker, Polygon, Polyline, Tooltip } from 'react-leaflet';
import OceanMap from '../components/map/OceanMap';
import { mockObservedSlickCoords, mockVessels } from '../data/mockData';

type LatLng = [number, number];

const CYAN = '#00B8D4';
const AMBER = '#F59E0B';
const FLAGSHIP = 'INC-204';
const DETECTION_MS = Date.parse('2026-08-18T04:32:00Z');

interface TrackPt {
  ll: LatLng;
  h: number;
  tag?: string;
}

const VESSEL_TRACKS: Record<string, TrackPt[]> = {
  'VSL-001': [
    { ll: [12.74, 80.44], h: 34 },
    { ll: [12.78, 80.395], h: 29 },
    { ll: [12.805, 80.352], h: 26.3 },
    { ll: [12.822, 80.334], h: 24.6 },
    { ll: [12.833, 80.323], h: 23.1, tag: 'gapStart' },
    { ll: [12.846, 80.317], h: 21.2, tag: 'gapEnd' },
    { ll: [12.856, 80.306], h: 19.7 },
    { ll: [12.868, 80.29], h: 16 },
    { ll: [12.872, 80.3], h: 11 },
    { ll: [12.862, 80.312], h: 5 },
    { ll: [12.84, 80.32], h: 0 },
  ],
  'VSL-002': [
    { ll: [12.72, 80.52], h: 33 },
    { ll: [12.755, 80.475], h: 27 },
    { ll: [12.772, 80.445], h: 22 },
    { ll: [12.782, 80.428], h: 16 },
    { ll: [12.788, 80.418], h: 9 },
    { ll: [12.79, 80.41], h: 0 },
  ],
  'VSL-003': [
    { ll: [12.985, 80.205], h: 30 },
    { ll: [12.962, 80.225], h: 24 },
    { ll: [12.94, 80.245], h: 18 },
    { ll: [12.925, 80.258], h: 10 },
    { ll: [12.91, 80.27], h: 0 },
  ],
};

const RELEASE_DEFAULTS: Record<string, { idx: number; h: number }> = {
  'VSL-001': { idx: 4, h: 23 },
  'VSL-002': { idx: 2, h: 22 },
  'VSL-003': { idx: 2, h: 18 },
};

const IDEAL_RELEASE_H: Record<string, number> = {
  'VSL-001': 24,
  'VSL-002': 21,
  'VSL-003': 18,
};

const FORCING_BY_STEP = [
  '1.2 M/S · NE',
  '1.1 M/S · NNE',
  '1.3 M/S · NNE',
  '1.0 M/S · NE',
  '1.4 M/S · NE',
  '1.2 M/S · ENE',
  '1.1 M/S · NE',
  '1.2 M/S · NE',
  '1.3 M/S · NE',
  '1.2 M/S · NE',
  '1.1 M/S · NNE',
  '1.2 M/S · NE',
  '1.0 M/S · NE',
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

function centroidOf(pts: LatLng[]): LatLng {
  let la = 0;
  let ln = 0;
  for (const p of pts) {
    la += p[0];
    ln += p[1];
  }
  return [la / pts.length, ln / pts.length];
}

function polyAreaKm2(poly: LatLng[]): number {
  let sum = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    sum += (poly[j][1] - poly[i][1]) * (poly[i][0] * 111 + poly[j][0] * 111);
  }
  return Math.abs(sum) / 2;
}

function axisRatio(pts: LatLng[]): number {
  const c = centroidOf(pts);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const x = (p[1] - c[1]) * 107.5;
    const y = (p[0] - c[0]) * 111;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const n = pts.length;
  const tr = sxx / n + syy / n;
  const det = (sxx / n) * (syy / n) - (sxy / n) ** 2;
  const disc = Math.sqrt(Math.max(0, (tr / 2) ** 2 - det));
  const l1 = tr / 2 + disc;
  const l2 = Math.max(1e-9, tr / 2 - disc);
  return Math.sqrt(l1 / l2);
}

function rmsRadiusKm(pts: LatLng[]): number {
  const c = centroidOf(pts);
  let s = 0;
  for (const p of pts) {
    const dy = (p[0] - c[0]) * 111;
    const dx = (p[1] - c[1]) * 107.5;
    s += dy * dy + dx * dx;
  }
  return Math.sqrt(s / pts.length);
}

const OBS_CENTROID = centroidOf(mockObservedSlickCoords as unknown as LatLng[]);
const OBS_POLY = mockObservedSlickCoords as unknown as LatLng[];
const OBS_AREA = polyAreaKm2(OBS_POLY);
const OBS_SIGMA = Math.sqrt(OBS_AREA / Math.PI);
const OBS_AR = axisRatio(OBS_POLY);

interface SimResult {
  J: number;
  detIdx: number;
  pts: LatLng[][];
  density: { cells: { center: LatLng; ratio: number }[] };
  metrics: {
    spatial: number;
    shape: number;
    temporal: number;
    environmental: number;
    overall: number;
    insideFrac: number;
    deltaKm: number;
    sigmaSimKm: number;
    verdict: string;
    verdictNote: string;
  } | null;
  simDetCentroid: LatLng;
}

function buildForwardSim(vesselId: string, release: LatLng, relH: number, extrapH: number): SimResult {
  const J = Math.max(2, Math.round((relH + extrapH) / 3));
  const detIdx = Math.min(J, Math.max(1, Math.round(relH / 3)));
  const seed = relH * 7919 + release[0] * 100000 + release[1] * 1000;
  const rng = mulberry32(Math.round(seed));
  const spare = { v: 0, ready: false };
  const gauss = () => {
    if (spare.ready) {
      spare.ready = false;
      return spare.v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare.v = mag * Math.sin(2 * Math.PI * v);
    spare.ready = true;
    return mag * Math.cos(2 * Math.PI * v);
  };

  const N = 260;
  const toRad = Math.PI / 180;

  const particles: LatLng[][] = [];
  for (let i = 0; i < N; i++) {
    const spd = 0.115 + rng() * 0.155;
    const ang = (45 + (rng() - 0.5) * 40) * toRad;
    const ph1 = rng() * 100;
    const ph2 = rng() * 100;
    const latJit = gauss() * 0.004;
    const lngJit = gauss() * 0.004;
    const pts: LatLng[] = [];
    for (let j = 0; j <= J; j++) {
      const hrs = (j / J) * (relH + extrapH);
      const grow = Math.exp(0.85 * (hrs / Math.max(relH, 1))) - 1;
      pts.push([
        release[0] + ((spd * Math.cos(ang) * hrs) / 111) + latJit * grow * 0.5 + 0.0011 * Math.sin(ph1 + hrs * 0.9) * grow,
        release[1] + ((spd * Math.sin(ang) * hrs) / (111 * Math.cos(release[0] * toRad))) + lngJit * grow * 0.5 + 0.0011 * Math.cos(ph2 + hrs * 1.1) * grow,
      ]);
    }
    particles.push(pts);
  }

  const LAT_MIN = 12.66;
  const LAT_MAX = 13.04;
  const LNG_MIN = 80.16;
  const LNG_MAX = 80.64;
  const GNX = 30;
  const GNY = 24;

  const buildCells = (step: number) => {
    const grid = new Array(GNX * GNY).fill(0);
    for (const p of particles) {
      const [la, ln] = p[step];
      const gx = Math.floor(((ln - LNG_MIN) / (LNG_MAX - LNG_MIN)) * GNX);
      const gy = Math.floor(((la - LAT_MIN) / (LAT_MAX - LAT_MIN)) * GNY);
      if (gx >= 0 && gx < GNX && gy >= 0 && gy < GNY) grid[gy * GNX + gx]++;
    }
    const maxC = Math.max(...grid, 1);
    const cells: { center: LatLng; ratio: number }[] = [];
    for (let gy = 0; gy < GNY; gy++) {
      for (let gx = 0; gx < GNX; gx++) {
        const c = grid[gy * GNX + gx];
        if (c >= 2) {
          cells.push({
            center: [LAT_MIN + (gy + 0.5) * ((LAT_MAX - LAT_MIN) / GNY), LNG_MIN + (gx + 0.5) * ((LNG_MAX - LNG_MIN) / GNX)],
            ratio: c / maxC,
          });
        }
      }
    }
    return cells;
  };

  const density = { cells: buildCells(detIdx) };

  const detPts = particles.map(p => p[detIdx]);
  const simDetCentroid = centroidOf(detPts);
  let inside = 0;
  for (const p of detPts) if (pointInPoly(p, OBS_POLY)) inside++;
  const insideFrac = inside / N;
  const deltaKm = Math.hypot(
    (simDetCentroid[0] - OBS_CENTROID[0]) * 111,
    (simDetCentroid[1] - OBS_CENTROID[1]) * 107.5
  );
  const sigmaSimKm = rmsRadiusKm(detPts);
  const arSim = axisRatio(detPts);

  const base = mockVessels.find(v => v.id === vesselId)?.hypothesisMatchScores ?? {
    spatial: 50,
    shape: 50,
    temporal: 50,
    environmental: 50,
    overall: 50,
  };

  const clamp01 = (v: number) => Math.min(100, Math.max(0, v));
  const spatial = Math.round(clamp01(100 * (0.82 * insideFrac + 0.18 * Math.exp(-deltaKm / 6))));
  const shape = Math.round(clamp01(100 * Math.exp(-(Math.abs(Math.log(sigmaSimKm / OBS_SIGMA)) * 1.1 + Math.abs(Math.log(arSim / OBS_AR)) * 0.7))));
  const temporal = Math.round(clamp01(base.temporal - Math.abs(relH - (IDEAL_RELEASE_H[vesselId] ?? 24)) * 4));
  const brg = Math.atan2(simDetCentroid[1] - release[1], simDetCentroid[0] - release[0]) / toRad;
  const align = Math.max(0, Math.cos((brg - 45) * toRad));
  const environmental = Math.round(clamp01(base.environmental * 0.6 + align * 40));
  const overall = Math.round(spatial * 0.3 + shape * 0.2 + temporal * 0.25 + environmental * 0.25);

  let verdict = 'LOW CONSISTENCY';
  let verdictNote =
    'The simulated distribution does not align well with the observed evidence under these hypothesis parameters.';
  if (insideFrac < 0.08 || overall < 34) {
    verdict = 'INSUFFICIENT EVIDENCE';
    verdictNote = 'The simulated transport cannot reasonably connect this release configuration to the observed feature.';
  } else if (overall >= 72) {
    verdict = 'HIGHLY CONSISTENT';
    verdictNote = 'A release at this location and time could plausibly produce the observed feature through recorded environmental transport.';
  } else if (overall >= 50) {
    verdict = 'PARTIALLY CONSISTENT';
    verdictNote = 'Elements of the simulated evolution match the observation, but significant discrepancies remain.';
  }

  return {
    J,
    detIdx,
    pts: particles,
    density,
    simDetCentroid,
    metrics: {
      spatial,
      shape,
      temporal,
      environmental,
      overall,
      insideFrac,
      deltaKm,
      sigmaSimKm,
      verdict,
      verdictNote,
    },
  };
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, '0')} AUG · ${String(d.getUTCHours()).padStart(2, '0')}:${String(
    d.getUTCMinutes()
  ).padStart(2, '0')} UTC`;
}

const VERDICT_STYLE: Record<string, { color: string; border: string }> = {
  'HIGHLY CONSISTENT': { color: CYAN, border: 'rgba(0,184,212,0.5)' },
  'PARTIALLY CONSISTENT': { color: AMBER, border: 'rgba(245,158,11,0.45)' },
  'LOW CONSISTENCY': { color: '#94A3B8', border: 'rgba(148,163,184,0.4)' },
  'INSUFFICIENT EVIDENCE': { color: '#64748B', border: 'rgba(100,116,139,0.35)' },
};

export default function HypothesisTesting() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [vesselId, setVesselId] = useState('VSL-001');
  const [relIdx, setRelIdx] = useState(RELEASE_DEFAULTS['VSL-001'].idx);
  const [relH, setRelH] = useState(RELEASE_DEFAULTS['VSL-001'].h);
  const [extrapH, setExtrapH] = useState(0);
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const vessel = mockVessels.find(v => v.id === vesselId) ?? mockVessels[0];
  const track = VESSEL_TRACKS[vesselId];
  const releasePt = track[Math.min(relIdx, track.length - 1)].ll;

  const sim = useMemo(
    () => buildForwardSim(vesselId, releasePt, relH, extrapH),
    [vesselId, releasePt, relH, extrapH]
  );

  useEffect(() => {
    if (!playing || k >= sim.J) return;
    const t = setTimeout(() => setK(k + 1), 900 / speed);
    return () => clearTimeout(t);
  }, [playing, k, sim.J, speed]);

  const kc = Math.min(k, sim.J);
  const compareActive = kc >= sim.detIdx;
  const extrapolating = kc > sim.detIdx;
  const totalH = relH + extrapH;
  const detPct = (relH / totalH) * 100;
  const clockMs = DETECTION_MS - relH * 3600 * 1000 + kc * 3 * 3600 * 1000;

  const selectVessel = (vid: string) => {
    setVesselId(vid);
    setRelIdx(RELEASE_DEFAULTS[vid].idx);
    setRelH(RELEASE_DEFAULTS[vid].h);
    setExtrapH(0);
    setK(0);
    setPlaying(false);
  };

  const caption = extrapolating
    ? 'EXTRAPOLATION BEYOND SATELLITE FIX — COMPARISON FROZEN AT DETECTION TIME'
    : compareActive
      ? 'DETECTION TIME — SIMULATED VS OBSERVED COMPARISON ACTIVE'
      : 'FORWARD TRANSPORT IN PROGRESS — PARTICLE ENSEMBLE ADVECTING';

  const metrics = sim.metrics;
  const vs = metrics ? VERDICT_STYLE[metrics.verdict] : null;

  const metricRows = metrics
    ? ([
        ['SPATIAL CONSISTENCY', metrics.spatial, `${(metrics.insideFrac * 100).toFixed(0)}% OF ENSEMBLE WITHIN OBSERVED BOUNDARY · CENTROID OFFSET ${metrics.deltaKm.toFixed(1)} KM`],
        ['SHAPE CONSISTENCY', metrics.shape, `SIMULATED SPREAD ≈ ${metrics.sigmaSimKm.toFixed(1)} KM VS OBSERVED ≈ ${OBS_SIGMA.toFixed(1)} KM`],
        ['TEMPORAL CONSISTENCY', metrics.temporal, `${relH} H AVAILABLE — FEASIBLE FOR RECORDED DRIFT REGIME`],
        ['ENVIRONMENTAL CONSISTENCY', metrics.environmental, `REQUIRED TRANSPORT DIRECTION VS CURRENT ${FORCING_BY_STEP[Math.min(kc, FORCING_BY_STEP.length - 1)]}`],
      ] as [string, number, string][])
    : [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      <main className="relative flex-1 overflow-hidden bg-[#01070f]">
        <OceanMap center={[12.855, 80.36]} zoom={11}>
          <Polygon
            positions={OBS_POLY}
            pathOptions={{ color: CYAN, weight: 2, opacity: 0.95, fillColor: CYAN, fillOpacity: 0.05 }}
          >
            <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.95}>
              <span className="font-mono text-[9px] tracking-wider">OBSERVED SLICK · SATELLITE EVIDENCE</span>
            </Tooltip>
          </Polygon>

          <Polyline
            positions={track.slice(0, relIdx + 1).map(p => p.ll)}
            interactive={false}
            pathOptions={{ color: '#64748B', weight: 1.5, opacity: 0.55 }}
          />
          <Polyline
            positions={track.slice(relIdx).map(p => p.ll)}
            interactive={false}
            pathOptions={{ color: CYAN, weight: 2, opacity: 0.8 }}
          />
          {track.map((p, i) => (
            <CircleMarker
              key={`tp-${i}`}
              center={p.ll}
              radius={i === relIdx ? 0 : 2.2}
              interactive={i !== relIdx}
              pathOptions={{ color: '#94A3B8', weight: 1, fillColor: '#334155', fillOpacity: 0.7 }}
            >
              <Tooltip direction="top" className="custom-tooltip" opacity={1}>
                <div className="font-mono text-[9px] text-white">{vessel.name}</div>
                <div className="font-mono text-[8px] text-slate-400">{fmtClock(DETECTION_MS - p.h * 3600 * 1000)}</div>
              </Tooltip>
            </CircleMarker>
          ))}

          <CircleMarker center={track[relIdx].ll} radius={0} interactive={false} pathOptions={{ opacity: 0 }} />

          {kc > 0 &&
            sim.pts.map((pts, pi) => (
              <Polyline
                key={`tr-${pi}`}
                positions={[pts[kc - 1], pts[kc]]}
                interactive={false}
                pathOptions={{ color: '#67E8F9', weight: 0.8, opacity: 0.16 }}
              />
            ))}

          {kc > 0 &&
            sim.pts.map((pts, pi) => (
              <CircleMarker
                key={`ph-${pi}`}
                center={pts[kc]}
                radius={1.8}
                interactive={false}
                pathOptions={{
                  stroke: false,
                  fillColor: kc >= sim.detIdx ? '#BAE6FD' : '#67E8F9',
                  fillOpacity: 0.55,
                }}
              />
            ))}

          {sim.density.cells.map((cell, ci) => (
            <Circle
              key={`dc-${ci}`}
              center={cell.center}
              radius={700}
              interactive={false}
              pathOptions={{
                stroke: false,
                fillColor: AMBER,
                fillOpacity: Math.min(0.4, cell.ratio * 0.5) * (kc === 0 ? 0.35 : 1),
              }}
            />
          ))}

          <CircleMarker
            center={releasePt}
            radius={6}
            pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: CYAN, fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="custom-tooltip" permanent opacity={1}>
              <span className="font-mono text-[9px] tracking-wider">HYPOTHETICAL RELEASE · T-{relH}H</span>
            </Tooltip>
          </CircleMarker>
          <CircleMarker
            center={releasePt}
            radius={13}
            interactive={false}
            pathOptions={{ stroke: false, fillColor: CYAN, fillOpacity: 0.3, className: 'ot-marker-halo' }}
          />

          {compareActive && (
            <>
              <CircleMarker center={sim.simDetCentroid} radius={3} pathOptions={{ color: AMBER, weight: 1.5, fillColor: '#020B18', fillOpacity: 0.8 }}>
                <Tooltip direction="bottom" className="custom-tooltip" permanent opacity={0.95}>
                  <span className="font-mono text-[8.5px]" style={{ color: AMBER }}>SIM CENTROID</span>
                </Tooltip>
              </CircleMarker>
              <CircleMarker center={OBS_CENTROID} radius={3} pathOptions={{ color: CYAN, weight: 1.5, fillColor: '#020B18', fillOpacity: 0.8 }}>
                <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.95}>
                  <span className="font-mono text-[8.5px]">OBS CENTROID</span>
                </Tooltip>
              </CircleMarker>
              <Polyline
                positions={[OBS_CENTROID, sim.simDetCentroid]}
                interactive={false}
                pathOptions={{ color: '#94A3B8', weight: 1.2, dashArray: '3 4', opacity: 0.8 }}
              />
              <CircleMarker
                center={[(OBS_CENTROID[0] + sim.simDetCentroid[0]) / 2, (OBS_CENTROID[1] + sim.simDetCentroid[1]) / 2]}
                radius={0}
                interactive={false}
                pathOptions={{ opacity: 0 }}
              >
                <Tooltip direction="right" className="custom-tooltip" permanent opacity={0.9}>
                  <span className="font-mono text-[8.5px] text-slate-300">
                    Δ {metrics ? metrics.deltaKm.toFixed(1) : '—'} KM
                  </span>
                </Tooltip>
              </CircleMarker>
            </>
          )}
        </OceanMap>

        <div className="pointer-events-none absolute left-4 top-4 z-[500]">
          <p className="font-mono text-[10px] tracking-[0.16em] text-slate-200">
            FORWARD HYPOTHESIS TEST · {vessel.name}
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-slate-500">
            RELEASE {fmtClock(DETECTION_MS - relH * 3600 * 1000)} · {sim.pts.length} PARTICLES · OT-DRIFT v2.1
          </p>
        </div>

        <div className="absolute right-4 top-4 z-[500] flex flex-col items-end gap-1">
          <span className="font-mono text-[8.5px] tracking-[0.18em] text-slate-600">CANDIDATE</span>
          {mockVessels.map(v => (
            <button
              key={v.id}
              onClick={() => selectVessel(v.id)}
              className={`border px-2 py-1 font-mono text-[9px] tracking-[0.1em] transition-colors ${
                v.id === vesselId
                  ? 'border-accent-cyan/60 bg-accent-cyan/10 text-accent-cyan'
                  : 'border-slate-700/60 bg-abyssal/80 text-slate-400 hover:text-white'
              }`}
            >
              {v.name.replace('MV ', '')}
            </button>
          ))}
        </div>

        <div className="pointer-events-none absolute bottom-[124px] left-4 z-[500] flex flex-col gap-1.5">
          {[
            { swatch: <span className="inline-block h-2 w-3.5 border-2 border-accent-cyan" />, label: 'OBSERVED SLICK (EVIDENCE)' },
            { swatch: <span className="inline-block h-2 w-2 rounded-full bg-accent-amber/70" />, label: 'SIMULATED DENSITY' },
            { swatch: <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-200" />, label: 'SIMULATED PARTICLES' },
            { swatch: <span className="inline-block h-px w-4 bg-accent-cyan" />, label: 'VESSEL TRACK (POST-RELEASE)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              {item.swatch}
              <span className="font-mono text-[9px] tracking-[0.12em] text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-[76px] left-1/2 z-[500] flex w-[720px] -translate-x-1/2 items-center gap-4 border border-slate-700/40 bg-abyssal/90 px-4 py-2 backdrop-blur-md">
          <div className="flex flex-1 items-center gap-3">
            <span className="shrink-0 font-mono text-[8.5px] tracking-[0.14em] text-slate-500">RELEASE TIME</span>
            <input
              type="range"
              min={14}
              max={34}
              value={relH}
              onChange={e => {
                setRelH(Number(e.target.value));
                setK(0);
                setPlaying(false);
              }}
              className="w-full accent-cyan-500"
            />
            <span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-slate-200">T-{relH}H</span>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <span className="shrink-0 font-mono text-[8.5px] tracking-[0.14em] text-slate-500">RELEASE PT</span>
            <input
              type="range"
              min={1}
              max={track.length - 2}
              value={Math.min(relIdx, track.length - 2)}
              onChange={e => {
                setRelIdx(Number(e.target.value));
                setK(0);
                setPlaying(false);
              }}
              className="w-full accent-cyan-500"
            />
            <span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-slate-200">W{relIdx}</span>
          </div>
          <div className="flex flex-1 items-center gap-3">
            <span className="shrink-0 font-mono text-[8.5px] tracking-[0.14em] text-slate-500">EXTEND</span>
            <input
              type="range"
              min={0}
              max={9}
              step={3}
              value={extrapH}
              onChange={e => {
                setExtrapH(Number(e.target.value));
                setK(0);
                setPlaying(false);
              }}
              className="w-full accent-cyan-500"
            />
            <span className="w-12 shrink-0 font-mono text-[10px] tabular-nums text-slate-200">+{extrapH}H</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 z-[500] flex w-[720px] -translate-x-1/2 items-center gap-4 border border-slate-700/40 bg-abyssal/90 px-4 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setPlaying(false);
                setK(prev => Math.max(0, prev - 1));
              }}
              disabled={kc === 0}
              className="flex h-7 w-7 items-center justify-center text-slate-400 transition-colors hover:text-white disabled:opacity-30"
              aria-label="Previous step"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => {
                if (kc >= sim.J) setK(0);
                setPlaying(p => !p);
              }}
              className="flex h-8 w-8 items-center justify-center border border-accent-cyan/40 text-accent-cyan transition-colors hover:bg-accent-cyan/10"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                setK(prev => Math.min(sim.J, prev + 1));
              }}
              disabled={kc === sim.J}
              className="flex h-7 w-7 items-center justify-center text-slate-400 transition-colors hover:text-white disabled:opacity-30"
              aria-label="Next step"
            >
              <ChevronRight size={14} />
            </button>
            <div className="ml-1 flex gap-px font-mono text-[9px]">
              {[0.5, 1, 2].map(sv => (
                <button
                  key={sv}
                  onClick={() => setSpeed(sv)}
                  className={`px-1.5 py-0.5 transition-colors ${
                    speed === sv ? 'bg-accent-cyan/15 text-accent-cyan' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {sv}×
                </button>
              ))}
            </div>
          </div>

          <div className="relative flex-1">
            <div className="relative h-5">
              <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-800" />
              <div
                className="absolute left-0 top-1/2 h-px -translate-y-1/2 bg-accent-cyan/70 transition-all duration-500"
                style={{ width: `${(kc / sim.J) * 100}%` }}
              />
              {Array.from({ length: sim.J + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setPlaying(false);
                    setK(i);
                  }}
                  className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${(i / sim.J) * 100}%` }}
                >
                  <span
                    className={`block ${i % 2 === 0 ? 'h-2 w-2' : 'h-1.5 w-1.5'} rotate-45 border transition-colors ${
                      i <= kc ? 'border-accent-cyan bg-accent-cyan' : 'border-slate-600 bg-abyssal group-hover:border-slate-400'
                    }`}
                  />
                </button>
              ))}
              <span
                className="pointer-events-none absolute top-1/2 h-4 w-[2px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${detPct}%`, backgroundColor: AMBER }}
              />
              <span
                className="pointer-events-none absolute top-full mt-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[7.5px] tracking-[0.1em]"
                style={{ left: `${detPct}%`, color: AMBER }}
              >
                DETECTION
              </span>
            </div>
            <p className="mt-2 truncate text-center font-mono text-[8.5px] tracking-[0.12em] text-slate-500">{caption}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="font-mono text-base leading-none text-slate-100">T+{kc * 3}H</p>
            <p className="mt-1 font-mono text-[8.5px] tabular-nums text-slate-500">{fmtClock(clockMs)}</p>
          </div>
        </div>
      </main>

      <aside className="flex w-[350px] shrink-0 flex-col border-l border-slate-800/70 bg-navy/50">
        <header className="border-b border-slate-800/60 px-4 pb-3 pt-4">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-slate-200">RECONSTRUCTION COMPARISON</h2>
          <p className="mt-1 truncate font-mono text-[9px] tracking-[0.1em] text-slate-500">
            {vessel.name} · MMSI {vessel.mmsi}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="border border-slate-700/60 px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.08em] text-slate-400">
              REL {releasePt[0].toFixed(3)}°N {releasePt[1].toFixed(3)}°E
            </span>
            <span className="border border-slate-700/60 px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.08em] text-slate-400">
              T-{relH}H → DETECTION
            </span>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 divide-y divide-slate-800/60 overflow-y-auto">
          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">CONSISTENCY INDICATORS</h3>
              {!compareActive && (
                <span className="font-mono text-[8.5px] tracking-[0.12em] text-slate-600">ADVANCE TO DETECTION TIME</span>
              )}
              {compareActive && extrapolating && (
                <span className="font-mono text-[8.5px] tracking-[0.12em] text-accent-amber">EXTRAPOLATION VIEW</span>
              )}
            </div>

            {!compareActive ? (
              <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-slate-600">
                RUN THE SIMULATION FORWARD TO THE SATELLITE DETECTION TIME TO COMPARE THE SIMULATED DISTRIBUTION
                AGAINST THE OBSERVED SLICK.
              </p>
            ) : (
              <div className="mt-3 space-y-3 ot-fade-in">
                {metricRows.map(([label, val, note]) => (
                  <div key={label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[9.5px] tracking-[0.1em] text-slate-300">{label}</span>
                      <span className={`font-mono text-[10.5px] ${val > 80 ? 'text-accent-cyan' : val > 50 ? 'text-accent-amber' : 'text-slate-500'}`}>
                        {val}
                      </span>
                    </div>
                    <div className="mt-1 h-[2px] w-full bg-slate-800">
                      <div
                        className="h-full transition-all duration-700"
                        style={{ width: `${val}%`, backgroundColor: val > 80 ? CYAN : val > 50 ? AMBER : '#475569' }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[8.5px] leading-relaxed tracking-[0.05em] text-slate-600">{note}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">TEST OUTCOME</h3>
            {compareActive && metrics && vs ? (
              <div className="mt-3 ot-fade-in">
                <div className="border-l-2 py-1.5 pl-3" style={{ borderColor: vs.border }}>
                  <p className="font-mono text-sm tracking-[0.14em]" style={{ color: vs.color }}>
                    {metrics.verdict}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{metrics.verdictNote}</p>
                </div>
                <p className="mt-2.5 text-[10px] italic leading-relaxed text-slate-500">
                  Consistency describes how well this hypothetical release matches the observed evidence. It does
                  not establish causation, responsibility, or guilt — that requires corroborating reconstruction
                  and investigation.
                </p>
              </div>
            ) : (
              <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-slate-600">PENDING SIMULATION RUN…</p>
            )}
          </section>

          <section className="px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">TEST QUESTION</h3>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              If oil had been released here, at this time — could the recorded environmental conditions realistically
              produce the slick observed by satellite?
            </p>
            <dl className="mt-3 space-y-1.5">
              {[
                ['TRANSPORT MODEL', 'CURRENT + WINDAGE + DIFFUSION'],
                ['ENSEMBLE SIZE', `${sim.pts.length} PARTICLES`],
                ['TIME STEP', '3 H'],
                ['COMPARISON FIX', `${mockObservedSlickCoords.length}-VERTEX SAR POLYGON`],
              ].map(([kk, vv]) => (
                <div key={kk} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 font-mono text-[9px] tracking-[0.08em] text-slate-500">{kk}</dt>
                  <dd className="truncate font-mono text-[9px] text-slate-300">{vv}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <footer className="border-t border-slate-800/60 p-3">
          <button
            onClick={() => navigate(`/investigations/${id ?? FLAGSHIP}/report`)}
            className="group flex w-full items-center justify-between px-1 py-1 text-left"
          >
            <span className="font-mono text-[10px] tracking-[0.18em] text-accent-cyan transition-colors group-hover:text-white">
              RECORD FINDINGS · CONTINUE TO REPORT
            </span>
            <ChevronRight size={14} className="text-accent-cyan transition-transform group-hover:translate-x-0.5" />
          </button>
        </footer>
      </aside>
    </div>
  );
}
