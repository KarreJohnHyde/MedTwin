import React from 'react';
import { OrganId } from '../lib/twins';
import { ORGAN_CLINICAL_DATA } from '../lib/organData';
import { Activity } from 'lucide-react';

interface OrganTelemetryProps {
  organId: OrganId;
}

export const OrganTelemetry: React.FC<OrganTelemetryProps> = ({ organId }) => {
  const organData = ORGAN_CLINICAL_DATA[organId];
  if (!organData) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-cyan-400 mb-2">
        <Activity className="w-4 h-4" />
        <h3 className="text-sm font-semibold uppercase tracking-wider">Live Biomarkers</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {organData.biomarkers.map((marker, index) => {
          // Calculate percentage for the progress bar based on normal range
          const range = marker.maxNormal - marker.minNormal;
          // Just for visual effect if value is outside range
          const safeMin = marker.minNormal - range * 0.5;
          const safeMax = marker.maxNormal + range * 0.5;
          const totalRange = safeMax - safeMin;
          const percentage = Math.max(0, Math.min(100, ((marker.value - safeMin) / totalRange) * 100));
          
          const isWarning = marker.status === 'warning';
          const isCritical = marker.status === 'critical';
          
          let colorClass = "bg-cyan-500";
          let textColor = "text-cyan-400";
          if (isWarning) {
            colorClass = "bg-amber-500";
            textColor = "text-amber-400";
          } else if (isCritical) {
            colorClass = "bg-rose-500";
            textColor = "text-rose-400";
          }

          return (
            <div key={index} className="bg-slate-900/40 rounded-lg p-3 border border-slate-800/60 backdrop-blur-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-slate-400 font-medium truncate pr-2">{marker.name}</span>
                <span className={`text-sm font-bold ${textColor}`}>
                  {marker.value}
                  <span className="text-[10px] text-slate-500 ml-1 font-normal">{marker.unit}</span>
                </span>
              </div>
              
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                {/* Normal range indicator background */}
                <div 
                  className="absolute h-full bg-slate-700/50"
                  style={{
                    left: `${((marker.minNormal - safeMin) / totalRange) * 100}%`,
                    width: `${((marker.maxNormal - marker.minNormal) / totalRange) * 100}%`
                  }}
                />
                {/* Value indicator */}
                <div 
                  className={`h-full rounded-full ${colorClass} relative z-10 transition-all duration-1000`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-slate-600">{marker.minNormal}</span>
                <span className="text-[9px] text-slate-600">{marker.maxNormal}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
