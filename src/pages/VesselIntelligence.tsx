import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { CircleMarker, Polygon, Polyline, Tooltip } from 'react-leaflet';
import OceanMap from '../components/map/OceanMap';
import { mockObservedSlickCoords, mockSourceZones, mockVessels } from '../data/mockData';

type LatLng = [number, number];

const CYAN = '#00B8D4';
const AMBER = '#F59E0B';
const RED = '#EF4444';
const FLAGSHIP = 'INC-204';
const DETECTION_MS = Date.parse('2026-08-18T04:32:00Z');

interface TrackPt {
  ll: LatLng;
  h: number;
  tag?: 'speed' | 'gapStart' | 'gapEnd' | 'deviation' | 'proximity' | 'outside';
}

interface LogEvent {
  t: string;
  title: string;
  tone: 'red' | 'amber' | 'cyan' | 'slate';
  why: string;
}

const ZONE_POLYS: Record<'A' | 'B' | 'C', LatLng[]> = {
  A: [
    [12.862, 80.301],
    [12.858, 80.335],
    [12.842, 80.341],
    [12.822, 80.332],
    [12.818, 80.308],
    [12.833, 80.297],
  ],
  B: [
    [12.806, 80.404],
    [12.8, 80.424],
    [12.782, 80.427],
    [12.771, 80.413],
    [12.778, 80.399],
  ],
  C: [
    [12.921, 80.263],
    [12.917, 80.28],
    [12.9, 80.283],
    [12.893, 80.27],
    [12.9, 80.259],
  ],
};

const TRACKS: Record<string, { pts: TrackPt[]; events: LogEvent[] }> = {
  'VSL-001': {
    pts: [
      { ll: [12.74, 80.44], h: 34 },
      { ll: [12.78, 80.395], h: 29 },
      { ll: [12.805, 80.352], h: 26.3, tag: 'speed' },
      { ll: [12.822, 80.334], h: 24.6 },
      { ll: [12.833, 80.323], h: 23.1, tag: 'gapStart' },
      { ll: [12.846, 80.317], h: 21.2, tag: 'gapEnd' },
      { ll: [12.856, 80.306], h: 19.7, tag: 'deviation' },
      { ll: [12.868, 80.29], h: 16 },
      { ll: [12.872, 80.3], h: 11 },
      { ll: [12.862, 80.312], h: 5 },
      { ll: [12.84, 80.32], h: 0 },
    ],
    events: [
      {
        t: 'AUG 17 · 02:14',
        title: 'SPEED ANOMALY',
        tone: 'amber',
        why: 'Speed reduced from 12.4 to 3.1 kn over 22 min while south-east of the probable source region. Loitering alone is not anomalous, but timing matters once correlated with the release window.',
      },
      {
        t: 'AUG 17 · 07:20',
        title: 'AIS SIGNAL GAP · 114 MIN',
        tone: 'red',
        why: 'No position reports between 05:26 and 07:20 UTC — entirely inside the estimated Zone A release window (T-27h…T-18h). An AIS gap is not proof of wrongdoing; it means the vessel path is unknown exactly where evidence is most relevant.',
      },
      {
        t: 'AUG 17 · 07:26',
        title: 'PROBABLE SOURCE REGION OVERLAP',
        tone: 'cyan',
        why: 'Straight-line inference across the gap passes through the Zone A ensemble hull. The true path inside the gap cannot be verified from AIS alone — drift reconstruction must resolve it.',
      },
      {
        t: 'AUG 17 · 08:50',
        title: 'NAVIGATION DEVIATION',
        tone: 'amber',
        why: 'Course change of 38° off the expected great-circle route immediately after signal reacquisition, followed by reduced speed near the region.',
      },
      {
        t: 'AUG 18 · 04:32',
        title: 'HOLDING STATION NEAR ZONE A',
        tone: 'slate',
        why: 'Current reported position lies adjacent to the dominant source hypothesis, consistent with the spatial component of the correlation.',
      },
    ],
  },
  'VSL-002': {
    pts: [
      { ll: [12.72, 80.52], h: 33 },
      { ll: [12.755, 80.475], h: 27 },
      { ll: [12.772, 80.445], h: 22, tag: 'proximity' },
      { ll: [12.782, 80.428], h: 16 },
      { ll: [12.788, 80.418], h: 9 },
      { ll: [12.79, 80.41], h: 0 },
    ],
    events: [
      {
        t: 'AUG 17 · 06:32',
        title: 'NEAREST APPROACH · 6.8 NM',
        tone: 'amber',
        why: 'Closest pass skims the south-eastern edge of Zone B without entering any candidate hull during the release window.',
      },
      {
        t: 'AUG 17 · 14:48',
        title: 'REPORTING REGULARITY VERIFIED',
        tone: 'slate',
        why: 'Continuous 2-minute AIS reporting interval throughout the hindcast period — absence of transmission anomalies lowers behavioural consistency.',
      },
      {
        t: 'AUG 18 · 04:32',
        title: 'PRESENT NEAR ZONE B',
        tone: 'slate',
        why: 'Current position sits adjacent to the secondary source hypothesis; spatial consistency alone does not establish involvement.',
      },
    ],
  },
  'VSL-003': {
    pts: [
      { ll: [12.985, 80.205], h: 30 },
      { ll: [12.962, 80.225], h: 24 },
      { ll: [12.94, 80.245], h: 18, tag: 'outside' },
      { ll: [12.925, 80.258], h: 10 },
      { ll: [12.91, 80.27], h: 0 },
    ],
    events: [
      {
        t: 'AUG 17 · 10:32',
        title: 'NEAREST APPROACH AFTER WINDOW CLOSED',
        tone: 'amber',
        why: 'Closest approach to any candidate region occurs at the moment the earliest release window closes — temporal consistency is therefore weak.',
      },
      {
        t: 'AUG 18 · 04:32',
        title: 'NO AIS GAPS DETECTED',
        tone: 'slate',
        why: 'Uninterrupted transmissions and a course profile consistent with scheduled container service reduce investigative priority.',
      },
    ],
  },
};

