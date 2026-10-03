import { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronRight, Maximize, Minus, Play, Plus, RotateCcw, X } from 'lucide-react';
import { assets } from '../data/assets';
import { mockEnvironmentalInputs } from '../data/mockData';

type Phase = 0 | 1 | 2 | 3 | 4 | 5;

interface LayerState {
  sar: boolean;
  mask: boolean;
  confidence: boolean;
  optical: boolean;
  clouds: boolean;
  wind: boolean;
  current: boolean;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

interface LogEntry {
  t: string;
  msg: string;
  tone?: 'cyan' | 'amber';
}

interface Morphology {
  areaKm2: number;
  perimeterKm: number;
  elongation: string;
  compactness: number;
  orientationDeg: number;
}

interface FpTest {
  name: string;
  detail: string;
  result: 'PASS' | 'FLAGGED' | 'LOW LIKELIHOOD' | 'INCONCLUSIVE';
}

const CYAN = '#00B8D4';
const AMBER = '#F59E0B';
const FLAGSHIP = 'INC-204';
const MIN_SCALE = 0.6;
const MAX_SCALE = 3;

const SCENE_BBOX = { latMin: 12.68, latMax: 13.04, lngMin: 80.18, lngMax: 80.54 };

const SLICK_PATH =
  'M 30 40 C 40 35, 60 45, 65 35 C 70 25, 80 40, 75 55 C 70 70, 50 80, 35 75 C 20 70, 20 45, 30 40 Z';

const SLICK_CORE_PATH =
  'M 33 44 C 41 40, 56 47, 62 40 C 67 33, 74 43, 70 53 C 66 64, 51 72, 39 68 C 29 64, 28 48, 33 44 Z';

const CLOUD_PATHS = [
  'M52 2 C60 0,78 0,88 6 C96 10,98 18,90 22 C80 26,64 24,56 18 C50 13,46 5,52 2 Z',
  'M70 10 C80 8,94 12,97 19 C99 25,90 28,80 27 C71 26,64 20,66 15 Z',
  'M4 14 C10 11,18 13,20 17 C21 21,14 23,9 21 C4 19,1 16,4 14 Z',
];

const WIND_ARROWS = [
  [12, 20], [24, 34], [38, 15], [58, 62], [72, 76], [86, 46], [16, 64], [46, 90], [88, 86],
];

const CURRENT_ARROWS = [
  [16, 82], [30, 8], [50, 28], [64, 48], [84, 68], [92, 24], [34, 68], [68, 92],
];

const MORPHOLOGY: Morphology = {
  areaKm2: 14.2,
  perimeterKm: 21.6,
  elongation: '2.8 : 1',
  compactness: 0.38,
  orientationDeg: 118,
};

const FP_TEST_SET: FpTest[] = [
  { name: 'LOW-WIND REGION BIAS', detail: 'Ambient wind 18 km/h SW exceeds the ≈12 km/h damping threshold; no local calm pocket detected', result: 'PASS' },
  { name: 'NATURAL BIOGENIC FILM', detail: 'No chlorophyll-adjacent signature; texture smoother than typical algal films', result: 'LOW LIKELIHOOD' },
  { name: 'RAIN CELL / WEATHER ARTIFACT', detail: 'Convective cells present near the AOI margin — sub-region cannot be fully excluded', result: 'FLAGGED' },
  { name: 'SENSOR NOISE / SYSTEM ARTIFACT', detail: 'Feature persists across multi-looking passes; consistent with a physical surface film', result: 'PASS' },
  { name: 'ADJACENT LOOK-ALIKE (ANOM-02)', detail: 'Secondary segment north-east of the candidate retained for monitoring', result: 'INCONCLUSIVE' },
];

const EVIDENCE_SUMMARY: [string, string, boolean][] = [
  ['MORPHOLOGY', 'HIGH', true],
  ['SAR CONTRAST', 'HIGH', true],
  ['WIND CORRELATION', 'MODERATE–HIGH', false],
  ['OPTICAL VERIFICATION', 'LIMITED', false],
  ['WEATHER ARTIFACT RISK', 'LOW–MODERATE', true],
];

const WEIGHTED_EVIDENCE: [sign: '+' | '-', text: string, weight: number][] = [
  ['+', 'Irregular elongated morphology consistent with surface film diffusion', 30],
  ['+', 'Strong boundary continuity across segmentation passes', 24],
  ['+', 'Drift direction consistent with recorded SW wind field', 18],
  ['+', 'Low probability of low-wind or sensor artifact', 15],
  ['-', 'Optical confirmation limited by cloud cover (78%)', -13],
];

const FINAL_CONFIDENCE = 87.4;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export default function OilDetection() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { setDetectPhase } = useOutletContext<{ setDetectPhase?: (p: number) => void }>();

