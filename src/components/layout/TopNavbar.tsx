import { Bell } from 'lucide-react';

export default function TopNavbar() {
  return (
    <header className="h-16 border-b border-slate-700/50 bg-navy/40 backdrop-blur-md flex items-center justify-between px-8 shrink-0 z-10 sticky top-0">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold tracking-[0.2em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              ORIGIN
            </h1>
            <span className="text-[9px] text-accent-cyan uppercase tracking-widest font-mono">From Slick to Source</span>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide mt-1">
            Oil-spill Recognition and Intelligent Geospatial Investigation Network
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 bg-abyssal/80 border border-accent-cyan/20 px-4 py-1.5 rounded-full">
           <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse border border-accent-cyan shadow-[0_0_8px_rgba(0,184,212,0.8)]"></div>
           <span className="text-xs font-mono font-bold tracking-widest text-accent-cyan uppercase">System Online</span>
        </div>
        <div className="flex items-center gap-3 border-l border-slate-700/50 pl-6">
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-accent-red rounded-full shadow-[0_0_5px_rgba(239,68,68,1)]"></span>
          </button>
        </div>
      </div>
    </header>
  );
}
