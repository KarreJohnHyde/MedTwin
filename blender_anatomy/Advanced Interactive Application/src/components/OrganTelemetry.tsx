import React from 'react';
import { OrganId } from '../lib/twins';
import { ORGAN_CLINICAL_DATA } from '../lib/organData';
import { Activity, BrainCircuit, ClipboardList } from 'lucide-react';

interface OrganTelemetryProps {
  organId: OrganId;
}

export const OrganTelemetry: React.FC<OrganTelemetryProps> = ({ organId }) => {
  const organData = ORGAN_CLINICAL_DATA[organId];
  if (!organData) return null;

  return (
    <div className="flex flex-col gap-4">
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

      <section>
        <div className="mb-2 flex items-center gap-2 text-violet-300">
          <BrainCircuit className="h-4 w-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">AI Model Stack</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {organData.aiModels.map((model, index) => {
            const importance = [88, 74, 62, 51].map((value) =>
              Math.max(18, value - index * 4),
            );
            const features = [
              organData.biomarkers[index]?.name ?? 'Signal texture',
              organData.biomarkers[(index + 2) % organData.biomarkers.length]?.name ?? 'Morphology',
              organData.graphs[index]?.title.split(' ').slice(0, 2).join(' ') ?? 'Clinical graph',
            ];
            return (
              <article
                key={model.id}
                className="rounded-lg border border-violet-300/10 bg-slate-900/35 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-200">{model.name}</div>
                    <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em] text-violet-300/70">
                      {model.type}
                    </div>
                  </div>
                  <span className="shrink-0 rounded bg-violet-300/10 px-1.5 py-0.5 font-mono text-[9px] text-violet-200">
                    {model.accuracy}
                  </span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{model.description}</p>
                <div className="mt-3 space-y-1.5">
                  {features.map((feature, featureIndex) => (
                    <div key={feature}>
                      <div className="mb-1 flex justify-between gap-2 text-[8px]">
                        <span className="truncate text-slate-500">{feature}</span>
                        <span className="font-mono text-slate-400">{importance[featureIndex]}%</span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                          style={{ width: `${importance[featureIndex]}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 text-amber-300">
          <ClipboardList className="h-4 w-4" />
          <h3 className="text-sm font-semibold uppercase tracking-wider">Findings + ICD</h3>
        </div>
        <div className="space-y-2">
          {organData.findings.map((finding) => (
            <div
              key={finding.code}
              className="rounded-lg border border-amber-300/10 bg-amber-300/[0.035] p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] text-amber-200">{finding.code}</span>
                <span className="rounded bg-slate-950/45 px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-slate-500">
                  {finding.viewMode}
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{finding.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
