import { useState } from 'react';
import { ChevronDown, Download, Share2 } from 'lucide-react';
import { mockIncidents, mockSourceZones, mockVessels } from '../data/mockData';

const CYAN = '#00B8D4';

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-slate-800/80 py-7">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-accent-cyan/60">{n}</span>
        <h2 className="text-sm font-semibold tracking-[0.18em] text-slate-200">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Meta({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="font-mono text-[9px] tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className={`mt-1 font-mono text-[12px] ${tone ?? 'text-slate-200'}`}>{value}</dd>
    </div>
  );
}

export default function Reports() {
  const [openMethodology, setOpenMethodology] = useState(false);
  const [openRunParams, setOpenRunParams] = useState(false);

  const incident = mockIncidents[0];
  const topCandidate = mockVessels.find(v => v.priorityLevel === 'Top Ranked Candidate') ?? mockVessels[0];
  const zoneB = mockSourceZones.find(z => z.id === 'ZONE B');
  const zoneC = mockSourceZones.find(z => z.id === 'ZONE C');

  return (
    <div className="h-full w-full overflow-y-auto custom-scrollbar">
      <div className="mx-auto max-w-[880px] px-10 pb-10 pt-8">
        <header className="flex items-start justify-between gap-6 pb-7">
          <div>
            <p className="font-mono text-[10px] tracking-[0.28em] text-slate-500">ORIGIN · FORENSIC INCIDENT DOSSIER</p>
            <h1 className="mt-2 font-mono text-3xl tracking-tight text-slate-100">{incident.id}</h1>
            <p className="mt-1 font-mono text-[10px] tracking-[0.14em] text-slate-500">
              REF OT-DOS-204-26 · CLASSIFICATION: INTERNAL — INVESTIGATIVE USE ONLY
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="flex items-center gap-1.5 border border-slate-700/60 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] text-slate-400 transition-colors hover:text-white"
              aria-label="Share dossier"
            >
              <Share2 size={12} />
              SHARE
            </button>
            <button
              className="flex items-center gap-1.5 border border-accent-cyan/40 px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] text-accent-cyan transition-colors hover:bg-accent-cyan/10 hover:text-white"
              aria-label="Export report"
            >
              <Download size={12} />
              EXPORT REPORT
            </button>
          </div>
        </header>

        <Section n="01" title="INCIDENT SUMMARY">
          <dl className="grid grid-cols-3 gap-x-8 gap-y-4">
            <Meta label="INCIDENT ID" value={incident.id} />
            <Meta label="REGION" value={incident.region.toUpperCase()} />
            <Meta label="DETECTION TIME" value="18 AUG 2026 · 04:32 UTC" />
            <Meta label="PRIORITY" value={incident.priority.toUpperCase()} tone="text-accent-red" />
            <Meta label="DETECTION SOURCE" value="SENTINEL-1A SAR" />
            <div>
              <dt className="font-mono text-[9px] tracking-[0.16em] text-slate-500">STATUS</dt>
              <dd className="mt-1">
                <span className="inline-block border border-accent-amber/40 bg-accent-amber/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-accent-amber">
                  ACTIVE — FURTHER INVESTIGATION REQUIRED
                </span>
              </dd>
            </div>
          </dl>
        </Section>

        <Section n="02" title="DETECTION">
          <dl className="grid grid-cols-3 gap-x-8 gap-y-4">
            <Meta label="CLASSIFICATION" value="POSSIBLE SURFACE OIL ANOMALY" tone="text-accent-amber" />
            <Meta label="DETECTION CONFIDENCE" value={`${(incident.oilConfidence * 100).toFixed(1)}%`} tone="text-accent-cyan" />
            <Meta label="ESTIMATED SLICK AREA" value={`≈ ${incident.areaKm2} KM²`} />
          </dl>
          <div className="mt-3 h-[2px] w-full max-w-[420px] bg-slate-800">
            <div className="h-full bg-accent-cyan" style={{ width: `${(incident.oilConfidence * 100).toFixed(1)}%` }} />
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
            A dark elongated feature was identified in SAR imagery acquired at detection time. The anomaly is
            classified as <span className="text-slate-200">possible</span> surface oil pending verification — a dark
            signature alone is not confirmatory of oil.
          </p>
        </Section>

        <Section n="03" title="SATELLITE VERIFICATION">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-mono text-[9px] tracking-[0.18em] text-accent-cyan/80">SAR EVIDENCE</p>
              <ul className="mt-2 space-y-1.5">
                {[
                  'Elongated feature with smooth homogeneous texture, distinct from wind-roughened sea surface',
                  'Sharp northern boundary with diffuse southern tail, consistent with film drift',
                  'Backscatter damping pattern consistent with capillary-wave suppression',
                  'Secondary segment flagged separately as possible look-alike (Candidate B)',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 bg-accent-cyan" />
                    <span className="text-[12.5px] leading-relaxed text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-[0.18em] text-accent-amber">OPTICAL / EO EVIDENCE</p>
              <div className="mt-2 border-l-2 border-accent-amber/50 pl-3">
                <p className="font-mono text-[11px] tracking-[0.08em] text-accent-amber">UNAVAILABLE — CLOUD OBSTRUCTION</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
                  Convective cloud cover over ≥95% of the scene during the nearest optical pass (08:47 UTC).
                  Verification proceeded on SAR evidence alone for this acquisition; next revisit ≈ 09 H.
                </p>
              </div>
              <p className="mt-4 font-mono text-[9px] tracking-[0.18em] text-slate-500">DATA LIMITATIONS</p>
              <ul className="mt-2 space-y-1">
                {['Single-pass acquisition — temporal persistence not verified', 'Speckle limits boundary precision to roughly ±100 m'].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 bg-slate-600" />
                    <span className="text-[12px] leading-relaxed text-slate-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section n="04" title="SOURCE TRACE">
          <div className="grid grid-cols-[1fr_240px] gap-8">
            <div>
              <div className="border-l-2 border-accent-cyan/60 pl-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-slate-500">MOST PROBABLE SOURCE REGION</p>
                <p className="mt-1 font-mono text-sm text-slate-100">
                  ZONE A · {mockSourceZones[0].probability}%{' '}
                  <span className="text-[11px] text-slate-500">· 12.84°N 80.32°E</span>
                </p>
                <p className="mt-0.5 font-mono text-[10.5px] text-slate-400">
                  ESTIMATED RELEASE WINDOW: {mockSourceZones[0].estimatedWindow.toUpperCase()} BEFORE DETECTION
                </p>
              </div>

              <table className="mt-5 w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800/80">
                    <th className="pb-1.5 font-mono text-[9px] tracking-[0.14em] text-slate-500">ALTERNATIVE REGION</th>
                    <th className="pb-1.5 text-right font-mono text-[9px] tracking-[0.14em] text-slate-500">PROBABILITY</th>
                    <th className="pb-1.5 text-right font-mono text-[9px] tracking-[0.14em] text-slate-500">RELEASE WINDOW</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[11px] text-slate-300">
                  <tr className="border-b border-slate-800/40">
                    <td className="py-1.5">{zoneB?.id}</td>
                    <td className="py-1.5 text-right text-accent-amber">{zoneB?.probability}%</td>
                    <td className="py-1.5 text-right text-slate-500">{zoneB?.estimatedWindow}</td>
                  </tr>
                  <tr className="border-b border-slate-800/40">
                    <td className="py-1.5">{zoneC?.id}</td>
                    <td className="py-1.5 text-right text-accent-amber">{zoneC?.probability}%</td>
                    <td className="py-1.5 text-right text-slate-500">{zoneC?.estimatedWindow}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-500">UNRESOLVED</td>
                    <td className="py-1.5 text-right text-slate-500">4%</td>
                    <td className="py-1.5 text-right text-slate-600">—</td>
                  </tr>
                </tbody>
              </table>

              <p className="mt-5 text-[13px] leading-relaxed text-slate-400">
                Backward ensemble hindcast (<span className="font-mono text-[11px] text-slate-300">OT-HINDCAST v2.4</span>):
                particles were seeded across the full observed area — including disconnected fragments F-1…F-3 — and
                advected backward through time-varying current, wind and diffusion forcing over a T-36 H window.
                Source regions emerge from the accumulated particle distribution; probabilities express relative
                likelihood, not proof of origin.
              </p>

              <button
                onClick={() => setOpenMethodology(o => !o)}
                className="mt-2 flex items-center gap-1.5 py-1 font-mono text-[9px] tracking-[0.16em] text-accent-cyan transition-colors hover:text-white"
              >
                METHODOLOGY DETAIL
                <ChevronDown size={11} className={`transition-transform ${openMethodology ? 'rotate-180' : ''}`} />
              </button>
              {openMethodology && (
                <dl className="ot-fade-in mt-1 grid grid-cols-2 gap-x-8 gap-y-2 border-l border-slate-800 pl-4">
                  {[
                    ['VISUAL ENSEMBLE', '240 PARTICLES'],
                    ['MODEL CONFIGURATION', '10,000 PARTICLES'],
                    ['SIMULATION WINDOW', 'NOW → T-36 H'],
                    ['FORCING', 'TIME-VARYING CURRENT / WIND / DIFFUSION'],
                    ['REGION DERIVATION', 'CONVEX HULLS OF CLUSTERED ENSEMBLE'],
                    ['FRAGMENT HANDLING', 'INDEPENDENT SUB-ENSEMBLES'],
                  ].map(([kk, vv]) => (
                    <div key={kk}>
                      <dt className="font-mono text-[8.5px] tracking-[0.14em] text-slate-600">{kk}</dt>
                      <dd className="font-mono text-[10px] text-slate-300">{vv}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <figure>
              <svg viewBox="0 0 220 96" className="w-full">
                <path d="M150 30 C168 24 190 28 196 38 C200 46 188 52 170 53 C154 54 142 48 144 39 C145 33 146 31 150 30 Z" fill="none" stroke={CYAN} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.85" />
                <text x="146" y="66" fill="#67E8F9" fontSize="7" fontFamily="'JetBrains Mono', monospace">OBSERVED SLICK</text>

                <path d="M52 34 C74 26 102 30 110 42 C116 51 104 62 82 65 C62 68 44 62 42 50 C41 41 45 36 52 34 Z" fill="rgba(245,158,11,0.20)" stroke="#F59E0B" strokeWidth="1.1" strokeDasharray="4 3" />
                <text x="58" y="52" fill="#F59E0B" fontSize="8" fontFamily="'JetBrains Mono', monospace">ZONE A · 71%</text>

                <path d="M138 76 C148 73 158 75 160 80 C161 84 152 87 143 86 C136 85 133 81 134 79 Z" fill="rgba(245,158,11,0.10)" stroke="#F59E0B" strokeWidth="0.9" strokeDasharray="3 3" opacity="0.8" />
                <text x="128" y="94" fill="#94A3B8" fontSize="6.5" fontFamily="'JetBrains Mono', monospace">B · 18%</text>

                <path d="M186 74 C191 73 195 75 195 78 C195 80 190 81 187 80 C184 79 184 76 186 74 Z" fill="rgba(245,158,11,0.08)" stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
                <text x="180" y="89" fill="#64748B" fontSize="6" fontFamily="'JetBrains Mono', monospace">C · 7%</text>

                <line x1="118" y1="58" x2="140" y2="44" stroke="#94A3B8" strokeWidth="0.8" markerEnd="url(#arr)" opacity="0.7" />
                <defs>
                  <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#94A3B8" />
                  </marker>
                </defs>
                <text x="126" y="40" fill="#94A3B8" fontSize="6.5" fontFamily="'JetBrains Mono', monospace">NE DRIFT</text>
              </svg>
              <figcaption className="mt-1 text-center font-mono text-[8px] tracking-[0.14em] text-slate-600">
                SCHEMATIC — ENSEMBLE-DERIVED REGIONS, NOT TO SCALE
              </figcaption>
            </figure>
          </div>
        </Section>

        <Section n="05" title="VESSEL INVESTIGATION">
          <p className="text-[13px] leading-relaxed text-slate-400">
            Region-wide AIS correlation narrowed 142 vessels → 37 within the temporal window → 12 near emerged source
            regions → 5 trajectory-consistent → 3 high-priority candidates, screened by temporal presence, source-region
            proximity, trajectory consistency and vessel-type relevance.
          </p>

          <div className="mt-4 space-y-px">
            {[...mockVessels]
              .sort((a, b) => b.priorityScore - a.priorityScore)
              .map((v, i) => (
                <div
                  key={v.id}
                  className={`flex items-baseline justify-between gap-4 border-l-2 px-3 py-2 ${
                    i === 0 ? 'border-accent-cyan/70 bg-white/[0.02]' : 'border-transparent'
                  }`}
                >
                  <div className="flex items-baseline gap-3">
                    <span className={`font-mono text-[10px] ${i === 0 ? 'text-accent-cyan' : 'text-slate-600'}`}>0{i + 1}</span>
                    <span className="text-[13px] font-medium text-slate-200">{v.name}</span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {v.type.toUpperCase()} · {v.flag.toUpperCase()} · MMSI {v.mmsi}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3">
                    <span className="font-mono text-[9px] tracking-[0.1em]" style={{ color: i === 0 ? '#00B8D4' : i === 1 ? '#F59E0B' : '#64748B' }}>
                      {v.priorityLevel.toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{v.priorityScore}</span>
                  </div>
                </div>
              ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-8">
            <div>
              <p className="font-mono text-[9px] tracking-[0.18em] text-slate-500">EVIDENCE SUPPORTING INVESTIGATION — {topCandidate.name}</p>
              <ul className="mt-2 space-y-1.5">
                {topCandidate.evidence.map(ev => (
                  <li key={ev} className="flex items-start gap-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 bg-accent-cyan" />
                    <span className="text-[12.5px] leading-relaxed text-slate-300">{ev}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-mono text-[9px] tracking-[0.18em] text-accent-amber/90">EVIDENCE LIMITATIONS</p>
              <ul className="mt-2 space-y-1.5">
                {[
                  '114-minute AIS gap means the vessel position is unverified exactly where evidence is most relevant',
                  'An AIS gap or speed anomaly is not, by itself, proof of unlawful behaviour',
                  'Busy shipping lanes can produce similar trajectories from unrelated vessels',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-[6px] h-1 w-1 shrink-0 bg-accent-amber/80" />
                    <span className="text-[12.5px] leading-relaxed text-slate-400">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        <Section n="06" title="EVENT RECONSTRUCTION">
          <div className="grid grid-cols-[1fr_260px] gap-8">
            <div>
              <div className="border-l-2 border-accent-cyan/60 pl-3">
                <p className="font-mono text-[9px] tracking-[0.16em] text-slate-500">SELECTED HYPOTHESIS</p>
                <p className="mt-1 text-[13px] text-slate-200">
                  Release from <span className="font-medium">{topCandidate.name}</span> at the AIS-gap entry point
                  (<span className="font-mono text-[11px]">12.833°N 80.323°E</span>) at approximately{' '}
                  <span className="font-mono text-[11px]">T-23 H</span>, inside the Zone A release window.
                </p>
              </div>

              <p className="mt-4 text-[13px] leading-relaxed text-slate-400">
                Forward drift simulation (<span className="font-mono text-[11px] text-slate-300">OT-DRIFT v2.1</span>,
                260-particle ensemble under recorded current, windage and diffusion) propagated the hypothetical release
                to the satellite detection time and compared it against the observed slick.
              </p>

              <div className="mt-4 border-l-2 border-accent-cyan/70 bg-accent-cyan/[0.04] py-2.5 pl-3">
                <p className="font-mono text-[12px] tracking-[0.12em] text-accent-cyan">RESULT: HIGHLY CONSISTENT</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">
                  The majority of the simulated ensemble falls within the observed boundary at detection time; centroid
                  offset ≈ 0.9 km; simulated spread and elongation lie within the observed uncertainty envelope;
                  required transport direction is aligned with the recorded NE current regime.
                </p>
              </div>

              <button
                onClick={() => setOpenRunParams(o => !o)}
                className="mt-2 flex items-center gap-1.5 py-1 font-mono text-[9px] tracking-[0.16em] text-accent-cyan transition-colors hover:text-white"
              >
                RUN PARAMETERS
                <ChevronDown size={11} className={`transition-transform ${openRunParams ? 'rotate-180' : ''}`} />
              </button>
              {openRunParams && (
                <dl className="ot-fade-in mt-1 grid grid-cols-2 gap-x-8 gap-y-2 border-l border-slate-800 pl-4">
                  {[
                    ['TRANSPORT MODEL', 'CURRENT + WINDAGE + DIFFUSION'],
                    ['ENSEMBLE SIZE', '260 PARTICLES'],
                    ['TIME STEP', '3 H'],
                    ['COMPARISON FIX', '5-VERTEX SAR POLYGON'],
                    ['SPATIAL INDICATOR', 'BOUNDARY OVERLAP + CENTROID OFFSET'],
                    ['TEMPORAL INDICATOR', 'WINDOW FEASIBILITY VS DRIFT REGIME'],
                  ].map(([kk, vv]) => (
                    <div key={kk}>
                      <dt className="font-mono text-[8.5px] tracking-[0.14em] text-slate-600">{kk}</dt>
                      <dd className="font-mono text-[10px] text-slate-300">{vv}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <p className="mt-3 text-[12px] italic leading-relaxed text-slate-500">
                Consistency describes agreement between hypothesis and observation. It does not establish causation or
                responsibility.
              </p>
            </div>

            <figure>
              <svg viewBox="0 0 240 116" className="w-full">
                <path d="M28 84 C52 72 84 70 110 60 C132 52 152 44 166 47 C178 50 174 63 158 72 C132 86 92 98 58 97 C40 96 24 93 28 84 Z" fill="rgba(0,184,212,0.05)" stroke={CYAN} strokeWidth="1.4" />
                <circle cx="96" cy="74" r="2.4" fill="none" stroke={CYAN} strokeWidth="1.2" />

                <path d="M64 66 C88 52 122 42 148 38 C164 35 172 40 170 49 C167 61 146 70 120 76 C98 81 74 80 64 74 Z" fill="rgba(245,158,11,0.16)" stroke="#F59E0B" strokeWidth="0.9" strokeDasharray="4 3" />
                <circle cx="121" cy="59" r="2.4" fill="#F59E0B" fillOpacity="0.9" />

                <line x1="99" y1="73" x2="119" y2="60" stroke="#94A3B8" strokeWidth="0.9" strokeDasharray="3 3" />
                <text x="106" y="70" fill="#CBD5E1" fontSize="7.5" fontFamily="'JetBrains Mono', monospace">Δ ≈ 0.9 KM</text>

                <text x="30" y="108" fill="#67E8F9" fontSize="7" fontFamily="'JetBrains Mono', monospace">○ OBSERVED</text>
                <text x="96" y="108" fill="#F59E0B" fontSize="7" fontFamily="'JetBrains Mono', monospace">▨ SIMULATED AT DETECTION TIME</text>
              </svg>
              <figcaption className="mt-1 text-center font-mono text-[8px] tracking-[0.14em] text-slate-600">
                OVERLAY AT DETECTION TIME — SIMPLIFIED RECORD OF COMPARISON RUN
              </figcaption>
            </figure>
          </div>
        </Section>

        <Section n="07" title="ENVIRONMENTAL CONTEXT">
          <dl className="grid grid-cols-4 gap-x-8 gap-y-4">
            <Meta label="SURFACE CURRENT" value="1.2 M/S · NE" />
            <Meta label="WIND" value="18 KM/H · SW" />
            <Meta label="RELEVANT WINDOW" value="17 AUG 01:32 → 18 AUG 04:32 UTC" />
            <Meta label="MODEL FEEDS" value="OT-HINDCAST v2.4 · OT-DRIFT v2.1" />
          </dl>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
            Wind speed remained below the ≈10 m/s threshold above which surface films are dispersed beyond radar
            detectability; transport direction recorded at detection is consistent with the reconstructed drift.
          </p>
        </Section>

        <Section n="08" title="EVIDENCE LIMITATIONS">
          <ol className="space-y-2">
            {[
              'Incomplete AIS coverage — a 114-minute transmission gap occurs entirely inside the estimated release window, leaving the vessel path unverified where evidence weight is highest.',
              'Cloud-obstructed optical imagery — no independent optical confirmation of the anomaly exists for this acquisition.',
              'Environmental model uncertainty — forcing fields are reanalysis-grade; local current and wind variability is not fully resolved.',
              'Multiple plausible source regions persist — Zone B (18%), Zone C (7%) and an unresolved 4% cannot be excluded.',
              'Insufficient spatial match — forward tests for alternative hypotheses were less exhaustive than the primary configuration.',
              'Single-pass detection — slick persistence and evolution between passes was not observed.',
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 font-mono text-[10px] text-accent-amber/70">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[12.5px] leading-relaxed text-slate-400">{item}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section n="09" title="FINAL ASSESSMENT">
          <div className="border border-accent-amber/30 bg-accent-amber/[0.04] p-5">
            <p className="font-mono text-[10px] tracking-[0.22em] text-accent-amber">MOST CONSISTENT HYPOTHESIS</p>
            <p className="mt-2.5 max-w-[640px] text-[14px] leading-relaxed text-slate-200">
              The available evidence is most consistent with a release associated with{' '}
              <span className="font-medium text-white">{topCandidate.name}</span> during its AIS signal gap, within the
              Zone A release window (T-27 H … T-18 H before detection). This remains a working hypothesis: correlation
              and simulation consistency do not constitute proof of responsibility.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="border border-accent-amber/40 bg-accent-amber/10 px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] text-accent-amber">
                FURTHER INVESTIGATION RECOMMENDED
              </span>
              <span className="border border-slate-700 px-2.5 py-1 font-mono text-[9.5px] tracking-[0.14em] text-slate-400">
                ATTRIBUTION NOT ESTABLISHED
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Definitive attribution would require corroborating evidence such as physical slick sampling, discharge
            records, or port-state inspection findings. This dossier is generated by the ORIGIN automated forensic
            pipeline and requires qualified analyst review before any operational or legal use.
          </p>
        </Section>

        <footer className="mt-2 flex items-center justify-between border-t border-slate-800/80 pt-4 font-mono text-[8.5px] tracking-[0.16em] text-slate-600">
          <span>ORIGIN FORENSIC PIPELINE · DOC CONTROL OT-DOS-204-26</span>
          <span>PAGE 01 / 01 · INTERNAL USE ONLY</span>
        </footer>
      </div>
    </div>
  );
}

