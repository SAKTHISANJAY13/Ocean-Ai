import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Circle, CircleMarker, Polygon, Polyline, Tooltip, useMap } from 'react-leaflet';
import OceanMap from '../components/map/OceanMap';
import {
  mockEnvironmentalInputs,
  mockIncidents,
  mockObservedSlickCoords,
  mockVessels,
} from '../data/mockData';

type LatLng = [number, number];
type Phase = 'running' | 'pending';

const CYAN = '#00B8D4';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const HOME_VIEW: LatLng = [13.5, 76.5];
const FOCUS_ZOOM = 9;
const FLAGSHIP = 'INC-204';

interface StageView {
  label: string;
  phase: Phase;
}

const STAGE_VIEW: Record<string, StageView> = {
  'INC-204': { label: 'SOURCE TRACE RUNNING', phase: 'running' },
  'INC-2026-037': { label: 'VESSEL CORRELATION ACTIVE', phase: 'running' },
  'INC-2026-039': { label: 'VERIFICATION PENDING', phase: 'pending' },
};

const REGION_KM: Record<string, number> = {
  'INC-204': 30,
  'INC-2026-037': 38,
  'INC-2026-039': 18,
};

const QUEUE_ORDER: Record<string, number> = {
  'INC-204': 0,
  'INC-2026-037': 1,
  'INC-2026-039': 2,
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function offsetKm(pos: LatLng, bearingDeg: number, km: number): LatLng {
  const k = Math.PI / 180;
  return [
    pos[0] + (km * Math.cos(bearingDeg * k)) / 111,
    pos[1] + (km * Math.sin(bearingDeg * k)) / (111 * Math.cos(pos[0] * k)),
  ];
}

function syntheticSlick(center: LatLng, bearingDeg: number, lenKm: number, widKm: number): LatLng[] {
  const k = Math.PI / 180;
  const brg = bearingDeg * k;
  const shape: [number, number][] = [
    [0.02, 0],
    [0.24, 0.36],
    [0.52, 0.46],
    [0.8, 0.3],
    [1.0, -0.04],
    [0.84, -0.34],
    [0.52, -0.42],
    [0.22, -0.28],
  ];
  return shape.map(([a, p]) => {
    const along = (a - 0.5) * lenKm;
    const perp = p * (widKm / 2);
    const north = along * Math.cos(brg) - perp * Math.sin(brg);
    const east = along * Math.sin(brg) + perp * Math.cos(brg);
    return [
      center[0] + north / 111,
      center[1] + east / (111 * Math.cos(center[0] * k)),
    ] as LatLng;
  });
}

function swath(a: LatLng, b: LatLng, halfWidthDeg: number): LatLng[] {
  const dLat = b[0] - a[0];
  const dLng = b[1] - a[1];
  const len = Math.hypot(dLat, dLng);
  const nx = -dLng / len;
  const ny = dLat / len;
  return [
    [a[0] + ny * halfWidthDeg, a[1] + nx * halfWidthDeg],
    [b[0] + ny * halfWidthDeg, b[1] + nx * halfWidthDeg],
    [b[0] - ny * halfWidthDeg, b[1] - nx * halfWidthDeg],
    [a[0] - ny * halfWidthDeg, a[1] - nx * halfWidthDeg],
  ];
}

function fmtUtc(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} · ${String(
    d.getUTCHours()
  ).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}Z`;
}

function fmtCoords(p: LatLng): string {
  return `${p[0].toFixed(2)}°N ${p[1].toFixed(2)}°E`;
}

function stateColor(id: string, phase: Phase): string {
  if (id === FLAGSHIP) return RED;
  return phase === 'pending' ? AMBER : CYAN;
}

const SLICK_GEOMETRY: Record<string, LatLng[]> = {
  'INC-204': mockObservedSlickCoords as unknown as LatLng[],
  'INC-2026-039': syntheticSlick([15.22, 69.45], 205, 9, 3),
  'INC-2026-037': syntheticSlick([10.55, 92.12], 150, 14, 4.5),
};

const FLOW_FIELD: LatLng[][] = (() => {
  const segs: LatLng[][] = [];
  for (let lat = 4.5; lat <= 21.5; lat += 2.05) {
    for (let lng = 66.5; lng <= 93.5; lng += 2.35) {
      const a = Math.sin(lat * 0.52) * 0.85 + Math.cos(lng * 0.41) * 0.95 + 0.55;
      const half = 0.17;
      segs.push([
        [lat - Math.sin(a) * half, lng - Math.cos(a) * half],
        [lat + Math.sin(a) * half, lng + Math.cos(a) * half],
      ]);
    }
  }
  return segs;
})();

const SWATHS = [
  { poly: swath([19.5, 68], [8.5, 77.5], 0.5), label: 'SAR ACQUISITION SWATH · DESCENDING PASS 11:18Z' },
  { poly: swath([16.5, 84.5], [9.5, 93], 0.45), label: 'SAR ACQUISITION SWATH · ASCENDING PASS 06:42Z' },
];

const VESSEL_TRACKS = mockVessels.map((vessel, vi) => {
  const base = vessel.lastKnownPosition as LatLng;
  const legs = [
    { brg: 208 + vi * 14, dist: 28 },
    { brg: 191 + vi * 9, dist: 17 },
    { brg: 224 + vi * 6, dist: 9 },
  ];
  const pts: LatLng[] = [];
  let cur = base;
  for (const leg of legs) {
    cur = offsetKm(cur, leg.brg + 180, leg.dist / legs.length + 4);
    pts.unshift(cur);
  }
  pts.push(base);
  return { vessel, track: pts };
});

function MapFocus({ selectedId }: { selectedId: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) {
      map.flyTo(HOME_VIEW, 5, { duration: 1.2 });
      return;
    }
    const inc = mockIncidents.find(i => i.id === selectedId);
    if (inc) map.flyTo(inc.coordinates as LatLng, FOCUS_ZOOM, { duration: 1.4 });
  }, [selectedId, map]);
  return null;
}

export default function Overview() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const queue = useMemo(
    () => [...mockIncidents].sort((a, b) => QUEUE_ORDER[a.id] - QUEUE_ORDER[b.id]),
    []
  );

  const activeCount = mockIncidents.length;
  const peakConfidence = Math.max(...mockIncidents.map(i => i.oilConfidence ?? 0));
  const contextId = selectedId ?? FLAGSHIP;
  const vesselsInContext =
    STAGE_VIEW[contextId].label === 'VESSEL CORRELATION ACTIVE' ? String(mockVessels.length).padStart(2, '0') : '—';
  const selectedPos = useMemo<LatLng | null>(() => {
    const inc = mockIncidents.find(i => i.id === selectedId);
    return inc ? (inc.coordinates as LatLng) : null;
  }, [selectedId]);

  const toggleSelect = (id: string) => setSelectedId(prev => (prev === id ? null : id));
  const dimFactor = (id: string) => (selectedId && id !== selectedId ? 0.4 : 1);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-[10]">
        <OceanMap center={HOME_VIEW} zoom={5}>
          <MapFocus selectedId={selectedId} />

          {FLOW_FIELD.map((seg, i) => (
            <Polyline
              key={`flow-${i}`}
              positions={seg}
              interactive={false}
              pathOptions={{ color: CYAN, weight: 1, opacity: 0.09, dashArray: '3 5', className: 'ot-env-flow' }}
            />
          ))}

          {SWATHS.map((s, i) => (
            <Polygon
              key={`swath-${i}`}
              positions={s.poly}
              pathOptions={{ color: CYAN, weight: 0.6, opacity: 0.07, fillColor: CYAN, fillOpacity: 0.03 }}
            >
              <Tooltip direction="top" className="custom-tooltip">
                <span className="text-[10px] font-mono text-slate-300">{s.label}</span>
              </Tooltip>
            </Polygon>
          ))}

          {mockIncidents.map(inc => {
            const st = STAGE_VIEW[inc.id];
            const col = stateColor(inc.id, st.phase);
            const d = dimFactor(inc.id);
            return (
              <Circle
                key={`region-${inc.id}`}
                center={inc.coordinates as LatLng}
                radius={REGION_KM[inc.id] * 1000}
                pathOptions={{
                  color: col,
                  weight: 1,
                  opacity: 0.4 * d,
                  dashArray: '3 7',
                  fillColor: col,
                  fillOpacity: 0.03 * d,
                }}
              >
                <Tooltip direction="top" className="custom-tooltip">
                  <span className="text-[10px] font-mono text-slate-300">
                    INVESTIGATION REGION · R≈{REGION_KM[inc.id]} KM
                  </span>
                </Tooltip>
              </Circle>
            );
          })}

          {mockIncidents.map(inc => {
            const d = dimFactor(inc.id);
            return (
              <Polygon
                key={`slick-${inc.id}`}
                positions={SLICK_GEOMETRY[inc.id]}
                pathOptions={{
                  color: AMBER,
                  weight: 1.2,
                  opacity: 0.75 * d,
                  fillColor: AMBER,
                  fillOpacity: 0.1 * d,
                }}
              >
                <Tooltip direction="top" className="custom-tooltip">
                  <div className="text-xs font-mono text-white">{inc.id}</div>
                  <div className="text-[10px] font-mono text-accent-amber">POSSIBLE SLICK · UNVERIFIED</div>
                  <div className="text-[10px] font-mono text-slate-400">AREA ≈ {inc.areaKm2} KM²</div>
                </Tooltip>
              </Polygon>
            );
          })}

          {mockIncidents.map(inc => {
            const st = STAGE_VIEW[inc.id];
            const col = stateColor(inc.id, st.phase);
            const isSel = inc.id === selectedId;
            const d = dimFactor(inc.id);
            return (
              <Fragment key={`marker-${inc.id}`}>
                {st.phase === 'running' && (
                  <CircleMarker
                    center={inc.coordinates as LatLng}
                    radius={isSel ? 19 : 15}
                    interactive={false}
                    pathOptions={{ stroke: false, fillColor: col, fillOpacity: 0.3, className: 'ot-marker-halo' }}
                  />
                )}
                {st.phase === 'pending' && !isSel && d === 1 && (
                  <CircleMarker
                    center={inc.coordinates as LatLng}
                    radius={10}
                    interactive={false}
                    pathOptions={{ color: AMBER, weight: 1, opacity: 0.5, fill: false }}
                  />
                )}
                <CircleMarker
                  center={inc.coordinates as LatLng}
                  radius={isSel ? 6.5 : 5}
                  pathOptions={{
                    color: '#020B18',
                    weight: 1,
                    fillColor: col,
                    fillOpacity: isSel ? 1 : 0.85 * d,
                  }}
                  eventHandlers={{ click: () => toggleSelect(inc.id) }}
                >
                  <Tooltip direction="top" offset={[0, -6]} className="custom-tooltip" opacity={1}>
                    <div className="text-xs font-mono text-white mb-0.5">{inc.id}</div>
                    <div className="text-[10px] font-mono" style={{ color: col }}>
                      {st.label}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      DETECTION CONF {((inc.oilConfidence ?? 0) * 100).toFixed(1)}%
                    </div>
                  </Tooltip>
                </CircleMarker>
              </Fragment>
            );
          })}

          {selectedPos && (
            <Fragment key="reticle">
              <Circle
                center={selectedPos}
                radius={8000}
                interactive={false}
                pathOptions={{ color: CYAN, weight: 1, opacity: 0.8, fill: false }}
              />
              {[0, 90, 180, 270].map(brg => {
                const p1 = offsetKm(selectedPos, brg, 10);
                const p2 = offsetKm(selectedPos, brg, 13.5);
                return (
                  <Polyline
                    key={brg}
                    positions={[p1, p2]}
                    interactive={false}
                    pathOptions={{ color: CYAN, weight: 1.5, opacity: 0.8 }}
                  />
                );
              })}
            </Fragment>
          )}

          {selectedId === FLAGSHIP &&
            VESSEL_TRACKS.map(({ vessel, track }) => (
              <Fragment key={vessel.id}>
                <Polyline
                  positions={track}
                  interactive={false}
                  pathOptions={{ color: CYAN, weight: 1, opacity: 0.3, dashArray: '2 5' }}
                />
                <CircleMarker
                  center={vessel.lastKnownPosition as LatLng}
                  radius={3.5}
                  pathOptions={{ color: '#0f172a', weight: 1, fillColor: '#E2E8F0', fillOpacity: 0.95 }}
                >
                  <Tooltip direction="top" offset={[0, -4]} className="custom-tooltip" opacity={1}>
                    <div className="text-xs font-mono text-white">{vessel.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {vessel.type.toUpperCase()} · MMSI {vessel.mmsi}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">AIS TRACK · CANDIDATE {vessel.id}</div>
                  </Tooltip>
                </CircleMarker>
              </Fragment>
            ))}
        </OceanMap>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 z-[450] h-48 w-[380px] bg-gradient-to-t from-abyssal/85 to-transparent" />

      <div className="pointer-events-none absolute bottom-5 left-5 z-[500] flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          {[
            { style: { backgroundColor: RED }, label: 'PRIORITY INCIDENT · ACTION REQUIRED' },
            { style: { backgroundColor: CYAN }, label: 'ANALYSIS RUNNING', pulse: true },
            { style: { border: `1px solid ${AMBER}` }, label: 'VERIFICATION PENDING' },
            { style: { border: `1px solid ${AMBER}`, width: 14, height: 7, borderRadius: 2 }, label: 'POSSIBLE SLICK · UNVERIFIED' },
            { style: { backgroundColor: '#CBD5E1' }, label: 'CANDIDATE VESSEL (AIS)' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${item.pulse ? 'ot-marker-halo' : ''}`}
                style={item.style}
              />
              <span className="font-mono text-[9px] tracking-[0.14em] text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
        <p className="font-mono text-[9px] tracking-[0.12em] text-slate-500">
          WIND {mockEnvironmentalInputs.wind.toUpperCase()} · CURRENT{' '}
          {mockEnvironmentalInputs.surfaceCurrent.toUpperCase()} · SAR REVISIT ≤ 12 H
        </p>
      </div>

      <aside className="absolute inset-y-0 right-0 z-[500] flex w-[340px] flex-col border-l border-slate-700/40 bg-abyssal/90 backdrop-blur-md">
        <header className="border-b border-slate-800/60 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-cyan" />
              <h2 className="font-mono text-[11px] tracking-[0.2em] text-slate-200">INVESTIGATION QUEUE</h2>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-slate-500">
              {clock.toISOString().slice(11, 19)} UTC
            </span>
          </div>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-slate-800/60">
            <div className="pr-3">
              <dt className="font-mono text-[8.5px] leading-tight tracking-[0.14em] text-slate-500">
                ACTIVE INCIDENTS
              </dt>
              <dd className="mt-1.5 font-mono text-xl leading-none text-slate-100">
                {String(activeCount).padStart(2, '0')}
              </dd>
            </div>
            <div className="px-3">
              <dt className="font-mono text-[8.5px] leading-tight tracking-[0.14em] text-slate-500">
                VESSELS IN CURRENT INVESTIGATION
              </dt>
              <dd className="mt-1.5 font-mono text-xl leading-none text-slate-100">{vesselsInContext}</dd>
            </div>
            <div className="pl-3">
              <dt className="font-mono text-[8.5px] leading-tight tracking-[0.14em] text-slate-500">
                HIGHEST ANALYSIS CONFIDENCE
              </dt>
              <dd className="mt-1.5 font-mono text-xl leading-none text-accent-cyan">
                {(peakConfidence * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
        </header>

        <nav className="custom-scrollbar flex-1 divide-y divide-slate-800/50 overflow-y-auto">
          {queue.map(inc => {
            const st = STAGE_VIEW[inc.id];
            const col = stateColor(inc.id, st.phase);
            const isSel = inc.id === selectedId;
            const conf = (inc.oilConfidence ?? 0) * 100;
            return (
              <button
                key={inc.id}
                onClick={() => toggleSelect(inc.id)}
                className={`relative block w-full px-4 py-3 text-left transition-colors ${
                  isSel ? 'bg-accent-cyan/[0.07]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-[2px]"
                  style={{ backgroundColor: col, opacity: isSel ? 1 : 0.55 }}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-xs text-slate-100">{inc.id}</span>
                  <span className="flex items-baseline gap-2">
                    <span
                      className="font-mono text-[9px] tracking-wider"
                      style={{ color: inc.priority === 'High' ? RED : AMBER }}
                    >
                      {inc.priority.toUpperCase()}
                    </span>
                    <span className={`font-mono text-[11px] ${conf >= 90 ? 'text-accent-cyan' : 'text-accent-amber'}`}>
                      {conf.toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="mt-1 truncate text-[10px] text-slate-400">
                  {inc.region} · {fmtCoords(inc.coordinates as LatLng)}
                </div>
                <div className="mt-1.5 flex items-baseline justify-between gap-2">
                  <span className="font-mono text-[9px] tracking-wider" style={{ color: col }}>
                    {st.label}
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">{fmtUtc(inc.observedAt)}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <footer className="border-t border-slate-800/60 p-3">
          {selectedId ? (
            <button
              onClick={() => navigate(`/investigations/${selectedId}/detection`)}
              className="group flex w-full items-center justify-between px-1 py-1 text-left"
            >
              <span className="font-mono text-[10px] tracking-[0.18em] text-accent-cyan transition-colors group-hover:text-white">
                OPEN INVESTIGATION WORKSPACE
              </span>
              <ArrowRight size={13} className="text-accent-cyan transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="block px-1 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-600">
              SELECT AN INCIDENT TO INSPECT
            </span>
          )}
        </footer>
      </aside>
    </div>
  );
}