const FUNNEL_STAGES = [
  { label: 'INITIAL VESSEL DATASET', count: '142', crit: 'REGION-WIDE AIS ARCHIVE', width: '100%' },
  { label: 'TEMPORAL WINDOW', count: '37', crit: 'PRESENT DURING T-36 H → NOW', width: '86%' },
  { label: 'SOURCE REGION PROXIMITY', count: '12', crit: 'WITHIN EMERGED ZONE ENVELOPES', width: '72%' },
  { label: 'TRAJECTORY CONSISTENCY', count: '5', crit: 'COURSE / SPEED PLAUSIBLE VS DRIFT MODEL', width: '58%' },
  { label: 'HIGH-PRIORITY CANDIDATES', count: '3', crit: 'TYPE RELEVANCE + FULL EVIDENCE REVIEW', width: '46%' },
];

const TYPE_RELEVANCE: Record<string, number> = {
  'Oil Tanker': 88,
  'Bulk Carrier': 54,
  'Container Ship': 32,
};

function fmtClock(h: number): string {
  const d = new Date(DETECTION_MS - h * 3600 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${dd} AUG · ${hh}:${mm}`;
}

const TONE_COLOR: Record<LogEvent['tone'], string> = {
  red: RED,
  amber: AMBER,
  cyan: CYAN,
  slate: '#94A3B8',
};

export default function VesselIntelligence() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [stage, setStage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scrubPos, setScrubPos] = useState<number | null>(null);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    if (stage >= 4) return;
    const t = setTimeout(() => setStage(s => s + 1), stage === 0 ? 500 : 700);
    return () => clearTimeout(t);
  }, [stage]);

  const selVesselId = selectedId ?? (stage >= 4 ? 'VSL-001' : null);
  const track = selVesselId ? TRACKS[selVesselId] : null;
  const lastIdx = track ? track.pts.length - 1 : 0;
  const scrubIdx = Math.min(Math.max(0, scrubPos ?? lastIdx), lastIdx);

  useEffect(() => {
    if (!replaying || !track || scrubIdx <= 0) return;
    const t = setTimeout(() => {
      setScrubPos(scrubIdx - 1);
    }, 650);
    return () => clearTimeout(t);
  }, [replaying, scrubIdx, track]);

  const candidates = [...mockVessels].sort((a, b) => b.priorityScore - a.priorityScore);
  const selectedVessel = candidates.find(v => v.id === selVesselId) ?? null;

  const gapStartIdx = track?.pts.findIndex(p => p.tag === 'gapStart') ?? -1;
  const gapEndIdx = track?.pts.findIndex(p => p.tag === 'gapEnd') ?? -1;
  const hasGap = gapStartIdx >= 0 && gapEndIdx >= 0;
  const gapMidpoint =
    hasGap && track
      ? ([
          (track.pts[gapStartIdx].ll[0] + track.pts[gapEndIdx].ll[0]) / 2,
          (track.pts[gapStartIdx].ll[1] + track.pts[gapEndIdx].ll[1]) / 2,
        ] as LatLng)
      : null;
  const inGap = hasGap && scrubIdx > gapStartIdx && scrubIdx < gapEndIdx;

  const factors = selectedVessel
    ? [
        ['TEMPORAL CONSISTENCY', String(selectedVessel.temporalScore)],
        ['SOURCE-REGION CONSISTENCY', String(selectedVessel.spatialScore)],
        ['TRAJECTORY CONSISTENCY', String(selectedVessel.trajectoryScore)],
        ['AIS BEHAVIOURAL EVIDENCE', String(selectedVessel.anomalyScore)],
        ['VESSEL TYPE RELEVANCE', String(TYPE_RELEVANCE[selectedVessel.type] ?? 40)],
      ]
    : [];

  const knownPts = track
    ? track.pts.filter((_, i) => !(hasGap && i > gapStartIdx && i < gapEndIdx))
    : [];
  const segBefore = hasGap && track ? track.pts.slice(0, gapStartIdx + 1).map(p => p.ll) : [];
  const segAfter = hasGap && track ? track.pts.slice(gapEndIdx).map(p => p.ll) : [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-[400px] shrink-0 flex-col border-r border-slate-800/70 bg-navy/50">
        <header className="flex items-center justify-between border-b border-slate-800/60 px-4 pb-3 pt-4">
          <div>
            <h2 className="font-mono text-[11px] tracking-[0.2em] text-slate-200">CANDIDATE CORRELATION</h2>
            <p className="mt-1 font-mono text-[9px] tracking-[0.14em] text-slate-500">
              AIS × SOURCE HYPOTHESES · INC-{id?.includes('INC-') ? id.slice(4) : '204'}
            </p>
          </div>
          <button
            onClick={() => {
              setStage(0);
              setSelectedId(null);
              setScrubPos(null);
              setReplaying(false);
            }}
            className="p-1.5 text-slate-500 transition-colors hover:text-white"
            aria-label="Re-run correlation"
          >
            <RotateCcw size={13} />
          </button>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          <section className="border-b border-slate-800/60 px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">FILTERING PROGRESSION</h3>
            <div className="relative mt-3 space-y-2 pl-3">
              <span className="absolute bottom-2 left-[3px] top-2 w-px bg-slate-800" />
              {FUNNEL_STAGES.map((stg, i) => {
                const active = stage >= i;
                const isFinal = i === FUNNEL_STAGES.length - 1;
                return (
                  <div key={stg.label} className={`relative transition-opacity duration-500 ${active ? 'opacity-100' : 'opacity-25'}`}>
                    <span
                      className={`absolute -left-3 top-1/2 h-[7px] w-[7px] -translate-y-1/2 rotate-45 border ${
                        active ? (isFinal ? 'border-accent-cyan bg-accent-cyan' : 'border-slate-400 bg-slate-400') : 'border-slate-600 bg-transparent'
                      }`}
                    />
                    <div style={{ width: stg.width }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`font-mono text-[9.5px] tracking-[0.1em] ${isFinal && active ? 'text-accent-cyan' : 'text-slate-300'}`}>
                          {stg.label}
                        </span>
                        <span className={`font-mono text-sm leading-none ${isFinal && active ? 'text-accent-cyan' : 'text-slate-100'}`}>
                          {stg.count}
                        </span>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="truncate font-mono text-[8.5px] tracking-[0.08em] text-slate-600">{stg.crit}</span>
                      </div>
                      <div className="mt-1.5 h-px w-full bg-slate-800" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">CANDIDATE VESSELS</h3>
              {stage >= 4 && (
                <span className="font-mono text-[8.5px] tracking-[0.14em] text-slate-600">{candidates.length} UNDER INVESTIGATION</span>
              )}
            </div>

            {stage < 4 ? (
              <p className="mt-3 font-mono text-[10px] tracking-[0.08em] text-slate-600">CORRELATION RUNNING…</p>
            ) : (
              <div className="mt-3 space-y-px ot-fade-in">
                {candidates.map((v, i) => {
                  const sel = v.id === selVesselId;
                  const chipColor = v.priorityLevel.includes('Top') ? CYAN : v.priorityLevel.includes('Consistent') ? AMBER : '#64748B';
                  return (
                    <div key={v.id} className={`border-l-2 ${sel ? 'border-accent-cyan bg-white/[0.03]' : 'border-transparent hover:bg-white/[0.02]'}`}>
                      <button onClick={() => setSelectedId(v.id)} className="w-full px-3 py-2.5 text-left">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="flex items-baseline gap-2">
                            <span className={`font-mono text-[10px] ${sel ? 'text-accent-cyan' : 'text-slate-600'}`}>0{i + 1}</span>
                            <span className={`text-xs font-semibold ${sel ? 'text-slate-100' : 'text-slate-300'}`}>{v.name}</span>
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: chipColor }}>
                            {v.priorityLevel.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2 font-mono text-[9px] text-slate-500">
                          <span className="truncate">
                            {v.type.toUpperCase()} · {v.flag.toUpperCase()} · MMSI {v.mmsi}
                          </span>
                          <span style={{ color: sel ? CYAN : undefined }}>{v.priorityScore}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-end gap-1 font-mono text-[8px] tracking-wider text-slate-600">
                          {sel ? 'HIDE FACTORS' : 'DETAILS'}
                          <ChevronDown size={10} className={`transition-transform ${sel ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {sel && (
                        <div className="ot-fade-in px-3 pb-3">
                          <div className="space-y-2 border-t border-slate-800/70 pt-3">
                            {factors.map(([label, val]) => {
                              const n = Number(val);
                              return (
                                <div key={label}>
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="font-mono text-[9px] tracking-[0.08em] text-slate-400">{label}</span>
                                    <span className={`font-mono text-[9px] ${n > 80 ? 'text-accent-cyan' : n > 50 ? 'text-accent-amber' : 'text-slate-500'}`}>{n}</span>
                                  </div>
                                  <div className="mt-1 h-[2px] w-full bg-slate-800">
                                    <div
                                      className="h-full"
                                      style={{ width: `${n}%`, backgroundColor: n > 80 ? CYAN : n > 50 ? AMBER : '#475569' }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2.5 font-mono text-[8.5px] leading-relaxed tracking-[0.06em] text-slate-600">
                            COMPONENT VIEW — REASONING IS CARRIED BY THE FACTORS ABOVE, NOT A SINGLE SCORE.
                          </p>
                          <ul className="mt-2 space-y-1 border-t border-slate-800/70 pt-2">
                            {v.evidence.map(ev => (
                              <li key={ev} className="flex items-start gap-1.5">
                                <span className="mt-[5px] h-1 w-1 shrink-0 bg-accent-cyan/70" />
                                <span className="text-[10.5px] leading-relaxed text-slate-400">{ev}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden bg-[#01070f]">
        <OceanMap center={[12.845, 80.36]} zoom={11}>
          <Polygon
            positions={mockObservedSlickCoords as unknown as LatLng[]}
            pathOptions={{ color: CYAN, weight: 1.3, opacity: 0.65, fillColor: CYAN, fillOpacity: 0.07, dashArray: '3 4' }}
          >
            <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.9}>
              <span className="font-mono text-[9px] tracking-wider">OBSERVED SLICK · EVIDENCE</span>
            </Tooltip>
          </Polygon>

          {(['A', 'B', 'C'] as const).map(z => {
            const zone = mockSourceZones.find(zn => zn.id === `ZONE ${z}`);
            return (
              <Polygon
                key={z}
                positions={ZONE_POLYS[z]}
                pathOptions={{
                  color: AMBER,
                  weight: z === 'A' ? 1.6 : 1,
                  opacity: z === 'A' ? 0.85 : 0.55,
                  dashArray: z === 'A' ? undefined : '4 4',
                  fillColor: AMBER,
                  fillOpacity: z === 'A' ? 0.09 : 0.05,
                }}
              >
                <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.95}>
                  <div className="font-mono text-[9px] tracking-wider">ZONE {z} · {zone?.probability ?? '—'}%</div>
                  <div className="font-mono text-[8px] text-accent-amber">WINDOW {zone?.estimatedWindow.toUpperCase()}</div>
                </Tooltip>
              </Polygon>
            );
          })}

          {stage >= 4 &&
            candidates.map(v => {
              const end = TRACKS[v.id].pts[TRACKS[v.id].pts.length - 1];
              const sel = v.id === selectedId;
              return (
                <CircleMarker
                  key={`cur-${v.id}`}
                  center={end.ll}
                  radius={sel ? 4.5 : 3}
                  pathOptions={{ color: '#020B18', weight: 1, fillColor: sel ? CYAN : '#94A3B8', fillOpacity: sel ? 1 : 0.75 }}
                >
                  <Tooltip direction="right" className="custom-tooltip" permanent opacity={0.85}>
                    <span className="font-mono text-[8px] tracking-wider">{v.id}</span>
                  </Tooltip>
                </CircleMarker>
              );
            })}

          {track && selectedVessel && (
            <>
              {hasGap ? (
                <>
                  <Polyline positions={segBefore} interactive={false} pathOptions={{ color: CYAN, weight: 2, opacity: 0.85 }} />
                  <Polyline positions={segAfter} interactive={false} pathOptions={{ color: CYAN, weight: 2, opacity: 0.85 }} />
                  <Polyline
                    positions={[track.pts[gapStartIdx].ll, track.pts[gapEndIdx].ll]}
                    interactive={false}
                    pathOptions={{ color: RED, weight: 2, opacity: 0.85, dashArray: '2 6' }}
                  />
                </>
              ) : (
                <Polyline positions={knownPts.map(p => p.ll)} interactive={false} pathOptions={{ color: CYAN, weight: 2, opacity: 0.85 }} />
              )}

              {knownPts.map((p, i) => {
                const isGapEdge = hasGap && (p.tag === 'gapStart' || p.tag === 'gapEnd');
                return (
                  <CircleMarker
                    key={`wp-${i}`}
                    center={p.ll}
                    radius={isGapEdge ? 4 : 2.5}
                    pathOptions={{
                      color: isGapEdge ? RED : CYAN,
                      weight: isGapEdge ? 1.5 : 1,
                      fillColor: isGapEdge ? '#020B18' : CYAN,
                      fillOpacity: isGapEdge ? 0.4 : 0.8,
                    }}
                  >
                    <Tooltip direction="top" className="custom-tooltip" opacity={1}>
                      <div className="font-mono text-[9px] text-white">{fmtClock(p.h)}</div>
                      <div className="font-mono text-[8px] text-slate-400">
                        {p.ll[0].toFixed(3)}°N {p.ll[1].toFixed(3)}°E
                      </div>
                      {p.tag === 'speed' && <div className="font-mono text-[8px] text-accent-amber">SPEED ANOMALY</div>}
                      {p.tag === 'deviation' && <div className="font-mono text-[8px] text-accent-amber">COURSE DEVIATION 38°</div>}
                      {p.tag === 'proximity' && <div className="font-mono text-[8px] text-accent-amber">NEAREST APPROACH 6.8 NM</div>}
                      {p.tag === 'outside' && <div className="font-mono text-[8px] text-accent-amber">WINDOW CLOSED AT PASSAGE</div>}
                      {isGapEdge && <div className="font-mono text-[8px]" style={{ color: RED }}>AIS {p.tag === 'gapStart' ? 'LOST' : 'REACQUIRED'}</div>}
                    </Tooltip>
                  </CircleMarker>
                );
              })}

              {gapMidpoint && (
                <CircleMarker
                  center={gapMidpoint}
                  radius={7}
                  interactive={false}
                  pathOptions={{ color: RED, weight: 1.5, fillColor: RED, fillOpacity: 0.15, className: 'ot-marker-halo' }}
                />
              )}
              {gapMidpoint && (
                <CircleMarker center={gapMidpoint} radius={2.5} pathOptions={{ color: RED, weight: 1, fillColor: RED, fillOpacity: 0.9 }}>
                  <Tooltip direction="top" className="custom-tooltip" permanent opacity={0.95}>
                    <span className="font-mono text-[8.5px]" style={{ color: RED }}>
                      INFERRED PATH INSIDE ZONE A
                    </span>
                  </Tooltip>
                </CircleMarker>
              )}

              <CircleMarker
                center={track.pts[scrubIdx].ll}
                radius={inGap ? 6 : 4.5}
                pathOptions={
                  inGap
                    ? { color: RED, weight: 2, dashArray: '2 2', fillColor: RED, fillOpacity: 0.15 }
                    : { color: '#FFFFFF', weight: 1.5, fillColor: CYAN, fillOpacity: 1 }
                }
              >
                <Tooltip direction="top" className="custom-tooltip" opacity={1}>
                  <div className="font-mono text-[9px] text-white">{fmtClock(track.pts[scrubIdx].h)}</div>
                  {inGap && <div className="font-mono text-[8px]" style={{ color: RED }}>POSITION UNCERTAIN — AIS GAP</div>}
                </Tooltip>
              </CircleMarker>
            </>
          )}
        </OceanMap>

        <div className="pointer-events-none absolute left-4 top-4 z-[500]">
          {selectedVessel && track ? (
            <>
              <p className="font-mono text-[10px] tracking-[0.16em] text-slate-200">
                SELECTED · {selectedVessel.name} · {selectedVessel.type.toUpperCase()} · FLAG {selectedVessel.flag.toUpperCase()}
              </p>
              <div className="mt-1.5 flex gap-2">
                {hasGap && (
                  <span className="border px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.1em]" style={{ borderColor: 'rgba(239,68,68,0.4)', color: RED }}>
                    AIS GAP · 114 MIN
                  </span>
                )}
                {selectedVessel.spatialScore > 80 ? (
                  <span className="border border-accent-cyan/40 px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.1em] text-accent-cyan">ZONE OVERLAP</span>
                ) : (
                  <span className="border border-slate-700 px-1.5 py-0.5 font-mono text-[8.5px] tracking-[0.1em] text-slate-500">NO HULL OVERLAP</span>
                )}
              </div>
            </>
          ) : (
            <p className="font-mono text-[10px] tracking-[0.16em] text-slate-500">CORRELATION RUNNING — SELECT A CANDIDATE</p>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-5 left-4 z-[500] flex flex-col gap-1.5">
          {[
            { swatch: <span className="inline-block h-2 w-3.5 border border-dashed border-accent-cyan" />, label: 'OBSERVED SLICK' },
            { swatch: <span className="inline-block h-2 w-3.5 border border-accent-amber" />, label: 'SOURCE REGION (EMERGENT)' },
            { swatch: <span className="inline-block h-px w-4 bg-accent-cyan" />, label: 'AIS TRACK (KNOWN SEGMENTS)' },
            { swatch: <span className="inline-block h-px w-4 bg-accent-red" style={{ backgroundImage: 'linear-gradient(90deg,#EF4444 50%,transparent 50%)', backgroundSize: '6px 1px' }} />, label: 'AIS GAP — PATH UNKNOWN' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              {item.swatch}
              <span className="font-mono text-[9px] tracking-[0.12em] text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>

        {track && (
          <div className="absolute bottom-5 left-1/2 z-[500] flex w-[480px] -translate-x-1/2 items-center gap-3 border border-slate-700/40 bg-abyssal/90 px-4 py-2.5 backdrop-blur-md">
            <button
              onClick={() => {
                if (scrubIdx <= 0) {
                  setScrubPos(lastIdx);
                  setReplaying(true);
                } else {
                  setReplaying(p => !p);
                }
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center border border-accent-cyan/40 text-accent-cyan transition-colors hover:bg-accent-cyan/10"
              aria-label={replaying && scrubIdx > 0 ? 'Pause replay' : 'Replay backward'}
            >
              {replaying && scrubIdx > 0 ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <input
              type="range"
              min={0}
              max={track.pts.length - 1}
              value={scrubIdx}
              onChange={e => {
                setReplaying(false);
                setScrubPos(Number(e.target.value));
              }}
              className="w-full accent-cyan-500"
            />
            <div className="shrink-0 text-right">
              <p className="font-mono text-[9px] tabular-nums text-slate-200">{fmtClock(track.pts[scrubIdx].h)}</p>
              <p className="font-mono text-[8px] tracking-[0.1em] text-slate-500">T-{track.pts[scrubIdx].h.toFixed(0)}H{inGap ? ' · UNCERTAIN' : ''}</p>
            </div>
          </div>
        )}
      </main>

      <aside className="flex w-[330px] shrink-0 flex-col border-l border-slate-800/70 bg-navy/50">
        <header className="border-b border-slate-800/60 px-4 pb-3 pt-4">
          <h2 className="font-mono text-[11px] tracking-[0.2em] text-slate-200">FORENSIC EVIDENCE LOG</h2>
          <p className="mt-1 truncate font-mono text-[9px] tracking-[0.12em] text-slate-500">
            {selectedVessel ? `${selectedVessel.name} · CHRONOLOGICAL` : 'AWAITING CANDIDATE SELECTION'}
          </p>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {!selectedVessel || !track ? (
            <p className="px-4 py-4 font-mono text-[10px] tracking-[0.08em] text-slate-600">NO VESSEL SELECTED.</p>
          ) : (
            <ol className="ot-fade-in">
              {track.events.map(ev => (
                <li key={ev.t + ev.title} className="relative border-b border-slate-800/50 px-4 py-3.5">
                  <span className="absolute bottom-0 left-[27px] top-0 w-px bg-slate-800/60" />
                  <span
                    className="absolute left-[23px] top-[19px] h-[7px] w-[7px] rounded-full border"
                    style={{ borderColor: TONE_COLOR[ev.tone], backgroundColor: ev.tone === 'red' ? 'rgba(239,68,68,0.25)' : '#061827' }}
                  />
                  <div className="pl-7">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[9px] tabular-nums tracking-[0.1em] text-slate-500">{ev.t}</span>
                      <span className="font-mono text-[9.5px] tracking-[0.1em]" style={{ color: TONE_COLOR[ev.tone] }}>
                        {ev.title}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">{ev.why}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <footer className="border-t border-slate-800/60 p-3">
          <p className="mb-2 px-1 text-[9.5px] italic leading-relaxed text-slate-500">
            Correlation indicates association warranting reconstruction — not proof of fault.
          </p>
          <button
            onClick={() => navigate(`/investigations/${id ?? FLAGSHIP}/hypothesis`)}
            className="group flex w-full items-center justify-between px-1 py-1 text-left"
          >
            <span className="font-mono text-[10px] tracking-[0.18em] text-accent-cyan transition-colors group-hover:text-white">
              CONTINUE TO HYPOTHESIS TESTING
            </span>
            <ChevronRight size={14} className="text-accent-cyan transition-transform group-hover:translate-x-0.5" />
          </button>
        </footer>
      </aside>
    </div>
  );
}
