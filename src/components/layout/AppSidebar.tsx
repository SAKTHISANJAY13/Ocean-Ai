import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Map, 
  Activity, 
  Crosshair, 
  Ship, 
  TestTube, 
  Network, 
  FileText,
  Settings,
  BookOpen
} from 'lucide-react';

const mainNav = [
  { name: '01 Command Center', path: '/overview' },
  { name: '02 Satellite Analysis', path: '/investigations/INC-204/detection' },
  { name: '03 Source Trace', path: '/investigations/INC-204/source' },
  { name: '04 Vessel Intelligence', path: '/investigations/INC-204/vessels' },
  { name: '05 Event Reconstruction', path: '/investigations/INC-204/hypothesis' },
  { name: '06 Incident Report', path: '/investigations/INC-204/report' },
];

export default function AppSidebar() {
  return (
    <aside className="w-64 border-r border-slate-700/50 bg-abyssal/80 backdrop-blur-md flex flex-col h-full shrink-0 transition-all duration-300 z-20 relative">
      <div className="flex-1 overflow-y-auto py-8 flex flex-col gap-1">
        <div className="mb-6 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
          ORIGIN Network
        </div>
        {mainNav.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-6 py-3 transition-all duration-300 group relative ${
                isActive
                  ? 'text-slate-200 bg-slate-800/40 font-medium'
                  : 'text-slate-400 hover:text-slate-300'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-cyan"></div>
                )}
                <span className="font-sans text-sm tracking-wide whitespace-nowrap">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
      
      <div className="p-6 border-t border-slate-700/50">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></div>
             <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">SAT FEED READY</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></div>
             <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">AIS NET ACTIVE</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