  const [phase, setPhase] = useState<Phase>(0);
  const [layers, setLayers] = useState<LayerState>({
    sar: true,
    mask: false,
    confidence: false,
    optical: false,
    clouds: false,
    wind: false,
    current: false,
  });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [cursorLL, setCursorLL] = useState<string>('—');
  const [isPanning, setIsPanning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [morph, setMorph] = useState<Morphology | null>(null);
  const [fpTests, setFpTests] = useState<FpTest[]>([]);
  const [candidateFound, setCandidateFound] = useState(false);
  const [selected, setSelected] = useState(false);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ px: number; py: number } | null>(null);
  const timersRef = useRef<number[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => timersRef.current.forEach(t => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    setDetectPhase?.(phase);
  }, [phase, setDetectPhase]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [logs]);

  const clearTimers = () => {
    timersRef.current.forEach(t => window.clearTimeout(t));
    timersRef.current = [];
  };

  const pushLog = (entry: LogEntry) => setLogs(prev => [...prev, entry]);

  const runAnalysis = () => {
    clearTimers();
    setLogs([]);
    setMorph(null);
    setFpTests([]);
    setCandidateFound(false);
    setSelected(false);
    setHoverPt(null);
    setLayers({ sar: true, mask: false, confidence: false, optical: false, clouds: false, wind: false, current: false });
    setView({ x: 0, y: 0, scale: 1 });

    const at = (fn: () => void, delay: number) => timersRef.current.push(window.setTimeout(fn, delay));

    setPhase(1);
    at(() => pushLog({ t: '04:32:10', msg: 'SAR SCENE LOADED · SENTINEL-1A IW GRD · VV+VH' }), 150);
    at(() => pushLog({ t: '04:32:14', msg: 'APPLYING DESPECKLING / NOISE REDUCTION' }), 950);
    at(() => pushLog({ t: '04:32:18', msg: 'SEARCHING FOR DARK ANOMALY CANDIDATES' }), 1750);
    at(() => {
      pushLog({ t: '04:32:23', msg: 'CANDIDATE ANOM-01 IDENTIFIED — SLICK-LIKE SURFACE FEATURE', tone: 'cyan' });
      setCandidateFound(true);
    }, 2600);
    at(() => {
      setPhase(2);
      setLayers(prev => ({ ...prev, mask: true }));
      pushLog({ t: '04:32:29', msg: 'REGION-GROWING SEGMENTATION INITIATED' });
    }, 3500);
    at(() => {
      setMorph(MORPHOLOGY);
      pushLog({ t: '04:32:35', msg: 'MORPHOLOGICAL FEATURES EXTRACTED', tone: 'cyan' });
    }, 5400);
    at(() => {
      setPhase(3);
      setLayers(prev => ({ ...prev, wind: true }));
      pushLog({ t: '04:32:42', msg: 'WIND CORRELATION COMPLETED · 18 KM/H SW', tone: 'cyan' });
    }, 6500);
    at(() => pushLog({ t: '04:32:48', msg: 'OPTICAL VERIFICATION LIMITED BY CLOUD CONTAMINATION (78%)', tone: 'amber' }), 7800);
    at(() => {
      setPhase(4);
      pushLog({ t: '04:32:55', msg: 'FALSE-POSITIVE DISCRIMINATION INITIATED' });
    }, 8900);
    FP_TEST_SET.forEach((t, i) =>
      at(() => {
        setFpTests(prev => [...prev, t]);
        if (t.result === 'FLAGGED' || t.result === 'INCONCLUSIVE') {
          pushLog({ t: `04:32:${String(58 + i).padStart(2, '0')}`, msg: `${t.name} → ${t.result}`, tone: 'amber' });
        }
      }, 9800 + i * 850)
    );
    at(() => {
      setPhase(5);
      pushLog({ t: '04:33:06', msg: 'ANALYSIS COMPLETE · CLASSIFICATION ISSUED', tone: 'cyan' });
    }, 14800);
  };

