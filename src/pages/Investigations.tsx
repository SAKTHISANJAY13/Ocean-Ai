import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockIncidents } from '../data/mockData';
import { Search, AlertTriangle, Activity, Clock, CheckCircle } from 'lucide-react';

export default function Investigations() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  
  const filters = ['All', 'Active', 'High Priority', 'Pending', 'Completed'];

  const filteredIncidents = mockIncidents.filter(inc => {
    if (filter === 'All') return true;
    if (filter === 'Active') return inc.status.includes('Investigation');
    if (filter === 'High Priority') return inc.priority === 'High';
    if (filter === 'Pending') return inc.status.includes('Pending');
    if (filter === 'Completed') return inc.status === 'Completed';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-transparent p-8 overflow-hidden">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Investigations</h1>
          <p className="text-slate-400">Manage and track all maritime anomaly events.</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 shrink-0 glass-panel p-2 rounded-xl">
        <div className="flex gap-2">
          {filters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-accent-cyan/20 text-accent-cyan shadow-[inset_0_0_10px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        
        <div className="relative mr-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search incidents..." 
            className="w-64 bg-slate-900 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-slate-300 focus:outline-none focus:border-accent-cyan/50 focus:ring-1 focus:ring-accent-cyan/50 transition-all placeholder:text-slate-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-0">
        <div className="grid grid-cols-1 gap-4">
          {filteredIncidents.map(incident => (
            <div 
              key={incident.id}
              onClick={() => navigate(`/investigations/${incident.id}/detection`)}
              className="glass-panel p-6 rounded-xl hover:border-accent-cyan/40 hover:bg-slate-800/60 transition-all cursor-pointer group flex items-center gap-8 relative overflow-hidden"
            >
              {/* Highlight bar for high priority */}
              {incident.priority === 'High' && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-red shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
              )}
              
              <div className="w-48 shrink-0">
                <div className="text-sm font-mono text-slate-400 mb-1">ID</div>
                <div className="text-xl font-bold font-mono text-white group-hover:text-accent-cyan transition-colors">{incident.id}</div>
              </div>
              
              <div className="w-48 shrink-0">
                <div className="text-sm font-mono text-slate-400 mb-1">Region</div>
                <div className="text-base font-medium text-slate-200">{incident.region}</div>
              </div>
              
              <div className="w-48 shrink-0">
                <div className="text-sm font-mono text-slate-400 mb-1">Detection Time (UTC)</div>
                <div className="text-base font-medium text-slate-300 whitespace-nowrap">
                  {new Date(incident.observedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })}
                </div>
              </div>

              <div className="w-32 shrink-0">
                <div className="text-sm font-mono text-slate-400 mb-1">Confidence</div>
                <div className="flex items-center gap-2">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-accent-cyan rounded-full" 
                      style={{ width: `${incident.oilConfidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-mono text-accent-cyan font-bold">{Math.round(incident.oilConfidence * 100)}%</span>
                </div>
              </div>
              
              <div className="flex-1 flex justify-end gap-3">
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${
                  incident.status.includes('High') ? 'bg-accent-red/10 text-accent-red border border-accent-red/20' : 
                  incident.status.includes('Pending') ? 'bg-accent-amber/10 text-accent-amber border border-accent-amber/20' : 
                  'bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/20'
                }`}>
                  {incident.status.includes('High') && <AlertTriangle className="w-3.5 h-3.5" />}
                  {incident.status.includes('Pending') && <Clock className="w-3.5 h-3.5" />}
                  {incident.status.includes('Investigation') && <Activity className="w-3.5 h-3.5" />}
                  {incident.status.includes('Completed') && <CheckCircle className="w-3.5 h-3.5" />}
                  {incident.status}
                </span>
                
                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${
                  incident.priority === 'High' ? 'bg-accent-red/20 text-accent-red border-accent-red/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 
                  incident.priority === 'Medium' ? 'bg-accent-amber/10 text-accent-amber border-accent-amber/30' : 
                  'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {incident.priority} Priority
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
