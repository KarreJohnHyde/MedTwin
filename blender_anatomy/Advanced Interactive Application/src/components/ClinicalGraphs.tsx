import React from 'react';
import { OrganId } from '../lib/twins';
import { ViewMode, ORGAN_CLINICAL_DATA } from '../lib/organData';
import { Activity, Radio, Target, Minimize2, Waves, BrainCircuit, HeartPulse, Dna } from 'lucide-react';

interface ClinicalGraphsProps {
  organId: OrganId;
  viewMode: ViewMode;
}

export const ClinicalGraphs: React.FC<ClinicalGraphsProps> = ({ organId, viewMode }) => {
  const organData = ORGAN_CLINICAL_DATA[organId];
  if (!organData) return null;

  // Filter graphs by the current view mode
  const activeGraphs = organData.graphs.filter(g => g.preferredView === viewMode);

  // If no specific graphs for this view mode, fallback to any two
  const graphsToDisplay = activeGraphs.length >= 2 ? activeGraphs.slice(0, 2) : organData.graphs.slice(0, 2);

  const renderAbstractGraph = (type: string) => {
    const stableCellTone = (row: number, column: number) => {
      const value = (row * 17 + column * 11 + type.length * 7) % 9;
      if (value > 6) return "fill-cyan-500/65";
      if (value > 3) return "fill-fuchsia-500/55";
      return "fill-slate-800";
    };

    switch (type) {
      case 'pv-loop':
      case 'kinematic-line':
      case 'flow-curve':
      case 'variance-plot':
        return (
          <svg className="w-full h-24 stroke-cyan-400 fill-none" viewBox="0 0 100 50">
            <path d="M5,40 C20,10 40,50 60,20 S80,45 95,15" strokeWidth="2" />
            <path d="M5,40 C25,25 35,45 55,25 S75,35 95,15" strokeWidth="1" className="stroke-fuchsia-500/50" />
            <circle cx="60" cy="20" r="3" className="fill-cyan-400" />
            <circle cx="95" cy="15" r="3" className="fill-cyan-400" />
          </svg>
        );
      case 'bullseye':
      case 'polar':
      case 'morphometry':
      case 'density-map':
        return (
          <svg className="w-full h-24 stroke-fuchsia-500 fill-none" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" strokeWidth="2" className="stroke-fuchsia-500/30" />
            <circle cx="50" cy="50" r="30" strokeWidth="2" className="stroke-fuchsia-500/50" />
            <circle cx="50" cy="50" r="20" strokeWidth="2" className="stroke-cyan-400/80" />
            <path d="M50 10 L50 90 M10 50 L90 50 M22 22 L78 78 M22 78 L78 22" className="stroke-cyan-500/20" strokeWidth="1" />
            <circle cx="65" cy="35" r="5" className="fill-fuchsia-500" />
          </svg>
        );
      case 'connectivity-matrix':
      case 'heatgrid':
      case 'microbiome-network':
        return (
          <svg className="w-full h-24" viewBox="0 0 100 50">
            {Array.from({ length: 5 }).map((_, i) =>
              Array.from({ length: 10 }).map((_, j) => (
                <rect
                  key={`${i}-${j}`}
                  x={j * 10}
                  y={i * 10}
                  width="8"
                  height="8"
                  className={stableCellTone(i, j)}
                  rx="2"
                />
              ))
            )}
          </svg>
        );
      case 'tractography':
      case 'resistance-tree':
      case 'biliary-tree':
      case 'network-diagram':
        return (
          <svg className="w-full h-24 stroke-cyan-400 fill-none" viewBox="0 0 100 50">
            <path d="M10,25 Q30,5 50,25 T90,25" strokeWidth="2" className="stroke-cyan-400/80" />
            <path d="M10,25 Q30,45 50,25 T90,25" strokeWidth="2" className="stroke-fuchsia-500/80" />
            <path d="M30,25 Q50,15 70,25" strokeWidth="1.5" className="stroke-cyan-300/60" />
            <path d="M30,25 Q50,35 70,25" strokeWidth="1.5" className="stroke-fuchsia-300/60" />
            <circle cx="10" cy="25" r="2" className="fill-white" />
            <circle cx="50" cy="25" r="2" className="fill-white" />
            <circle cx="90" cy="25" r="2" className="fill-white" />
          </svg>
        );
      default:
        return (
          <div className="w-full h-24 flex items-center justify-center opacity-50">
            <Activity className="w-8 h-8 text-cyan-400" />
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {graphsToDisplay.map((graph) => (
        <div key={graph.id} className="bg-slate-900/50 rounded-xl p-4 border border-slate-800/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-200">{graph.title}</h4>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full">
              {graph.type}
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">{graph.description}</p>
          <div className="w-full bg-slate-950/50 rounded-lg p-2 overflow-hidden flex items-center justify-center">
            {renderAbstractGraph(graph.type)}
          </div>
        </div>
      ))}
    </div>
  );
};
