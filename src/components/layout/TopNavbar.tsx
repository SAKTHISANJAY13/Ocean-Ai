import { useState, useEffect, useRef } from 'react';
import { Bell, Clock, ShieldAlert, AlertTriangle, Info, X, ExternalLink, LogOut, User as UserIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';

interface AlertItem {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  time: string;
  link?: string;
}

const mockAlerts: AlertItem[] = [
  {
    id: 'alt-1',
    type: 'critical',
    title: 'SAR Slick Detection',
    detail: 'High-confidence synthetic aperture radar slick anomaly (INC-204)',
    time: '4m ago',
    link: '/investigations/INC-204/detection'
  },
  {
    id: 'alt-2',
    type: 'warning',
    title: 'AIS Transponder Gap',
    detail: 'Candidate vessel IMO 9421881 dark period detected (4.2 hours)',
    time: '18m ago',
    link: '/investigations/INC-204/vessels'
  },
  {
    id: 'alt-3',
    type: 'info',
    title: 'Copernicus SAR Ingestion',
    detail: 'Sentinel-1B descending pass swath calibrated and georeferenced',
    time: '1h ago'
  }
];

export default function TopNavbar() {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(mockAlerts.length);
  const notifRef = useRef<HTMLDivElement>(null);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const day = String(now.getUTCDate()).padStart(2, '0');
      const month = months[now.getUTCMonth()];
      const year = now.getUTCFullYear();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      const secs = String(now.getUTCSeconds()).padStart(2, '0');
      setCurrentTime(`${day} ${month} ${year} · ${hours}:${mins}:${secs} UTC`);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close notifications on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  return (
    <header className="h-16 border-b border-slate-700/50 bg-navy/60 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 select-none">
      <div className="flex items-center gap-6">
        <div>
          <div className="flex items-baseline gap-3">
            <Link to="/overview" className="group">
              <h1 className="text-xl font-bold tracking-[0.2em] text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] group-hover:text-accent-cyan transition-colors">
                ORIGIN
              </h1>
            </Link>
            <span className="text-[9px] text-accent-cyan uppercase tracking-widest font-mono bg-accent-cyan/10 px-2 py-0.5 rounded border border-accent-cyan/30">
              From Slick to Source
            </span>
          </div>
          <p className="text-[10px] text-slate-400 tracking-wide mt-0.5 hidden sm:block">
            Oil-spill Recognition and Intelligent Geospatial Investigation Network
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {/* Live UTC Clock */}
        <div className="hidden md:flex items-center gap-2 bg-abyssal/90 border border-slate-700/60 px-3 py-1.5 rounded-lg text-slate-300 font-mono text-xs shadow-sm">
          <Clock className="w-3.5 h-3.5 text-accent-cyan" />
          <span className="tracking-wider">{currentTime || 'SYNCING UTC...'}</span>
        </div>

        {/* Active Flagship Incident Pill */}
        <Link
          to="/investigations/INC-204/detection"
          className="hidden lg:flex items-center gap-2 bg-accent-red/10 border border-accent-red/30 px-3 py-1 rounded-full hover:bg-accent-red/20 transition-all text-xs font-mono"
        >
          <span className="w-2 h-2 rounded-full bg-accent-red animate-ping" />
          <span className="font-semibold text-accent-red">INC-204</span>
          <span className="text-[10px] text-slate-400">CRITICAL</span>
        </Link>

        {/* System Online Status */}
        <div className="flex items-center gap-2 bg-abyssal/80 border border-accent-cyan/30 px-3 py-1.5 rounded-full">
           <div className="w-2 h-2 rounded-full bg-accent-cyan animate-pulse border border-accent-cyan shadow-[0_0_8px_rgba(0,184,212,0.8)]"></div>
           <span className="text-[11px] font-mono font-bold tracking-widest text-accent-cyan uppercase">System Online</span>
        </div>

        {/* Notification Bell with interactive popover */}
        <div className="relative border-l border-slate-700/50 pl-4" ref={notifRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) setUnreadCount(0);
            }}
            aria-label="Toggle notifications"
            className={`relative p-2 rounded-lg transition-all cursor-pointer ${
              showNotifications 
                ? 'bg-slate-800 text-white ring-1 ring-accent-cyan/40' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-accent-red rounded-full ring-2 ring-navy shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-84 bg-abyssal/95 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-accent-cyan" />
                  <span className="font-mono text-xs font-bold tracking-wider text-white uppercase">Operational Alerts</span>
                </div>
                <button 
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800/60 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto custom-scrollbar">
                {mockAlerts.map(alert => (
                  <div key={alert.id} className="p-3.5 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-start gap-2.5">
                      {alert.type === 'critical' ? (
                        <AlertTriangle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
                      ) : alert.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-accent-cyan shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="text-xs font-semibold text-slate-200 truncate">{alert.title}</span>
                          <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap">{alert.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{alert.detail}</p>
                        {alert.link && (
                          <Link 
                            to={alert.link}
                            onClick={() => setShowNotifications(false)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-accent-cyan mt-1.5 hover:underline"
                          >
                            <span>Inspect Incident</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2.5 bg-slate-900/60 border-t border-slate-800/80 text-center">
                <span className="text-[10px] font-mono text-slate-500">
                  Sector 4 Surveillance • Automated AI Ingestion
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Authenticated Investigator Profile & Logout */}
        {user ? (
          <div className="flex items-center gap-3 border-l border-slate-700/50 pl-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-200 tracking-wide font-sans">
                {user.name}
              </span>
              <span className="text-[9px] font-mono text-accent-cyan uppercase tracking-wider">
                {user.role}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-accent-cyan/10 border border-accent-cyan/40 flex items-center justify-center text-accent-cyan shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              <UserIcon className="w-4 h-4" />
            </div>

            <button
              onClick={handleLogout}
              title="Sign Out of ORIGIN"
              aria-label="Sign out of ORIGIN"
              className="p-2 rounded-lg text-slate-400 hover:text-accent-red hover:bg-accent-red/10 border border-transparent hover:border-accent-red/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="border-l border-slate-700/50 pl-4">
            <Link
              to="/login"
              className="px-3 py-1.5 rounded-lg bg-accent-cyan/20 border border-accent-cyan/40 text-accent-cyan font-mono text-xs hover:bg-accent-cyan/30 transition-all"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
