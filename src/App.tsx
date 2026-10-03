import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppSidebar from './components/layout/AppSidebar';
import TopNavbar from './components/layout/TopNavbar';
import Overview from './pages/Overview';
import Investigations from './pages/Investigations';
import InvestigationWorkspace from './pages/InvestigationWorkspace';
import OilDetection from './pages/OilDetection';
import SourceReconstruction from './pages/SourceReconstruction';
import VesselIntelligence from './pages/VesselIntelligence';
import HypothesisTesting from './pages/HypothesisTesting';
import Reports from './pages/Reports';

import { assets } from './data/assets';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-abyssal text-slate-100 overflow-hidden font-sans relative">
        {/* LAYER 1 & 2: Base and Texture */}
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center opacity-30 mix-blend-screen pointer-events-none"
          style={{ backgroundImage: `url(${assets.oceanTexture})` }}
        ></div>
        
        {/* LAYER 3: Dark overlay for readability while keeping texture visible */}
        <div className="absolute inset-0 pointer-events-none bg-abyssal/60 z-0"></div>
        
        {/* LAYER 4: Moving Vessel Animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
           <div className="animate-vessel absolute top-1/2 left-0 w-32 h-16 flex items-center justify-center opacity-0 group">
              <div className="absolute -left-10 w-20 h-4 bg-white/20 blur-md animate-wake rounded-full pointer-events-none"></div>
              <img src={assets.vesselTopView} alt="Vessel" className="w-full h-full object-contain filter drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]" />
           </div>
        </div>

        {/* LAYER 5: Radar / grid overlays */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:60px_60px] z-0"></div>
        
        <div className="z-10 flex h-full w-full relative">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0 bg-transparent">
            <TopNavbar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<Overview />} />
              <Route path="/investigations" element={<Investigations />} />
              <Route path="/investigations/:id" element={<InvestigationWorkspace />}>
                <Route index element={<Navigate to="detection" replace />} />
                <Route path="detection" element={<OilDetection />} />
                <Route path="source" element={<SourceReconstruction />} />
                <Route path="vessels" element={<VesselIntelligence />} />
                <Route path="hypothesis" element={<HypothesisTesting />} />
                <Route path="report" element={<Reports />} />
              </Route>
            </Routes>
          </main>
        </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
