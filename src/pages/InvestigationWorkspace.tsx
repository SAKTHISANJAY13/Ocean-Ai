import { useState } from 'react';
import { Outlet, useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { mockIncidents } from '../data/mockData';

export default function InvestigationWorkspace() {
  const { id } = useParams();
  const location = useLocation();
  const incident = mockIncidents.find(i => i.id === id) || mockIncidents[0];
  const [detectPhase, setDetectPhase] = useState(0);

  const onDetectionRoute = location.pathname.includes('/detection');
  const detectionLive = onDetectionRoute && detectPhase > 0;
  const stagePct = [0, 14, 42, 63, 78, 87][Math.min(detectPhase, 5)];
  const confidenceLabel =
    detectPhase === 0 ? `${Math.round(incident.oilConfidence * 100)}%` : `${stagePct}%`;

  const pipelineSteps = [
    { id: 'detection', name: '01 DETECT' },
    { id: 'source', name: '02 RECONSTRUCT' },
    { id: 'vessels', name: '03 CORRELATE' },
    { id: 'hypothesis', name: '04 TEST' },
    { id: 'report', name: '05 EXPLAIN & 06 REPORT' }
  ];

  return (
    <div className="flex flex-col h-full bg-transparent">
      <header className="px-6 py-4 border-b border-slate-800 bg-navy/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/investigations" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h2 className="text-xl font-bold font-mono text-white tracking-wide">{incident.id}</h2>
              <div className="flex items-center gap-3 text-xs mt-1">
                <span className="text-accent-amber font-semibold tracking-widest uppercase">STATUS: {incident.status}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Observed: {new Date(incident.observedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">Overall Analysis Confidence: <span className="text-accent-cyan font-bold">{confidenceLabel}</span></span>
                {detectionLive && detectPhase < 5 && (
                  <span className="flex items-center gap-1 text-accent-amber">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-amber" />
                    ANALYSIS IN PROGRESS
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Navigation */}
        <div className="flex items-center justify-between mt-6 max-w-4xl">
          {pipelineSteps.map((step, index) => {
            const isActive = location.pathname.includes(`/${step.id}`) || (index === 0 && detectionLive);
            const isPast = pipelineSteps.findIndex(s => location.pathname.includes(`/${s.id}`)) > index;

            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <Link
                  to={`/investigations/${id}/${step.id}`}
                  className={`text-xs font-bold tracking-widest transition-all duration-300 ${
                    isActive ? 'text-accent-cyan' : isPast ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  [{step.name}
                  {index === 0 && detectionLive && detectPhase < 5 ? ` · ${detectPhase}/5` : ''}]
                  {index === 0 && detectionLive && (
                    <span className="mt-1 block h-[2px] w-full max-w-[72px] bg-slate-800">
                      <span
                        className="block h-full bg-accent-cyan/70 transition-all duration-700"
                        style={{ width: `${(detectPhase / 5) * 100}%` }}
                      />
                    </span>
                  )}
                </Link>
                {index < pipelineSteps.length - 1 && (
                  <div className={`flex-1 mx-4 h-[1px] ${
                    isPast ? 'bg-accent-cyan/50' : 'bg-slate-800'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </header>
      
      <div className="flex-1 relative overflow-hidden">
        <Outlet context={{ setDetectPhase }} />
      </div>
    </div>
  );
}
