import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { Shield, Radio } from "lucide-react";

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-abyssal text-slate-100 relative overflow-hidden select-none">
        {/* Radar ambient grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]" />

        <div className="flex flex-col items-center gap-6 z-10 px-6 py-8 rounded-2xl bg-navy/60 border border-slate-700/60 backdrop-blur-xl shadow-2xl max-w-sm text-center">
          <div className="relative flex items-center justify-center">
            {/* Pulsing radar rings */}
            <div className="absolute w-20 h-20 rounded-full border border-accent-cyan/30 animate-ping opacity-50" />
            <div className="absolute w-14 h-14 rounded-full border border-accent-cyan/50 animate-pulse" />
            <div className="w-12 h-12 rounded-full bg-accent-cyan/10 border border-accent-cyan flex items-center justify-center text-accent-cyan shadow-[0_0_20px_rgba(6,182,212,0.5)]">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-2 text-accent-cyan font-mono text-xs font-bold tracking-widest uppercase">
              <Radio className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying Session</span>
            </div>
            <p className="text-slate-400 text-xs font-mono">
              Authenticating ORIGIN cryptographic credentials...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
