import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  Crosshair, 
  Ship, 
  TestTube, 
  FileText,
  Layers,
  Radio,
  Wifi
} from 'lucide-react';

interface NavItem {
  name: string;
  shortName: string;
  path: string;
  icon: typeof LayoutDashboard;
  badge?: string;
  badgeColor?: string;
}

const mainNav: NavItem[] = [
  { name: '01 Command Center', shortName: 'Command Center', path: '/overview', icon: LayoutDashboard },
  { name: '02 Satellite Analysis', shortName: 'SAR Detection', path: '/investigations/INC-204/detection', icon: Activity, badge: 'LIVE', badgeColor: 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/40' },
  { name: '03 Source Trace', shortName: 'Source Trace', path: '/investigations/INC-204/source', icon: Crosshair },
  { name: '04 Vessel Intelligence', shortName: 'Vessel Intel', path: '/investigations/INC-204/vessels', icon: Ship },
  { name: '05 Event Reconstruction', shortName: 'Reconstruction', path: '/investigations/INC-204/hypothesis', icon: TestTube },
  { name: '06 Incident Report', shortName: 'Dossier Report', path: '/investigations/INC-204/report', icon: FileText },
];

export default function AppSidebar() {
  return (
    <aside className="w-64 border-r border-slate-700/50 bg-abyssal/90 backdrop-blur-md flex flex-col h-full shrink-0 transition-all duration-300 z-20 relative select-none">
      <div className="flex-1 overflow-y-auto py-6 flex flex-col gap-1.5 custom-scrollbar">
        <div className="px-6 mb-3 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] font-mono">
            Navigation
          </span>
          <NavLink
            to="/investigations"
            className={({ isActive }) =>
              `flex items-center gap-1.5 text-[10px] font-mono tracking-wider px-2 py-0.5 rounded transition-colors ${
                isActive
                  ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`
            }
          >
            <Layers className="w-3 h-3" />
            <span>INCIDENTS</span>
          </NavLink>
        </div>

        {mainNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between mx-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 group relative ${
                  isActive
                    ? 'text-white bg-slate-800/70 border border-slate-700/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_8px_rgba(0,0,0,0.3)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`p-1.5 rounded-md transition-colors ${
                        isActive
                          ? 'bg-accent-cyan/20 text-accent-cyan shadow-[0_0_10px_rgba(0,184,212,0.3)]'
                          : 'bg-slate-800/40 text-slate-400 group-hover:text-slate-200 group-hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                    </span>
                    <span className="font-sans text-xs tracking-wide truncate">
                      {item.name}
                    </span>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border tracking-widest ${
                        item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent-cyan rounded-r shadow-[0_0_8px_rgba(0,184,212,0.8)]" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
      
      <div className="p-4 mx-3 mb-4 rounded-xl border border-slate-800/80 bg-navy/60 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-accent-cyan animate-pulse" />
            <span className="text-[10px] font-mono font-semibold tracking-widest text-slate-300 uppercase">
              Telemetry Feeds
            </span>
          </div>
          <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
            LIVE
          </span>
        </div>
        <div className="flex flex-col gap-2 font-mono text-[10px]">
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-cyan" />
              Sentinel-1 SAR
            </span>
            <span className="text-slate-300">PASS 11:18Z</span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-400" />
              AIS Receiver Net
            </span>
            <span className="text-slate-300">99.8% Sync</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
