import React from 'react';
import GlowButton from '../components/ui/GlowButton';
import SpotlightCard from '../components/ui/SpotlightCard';

const DashboardPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <div className="flex gap-4">
          <button className="bg-slate-800 hover:bg-slate-700 text-sm font-medium py-2 px-4 rounded-xl transition-all border border-slate-700">
            Export Report
          </button>
          <GlowButton variant="blue">
            Start Processing
          </GlowButton>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <SpotlightCard key={i} className="h-[120px]">
            <h3 className="text-slate-400 text-sm font-medium mb-2">Metric {i}</h3>
            <p className="text-3xl font-bold">0</p>
          </SpotlightCard>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
        <div className="lg:col-span-2">
          <SpotlightCard className="h-full">
            <h3 className="text-lg font-medium mb-4">Live Activity</h3>
            <div className="h-[calc(100%-2rem)] w-full flex items-center justify-center border-2 border-dashed border-slate-700/50 rounded-xl">
              <span className="text-slate-500">Chart Placeholder</span>
            </div>
          </SpotlightCard>
        </div>
        <div>
          <SpotlightCard className="h-full">
            <h3 className="text-lg font-medium mb-4">Recent Detections</h3>
            <div className="space-y-4">
              {[1,2,3,4].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                  <div className="w-10 h-10 bg-slate-700 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-slate-700 rounded mb-1"></div>
                    <div className="h-3 w-16 bg-slate-700/50 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