  const applyZoomAt = (clientX: number, clientY: number, nextScale: (s: number) => number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    setView(v => {
      const scale = clamp(nextScale(v.scale), MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { scale, x: cx - k * (cx - v.x), y: cy - k * (cy - v.y) };
    });
  };

  const zoomAtCursor = (clientX: number, clientY: number, factor: number) =>
    applyZoomAt(clientX, clientY, s => s * factor);

  const zoomStep = (delta: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    applyZoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, s => s + delta);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAtCursor(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetView = () => setView({ x: 0, y: 0, scale: 1 });

  const onPointerDown = (e: React.PointerEvent) => {
    // Interactive controls must receive their own clicks: never start a pan-drag
    // (or setPointerCapture, which retargets the subsequent `click`) from them.
    if ((e.target as HTMLElement).closest('button, input, a, path')) return;
    dragRef.current = { px: e.clientX, py: e.clientY };
    setIsPanning(true);
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const imgRect = imageRef.current?.getBoundingClientRect();
    if (imgRect) {
      const relX = clamp((e.clientX - imgRect.left) / imgRect.width, 0, 1);
      const relY = clamp((e.clientY - imgRect.top) / imgRect.height, 0, 1);
      const lng = SCENE_BBOX.lngMin + relX * (SCENE_BBOX.lngMax - SCENE_BBOX.lngMin);
      const lat = SCENE_BBOX.latMax - relY * (SCENE_BBOX.latMax - SCENE_BBOX.latMin);
      setCursorLL(`${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`);
    }
    const d = dragRef.current;
    if (!d) return;
    setView(v => ({ ...v, x: v.x + (e.clientX - d.px), y: v.y + (e.clientY - d.py) }));
    dragRef.current = { px: e.clientX, py: e.clientY };
  };

  const onPointerUp = () => {
    dragRef.current = null;
    setIsPanning(false);
  };

  const toggleLayer = (key: keyof LayerState) => {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const running = phase >= 1 && phase <= 4;
  const complete = phase === 5;

  const layerRows: {
    key: keyof LayerState;
    label: string;
    tag: string;
    tagTone: string;
    locked: boolean;
    dot?: string;
  }[] = [
    {
      key: 'sar',
      label: 'RAW SAR',
      tag: layers.sar ? 'ACTIVE' : 'OFF',
      tagTone: layers.sar ? 'text-accent-cyan/70' : 'text-slate-600',
      locked: false,
    },
    {
      key: 'mask',
      label: 'DETECTED SLICK MASK',
      tag: phase >= 2 ? 'READY' : 'LOCKED',
      tagTone: phase >= 2 ? 'text-accent-cyan/70' : 'text-slate-600',
      locked: phase < 2,
    },
    {
      key: 'confidence',
      label: 'CONFIDENCE OVERLAY',
      tag: phase >= 5 ? 'READY' : 'LOCKED',
      tagTone: phase >= 5 ? 'text-accent-cyan/70' : 'text-slate-600',
      locked: phase < 5,
    },
    {
      key: 'optical',
      label: 'OPTICAL CONFIRMATION',
      tag: phase >= 3 ? 'LIMITED' : 'LOCKED',
      tagTone: phase >= 3 ? 'text-accent-amber' : 'text-slate-600',
      locked: phase < 3,
    },
    {
      key: 'clouds',
      label: 'CLOUD MASK',
      tag: phase >= 3 ? 'READY' : 'LOCKED',
      tagTone: phase >= 3 ? 'text-accent-cyan/70' : 'text-slate-600',
      locked: phase < 3,
      dot: '#CBD5E1',
    },
    {
      key: 'wind',
      label: 'WIND FIELD',
      tag: phase >= 3 ? 'READY' : 'LOCKED',
      tagTone: phase >= 3 ? 'text-accent-cyan/70' : 'text-slate-600',
      locked: phase < 3,
      dot: '#94A3B8',
    },
    {
      key: 'current',
      label: 'SURFACE CURRENT',
      tag: phase >= 3 ? 'READY' : 'LOCKED',
      tagTone: phase >= 3 ? 'text-accent-cyan/70' : 'text-slate-600',
      locked: phase < 3,
      dot: CYAN,
    },
  ];

  const fpTone: Record<FpTest['result'], string> = {
    PASS: CYAN,
    'LOW LIKELIHOOD': '#7DD3FC',
    FLAGGED: AMBER,
    INCONCLUSIVE: '#94A3B8',
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className={`relative flex flex-1 items-center justify-center overflow-hidden bg-[#01070f] ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        } select-none`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          ref={imageRef}
          className="relative h-full max-w-full shrink-0 grow-0"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            transformOrigin: '0 0',
            transition: isPanning ? 'none' : 'transform 220ms ease-out',
          }}
        >
          {layers.sar && (
            <img
              src={assets.sarImage}
              alt="Sentinel-1 SAR scene"
              draggable={false}
              className="block h-full w-auto contrast-125 grayscale brightness-[0.85]"
            />
          )}

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <pattern id="confHatch" width="3" height="3" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="3" stroke="rgba(0,184,212,0.45)" strokeWidth="0.3" />
              </pattern>
              <filter id="cloudBlur">
                <feGaussianBlur stdDeviation="1.6" />
              </filter>
            </defs>

            {layers.wind && (
              <g>
                {WIND_ARROWS.map(([x, y], i) => (
                  <g key={`w-${i}`} transform={`translate(${x} ${y}) rotate(${42 + ((i * 37) % 18) - 9})`} opacity="0.5">
                    <line x1="0" y1="2.6" x2="0" y2="-2.6" stroke="#94A3B8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <polyline points="-1.3,-1.2 0,-2.6 1.3,-1.2" fill="none" stroke="#94A3B8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
                <text x="10" y="95" fill="#94A3B8" fontSize="2.4" fontFamily="'JetBrains Mono', monospace">WIND 18 KM/H SW</text>
                <text x="10" y="98.5" fill="#94A3B8" fontSize="2" opacity="0.75" fontFamily="'JetBrains Mono', monospace">WINDAGE ≈ 3% · NET DRIFT TO NE</text>
              </g>
            )}

            {layers.current && (
              <g>
                {CURRENT_ARROWS.map(([x, y], i) => (
                  <g key={`c-${i}`} transform={`translate(${x} ${y}) rotate(${38 + ((i * 23) % 20) - 10})`} opacity="0.55">
                    <line x1="0" y1="2.6" x2="0" y2="-2.6" stroke={CYAN} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                    <polyline points="-1.3,-1.2 0,-2.6 1.3,-1.2" fill="none" stroke={CYAN} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  </g>
                ))}
              </g>
            )}

            {layers.clouds && (
              <g filter="url(#cloudBlur)">
                {CLOUD_PATHS.map((d, i) => (
                  <path key={i} d={d} fill="#CBD5E1" opacity={i === 1 ? 0.11 : 0.17} />
                ))}
              </g>
            )}

            {candidateFound && !layers.mask && (
              <path
                d={SLICK_PATH}
                fill="none"
                stroke={CYAN}
                strokeOpacity="0.65"
                strokeWidth="1"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
                className="pointer-events-auto cursor-pointer"
                onMouseMove={e => {
                  const r = containerRef.current?.getBoundingClientRect();
                  if (r) setHoverPt({ x: e.clientX - r.left, y: e.clientY - r.top });
                }}
                onMouseLeave={() => setHoverPt(null)}
                onClick={e => {
                  e.stopPropagation();
                  setSelected(true);
                }}
              />
            )}

            {(layers.mask || layers.confidence) && phase >= 2 && (
              <g style={{ transition: 'opacity 0.9s ease' }}>
                {layers.mask && (
                  <>
                    <path
                      d={SLICK_PATH}
                      fill="rgba(0,184,212,0.08)"
                      stroke={selected ? '#FFFFFF' : CYAN}
                      strokeOpacity={selected ? 0.95 : 0.9}
                      strokeWidth={selected ? 2 : 1.2}
                      vectorEffect="non-scaling-stroke"
                      pathLength={1}
                      className={`pointer-events-auto cursor-pointer ${phase === 2 ? 'ot-mask-draw' : ''}`}
                      onMouseMove={e => {
                        const r = containerRef.current?.getBoundingClientRect();
                        if (r) setHoverPt({ x: e.clientX - r.left, y: e.clientY - r.top });
                      }}
                      onMouseLeave={() => setHoverPt(null)}
                      onClick={e => {
                        e.stopPropagation();
                        setSelected(true);
                      }}
                    />
                    {selected && (
                      <path
                        d={SLICK_PATH}
                        fill="none"
                        stroke={CYAN}
                        strokeOpacity="0.35"
                        strokeWidth="5"
                        vectorEffect="non-scaling-stroke"
                        className="ot-marker-halo pointer-events-none"
                      />
                    )}
                  </>
                )}
                {layers.confidence && complete && (
                  <g className="ot-fade-in pointer-events-none">
                    <path d={SLICK_PATH} fill="url(#confHatch)" />
                    <path d={SLICK_CORE_PATH} fill="rgba(0,184,212,0.22)" />
                  </g>
                )}
              </g>
            )}

            <g className="pointer-events-none">
              <line x1="93" y1="4" x2="93" y2="9" stroke="#94A3B8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <polyline points="91.8,6 93,4 94.2,6" fill="none" stroke="#94A3B8" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <text x="93" y="14" fill="#94A3B8" fontSize="3" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">N</text>
            </g>

            {complete && selected && (
              <g className="pointer-events-none ot-fade-in">
                <circle cx="53" cy="52" r="27" fill="none" stroke="#64748B" strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                <text x="26" y="36.5" fill={CYAN} fontSize="2.6" fontFamily="'JetBrains Mono', monospace">ANOM-01</text>
              </g>
            )}
          </svg>

          <div className="pointer-events-none absolute bottom-[5%] left-[5%] w-[12.8%]">
            <div className="relative h-px w-full bg-slate-300/70">
              <span className="absolute -left-px -top-1 h-2 w-px bg-slate-300/70" />
              <span className="absolute -right-px -top-1 h-2 w-px bg-slate-300/70" />
            </div>
            <p className="mt-1 font-mono text-[8px] tracking-[0.14em] text-slate-300/80">≈ 5 KM</p>
          </div>

          {phase === 1 && (
            <>
              <div className="pointer-events-none absolute inset-0 bg-abyssal/30" />
              <div className="ot-scanline pointer-events-none absolute left-[-2%] right-[-2%] h-[2px] bg-gradient-to-r from-transparent via-accent-cyan to-transparent shadow-[0_0_12px_rgba(0,184,212,0.7)]" />
            </>
          )}
        </div>

        <div className="pointer-events-none absolute left-4 top-4 z-20">
          <p className="font-mono text-[10px] tracking-[0.16em] text-slate-400">SENTINEL-1A · SAR C-BAND · IW GRD</p>
          <p className={`mt-1 font-mono text-[10px] tracking-[0.16em] ${running ? 'text-accent-amber animate-pulse' : complete ? 'text-accent-cyan' : 'text-slate-500'}`}>
            {phase === 0 && 'SCENE LOADED · AWAITING ANALYSIS REQUEST'}
            {phase === 1 && 'STAGE 01 / 05 · DETECTING ANOMALIES…'}
            {phase === 2 && 'STAGE 02 / 05 · RECONSTRUCTING ANOMALY BOUNDARY…'}
            {phase === 3 && 'STAGE 03 / 05 · CORRELATING EO + ENVIRONMENTAL DATA…'}
            {phase === 4 && 'STAGE 04 / 05 · FALSE-POSITIVE DISCRIMINATION…'}
            {phase === 5 && 'ANALYSIS COMPLETE · ANOM-01 UNDER INVESTIGATION'}
          </p>
        </div>

        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-px border border-slate-700/50 bg-abyssal/85 backdrop-blur-sm">
          <button onClick={() => zoomStep(0.2)} className="flex h-8 w-8 items-center justify-center border-b border-slate-700/50 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white" aria-label="Zoom in">
            <Plus size={14} />
          </button>
          <button onClick={() => zoomStep(-0.2)} className="flex h-8 w-8 items-center justify-center border-b border-slate-700/50 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white" aria-label="Zoom out">
            <Minus size={14} />
          </button>
          <button onClick={resetView} className="flex h-8 w-8 items-center justify-center text-slate-300 transition-colors hover:bg-slate-800 hover:text-white" aria-label="Reset view">
            <Maximize size={13} />
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-4 left-4 z-20 font-mono text-[9px] tracking-[0.12em] text-slate-500 tabular-nums">
          {cursorLL} · {view.scale.toFixed(1)}×
        </div>

        {phase === 0 && (
          <button
            onClick={runAnalysis}
            className="absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 border border-accent-cyan/40 bg-abyssal/85 px-5 py-2 font-mono text-[11px] tracking-[0.18em] text-accent-cyan backdrop-blur-sm transition-colors hover:bg-accent-cyan/10 hover:text-white"
          >
            <Play size={12} />
            RUN AI ANALYSIS
          </button>
        )}

        {running && (
          <div className="pointer-events-none absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 border border-accent-amber/40 bg-abyssal/85 px-5 py-2 font-mono text-[11px] tracking-[0.18em] text-accent-amber backdrop-blur-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-amber" />
            ANALYSING… STAGE 0{Math.min(phase, 5)} / 05
          </div>
        )}

        {complete && (
          <button
            onClick={runAnalysis}
            className="absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 border border-slate-600/60 bg-abyssal/85 px-5 py-2 font-mono text-[11px] tracking-[0.18em] text-slate-300 backdrop-blur-sm transition-colors hover:border-accent-cyan/40 hover:text-white"
          >
            <RotateCcw size={12} />
            RERUN ANALYSIS
          </button>
        )}

        {hoverPt && candidateFound && (
          <div
            className="pointer-events-none absolute z-40 w-max border border-slate-700/60 bg-abyssal/95 px-2.5 py-1.5 backdrop-blur-sm"
            style={{ left: hoverPt.x + 12, top: hoverPt.y - 10, transform: 'translateY(-100%)' }}
          >
            <p className="font-mono text-[9.5px] text-white">ANOM-01</p>
            <p className="font-mono text-[8px] text-slate-400">SLICK-LIKE SURFACE ANOMALY</p>
            <p className="mt-0.5 font-mono text-[8px] text-accent-cyan">CLICK TO INSPECT</p>
          </div>
        )}

        {selected && candidateFound && (
          <div className="absolute bottom-14 left-4 z-30 w-[240px] border border-slate-700/50 border-l-2 border-l-accent-cyan bg-abyssal/95 p-3 backdrop-blur-md">
            <button
              onClick={() => setSelected(false)}
              className="absolute right-1.5 top-1.5 p-0.5 text-slate-500 transition-colors hover:text-white"
              aria-label="Close candidate panel"
            >
              <X size={12} />
            </button>
            <p className="font-mono text-[9px] tracking-[0.18em] text-slate-500">SELECTED CANDIDATE</p>
            <p className="mt-1 font-mono text-xs text-slate-100">ANOM-01</p>
            <dl className="mt-2 space-y-1 font-mono text-[9.5px]">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">TYPE</dt>
                <dd className="truncate text-slate-300">SLICK-LIKE ANOMALY</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">EST. AREA</dt>
                <dd className="text-slate-300">{morph ? `${morph.areaKm2.toFixed(1)} KM²` : 'MEASURING…'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">AOI</dt>
                <dd className="text-slate-300">≈ 12.86°N 80.35°E</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">SAR CONFIDENCE</dt>
                <dd className="text-accent-cyan">{phase >= 2 ? '91.6%' : '—'}</dd>
              </div>
              {complete ? (
                <div className="flex justify-between gap-2 pt-1">
                  <dt className="text-slate-500">CLASSIFICATION</dt>
                  <dd className="text-right text-accent-amber">LIKELY OIL SLICK — VERIFY</dd>
                </div>
              ) : (
                <div className="flex justify-between gap-2 pt-1">
                  <dt className="text-slate-500">STATUS</dt>
                  <dd className="text-accent-amber">{running ? 'UNDER INVESTIGATION' : 'IDENTIFIED'}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        <div className="absolute left-4 top-14 z-20 w-[212px] border border-slate-700/50 bg-abyssal/85 backdrop-blur-sm">
          <p className="border-b border-slate-800/80 px-3 py-2 font-mono text-[9px] tracking-[0.2em] text-slate-500">LAYERS</p>
          <div className="py-1">
            {layerRows.map(row => {
              const active = layers[row.key];
              const disabled = row.locked;
              return (
                <button
                  key={row.key}
                  onClick={() => !disabled && toggleLayer(row.key)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                    disabled ? 'cursor-default opacity-40' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span
                    className={`inline-block h-2 w-2 shrink-0 border ${
                      active ? 'border-accent-cyan bg-accent-cyan' : 'border-slate-600'
                    }`}
                  />
                  <span className={`flex-1 truncate font-mono text-[9.5px] tracking-[0.08em] ${active ? 'text-slate-200' : 'text-slate-400'}`}>
                    {row.label}
                  </span>
                  {row.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.dot }} />}
                  <span className={`font-mono text-[8px] tracking-[0.08em] ${row.tagTone}`}>{row.tag}</span>
                </button>
              );
            })}
          </div>
        </div>

        {layers.optical && (
          <div className="ot-fade-in absolute right-6 top-14 z-30 w-[320px] border border-slate-700/50 border-l-2 border-l-accent-amber bg-abyssal/95 p-4 backdrop-blur-md">
            <button
              onClick={() => toggleLayer('optical')}
              className="absolute right-2 top-2 p-1 text-slate-500 transition-colors hover:text-white"
              aria-label="Close"
            >
              <X size={13} />
            </button>
            <p className="font-mono text-[9px] tracking-[0.2em] text-slate-500">OPTICAL / EO OBSERVATION</p>
            <p className="mt-1 font-mono text-sm tracking-[0.1em] text-accent-amber">LIMITED — CLOUD CONTAMINATION 78%</p>
            <div className="my-3 h-px bg-slate-800" />
            <dl className="space-y-2 font-mono text-[10px] leading-relaxed">
              <div>
                <dt className="tracking-[0.14em] text-slate-600">REASON</dt>
                <dd className="mt-0.5 text-slate-300">Convective cloud cover over ≥78% of the AOI during nearest Sentinel-2 pass (08:47 UTC).</dd>
              </div>
              <div>
                <dt className="tracking-[0.14em] text-slate-600">IMPACT</dt>
                <dd className="mt-0.5 text-slate-300">Analysis continues using SAR morphology and environmental correlation alone.</dd>
              </div>
              <div>
                <dt className="tracking-[0.14em] text-slate-600">NEXT OPPORTUNITY</dt>
                <dd className="mt-0.5 text-slate-300">S2 revisit ≈ 09 H</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-slate-800/70 bg-navy/60">
        <div className="custom-scrollbar flex-1 divide-y divide-slate-800/60 overflow-y-auto">
          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">ANALYSIS EVIDENCE</h3>
              <span className={`font-mono text-[8.5px] tracking-[0.12em] ${running ? 'text-accent-amber' : complete ? 'text-accent-cyan' : 'text-slate-600'}`}>
                {phase === 0 && 'SYSTEM READY'}
                {running && 'LIVE'}
                {complete && 'FINAL'}
              </span>
            </div>

            {phase === 0 && (
              <p className="mt-3 font-mono text-[10px] leading-relaxed tracking-[0.08em] text-slate-500">
                AWAITING ANALYSIS REQUEST.
                <br />
                RAW SAR SCENE IS LOADED AND READY.
              </p>
            )}

            {logs.length > 0 && (
              <div className="mt-3 max-h-[168px] overflow-y-auto custom-scrollbar border border-slate-800/70 bg-black/30 p-2">
                {logs.map((l, i) => (
                  <p key={i} className="font-mono text-[9px] leading-relaxed tracking-[0.03em]">
                    <span className="text-slate-600">[{l.t}]</span>{' '}
                    <span className={l.tone === 'cyan' ? 'text-accent-cyan' : l.tone === 'amber' ? 'text-accent-amber' : 'text-slate-400'}>
                      {l.msg}
                    </span>
                  </p>
                ))}
                <div ref={logEndRef} />
              </div>
            )}

            {complete && (
              <div className="ot-fade-in mt-3">
                <p className="font-mono text-[9px] tracking-[0.18em] text-slate-500">EVIDENCE SUMMARY</p>
                <div className="mt-2 space-y-1.5">
                  {EVIDENCE_SUMMARY.map(([label, val, good]) => (
                    <div key={label} className="flex items-baseline text-[10px]">
                      <span className="font-mono tracking-[0.08em] text-slate-400">{label}</span>
                      <span className="mx-2 flex-1 -translate-y-1 border-b border-dotted border-slate-700/80" />
                      <span className={`font-mono tracking-[0.06em] ${good ? 'text-accent-cyan' : 'text-accent-amber'}`}>{val}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="font-mono text-[9px] tracking-[0.14em] text-slate-400">FINAL CONFIDENCE</span>
                  <span className="font-mono text-xs text-accent-cyan">{FINAL_CONFIDENCE}%</span>
                </div>
                <div className="mt-1 h-[2px] w-full bg-slate-800">
                  <div className="h-full bg-accent-cyan transition-all duration-1000" style={{ width: `${FINAL_CONFIDENCE}%` }} />
                </div>
              </div>
            )}
          </section>

          <section className="px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">OBSERVATION</h3>
            <dl className="mt-3 space-y-2">
              {[
                ['SATELLITE SOURCE', 'SENTINEL-1A · SAR'],
                ['SENSOR MODE', 'C-BAND · IW GRD'],
                ['POLARISATION', 'VV + VH'],
                ['ACQUISITION TIME', '18 AUG 2026 · 04:32 UTC'],
                ['COVERAGE AREA', 'SCENE ≈ 40 × 47 KM'],
                ['INCIDENCE ANGLE', '38.2°'],
              ].map(([kk, vv]) => (
                <div key={kk} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 font-mono text-[9.5px] tracking-[0.1em] text-slate-500">{kk}</dt>
                  <dd className="truncate font-mono text-[10.5px] text-slate-200">{vv}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">MORPHOLOGY · ANOM-01</h3>
              {!morph && <span className="font-mono text-[8.5px] tracking-[0.12em] text-slate-600">AWAITING SEGMENTATION</span>}
            </div>
            {morph && (
              <dl className="ot-fade-in mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
                <Meta label="ESTIMATED AREA" value={`${morph.areaKm2.toFixed(1)} KM²`} />
                <Meta label="PERIMETER" value={`${morph.perimeterKm.toFixed(1)} KM`} />
                <Meta label="ELONGATION" value={morph.elongation} />
                <Meta label="COMPACTNESS" value={morph.compactness.toFixed(2)} />
                <div className="col-span-2">
                  <Meta label="ORIENTATION (MAJOR AXIS)" value={`${morph.orientationDeg}° · NW–SE`} />
                </div>
              </dl>
            )}
          </section>

          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">CORRELATION</h3>
              {phase < 3 && <span className="font-mono text-[8.5px] tracking-[0.12em] text-slate-600">LOCKED UNTIL STAGE 03</span>}
            </div>
            {phase >= 3 && (
              <div className="ot-fade-in mt-3 space-y-2.5">
                <div className="border-l-2 border-accent-amber/50 pl-2.5">
                  <p className="font-mono text-[10px] tracking-[0.06em] text-accent-amber">OPTICAL / EO — LIMITED</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    Cloud contamination 78% of AOI — analysis continues without optical confirmation.
                  </p>
                </div>
                <div className="border-l-2 border-accent-cyan/50 pl-2.5">
                  <p className="font-mono text-[10px] tracking-[0.06em]" style={{ color: CYAN }}>WIND FIELD — CONSISTENT</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
                    {mockEnvironmentalInputs.wind.toUpperCase()} — tail orientation aligns with wind-assisted drift toward NE.
                  </p>
                </div>
                <div className="border-l-2 border-slate-700 pl-2.5">
                  <p className="font-mono text-[10px] tracking-[0.06em] text-slate-400">SURFACE CURRENT</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                    {mockEnvironmentalInputs.surfaceCurrent.toUpperCase()} — passed to downstream drift reconstruction.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">FALSE-POSITIVE DISCRIMINATION</h3>
              {phase < 4 && <span className="font-mono text-[8.5px] tracking-[0.12em] text-slate-600">LOCKED UNTIL STAGE 04</span>}
            </div>
            {fpTests.length > 0 && (
              <ul className="ot-fade-in mt-3 space-y-2">
                {fpTests.map(t => (
                  <li key={t.name} className="border border-slate-800/70 px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[9.5px] tracking-[0.08em] text-slate-300">{t.name}</span>
                      <span className="shrink-0 font-mono text-[9px] tracking-[0.06em]" style={{ color: fpTone[t.result] }}>
                        {t.result}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{t.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">EXPLAINABILITY</h3>
              {!complete && <span className="font-mono text-[8.5px] tracking-[0.12em] text-slate-600">LOCKED UNTIL STAGE 05</span>}
            </div>
            {complete && (
              <div className="ot-fade-in mt-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-slate-500">FINAL CLASSIFICATION</p>
                <p className="mt-1 font-mono text-[12px] tracking-[0.08em] text-accent-amber">
                  LIKELY OIL SLICK — VERIFICATION RECOMMENDED
                </p>
                <p className="mt-3 font-mono text-[9px] tracking-[0.16em] text-slate-500">WEIGHTED EVIDENCE</p>
                <ul className="mt-2 space-y-1.5">
                  {WEIGHTED_EVIDENCE.map(([sign, text, weight]) => (
                    <li key={text} className="flex items-start gap-2">
                      <span className={`w-3 shrink-0 font-mono text-[11px] leading-5 ${sign === '+' ? 'text-accent-cyan' : 'text-accent-amber'}`}>
                        {sign}
                      </span>
                      <span className="flex-1 text-[11px] leading-relaxed text-slate-300">{text}</span>
                      <span className="shrink-0 font-mono text-[9px] tabular-nums text-slate-500">{weight > 0 ? `+${weight}` : weight}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10.5px] italic leading-relaxed text-slate-500">
                  Classification reflects evidence balance under uncertainty — SAR alone does not guarantee oil, and the
                  flagged weather-artifact risk remains open until optical or in-situ verification.
                </p>
              </div>
            )}
          </section>

          <section className="px-4 py-4">
            <h3 className="font-mono text-[9px] tracking-[0.22em] text-slate-500">LIMITATIONS</h3>
            <ul className="mt-3 space-y-1.5">
              {[
                'Optical confirmation blocked by cloud cover at acquisition time',
                'Look-alike sources possible: biogenic film, low-wind zone, rain cell',
                'Single-pass acquisition — temporal persistence not yet verified',
                'Speckle noise limits boundary precision to roughly ±100 m',
                'Classification remains provisional until source reconstruction completes',
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-[5px] h-1 w-1 shrink-0 bg-accent-amber/80" />
                  <span className="text-[11px] leading-relaxed text-slate-400">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <footer className="border-t border-slate-800/60 p-3">
          {complete ? (
            <button
              onClick={() =>
                navigate(`/investigations/${id ?? FLAGSHIP}/source`, {
                  state: {
                    anomalyId: 'ANOM-01',
                    areaKm2: morph?.areaKm2 ?? 14.2,
                    confidence: FINAL_CONFIDENCE,
                    classification: 'LIKELY OIL SLICK — VERIFICATION RECOMMENDED',
                    wind: mockEnvironmentalInputs.wind,
                  },
                })
              }
              className="group flex w-full items-center justify-between px-1 py-1 text-left"
            >
              <span className="font-mono text-[10px] tracking-[0.18em] text-accent-cyan transition-colors group-hover:text-white">
                PROCEED TO SOURCE TRACE
              </span>
              <ChevronRight size={14} className="text-accent-cyan transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <span className="block px-1 py-1 font-mono text-[10px] tracking-[0.14em] text-slate-600">
              COMPLETE ALL ANALYSIS STAGES TO CONTINUE
            </span>
          )}
        </footer>
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[8.5px] tracking-[0.12em] text-slate-600">{label}</dt>
      <dd className="mt-0.5 font-mono text-[10.5px] text-slate-200">{value}</dd>
    </div>
  );
}
