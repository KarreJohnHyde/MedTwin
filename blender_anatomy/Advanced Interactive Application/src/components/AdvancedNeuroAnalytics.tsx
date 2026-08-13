import React, { useMemo, useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface NeuroProps {
  riskScore?: number;
}

export const AdvancedNeuroAnalytics: React.FC<NeuroProps> = ({ riskScore = 0 }) => {
  const [timeOffset, setTimeOffset] = useState(0);

  // Generate simulated Intracranial EEG time-frequency spectrogram (Heatmap)
  const data = useMemo(() => {
    const points = [];
    const channels = ['Fp1', 'Fp2', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4', 'Amyg', 'Hipp'];
    
    // Simulate a seizure or abnormal spike based on riskScore
    const riskFactor = riskScore / 100;
    const isSeizure = riskFactor > 0.7;
    const seizureFocus = 8; // Amygdala

    for (let c = 0; c < channels.length; c++) {
      for (let t = 0; t < 20; t++) {
        // Base noise power
        let power = Math.random() * 20 + 10;
        
        // Add periodic waves (alpha/beta)
        power += Math.sin((t + timeOffset) * 0.5) * 15;
        
        // Spike activity if risk is high
        if (isSeizure && Math.abs(c - seizureFocus) <= 1) {
          // Sharp spikes in the temporal/limbic area
          if (t % 3 === 0) {
            power += Math.random() * 80 + 50; 
          }
        } else if (riskFactor > 0.4) {
          // Mild abnormalities globally
          power += Math.random() * 30 * riskFactor;
        }

        points.push({
          time: t,
          channel: c,
          channelName: channels[c],
          power: Math.max(0, Math.min(100, power)) // Normalize 0-100
        });
      }
    }
    return points;
  }, [riskScore, timeOffset]);

  // Animate the spectrogram scrolling
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeOffset(o => o + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Map power to color (Heatmap: Dark blue -> Cyan -> Yellow -> Red)
  const getColor = (power: number) => {
    if (power < 20) return '#0f172a'; // slate-900
    if (power < 40) return '#1d4ed8'; // blue-700
    if (power < 60) return '#0d9488'; // teal-600
    if (power < 80) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
          <path d="M12 2a9 9 0 0 0-9 9c0 4.97 4 9 9 9s9-4.03 9-9a9 9 0 0 0-9-9Z"></path>
          <path d="M12 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
          <path d="M12 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
          <path d="M8.5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
          <path d="M15.5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"></path>
        </svg>
      </div>

      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Intracranial EEG Heatmap</h3>
          <p className="text-xs text-slate-400">Time-Frequency Power Spectrogram</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase font-mono tracking-wider">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-700 rounded"></div> <span className="text-slate-400">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded"></div> <span className="text-slate-400">High (Spike)</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} vertical={false} />
            <XAxis 
              type="number" 
              dataKey="time" 
              domain={[0, 19]} 
              tick={false} 
              axisLine={false} 
            />
            <YAxis 
              type="number" 
              dataKey="channel" 
              domain={[0, 9]} 
              tickFormatter={(val) => ['Fp1', 'Fp2', 'C3', 'C4', 'O1', 'O2', 'T3', 'T4', 'Amyg', 'Hipp'][val] || ''}
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <ZAxis type="number" dataKey="power" range={[100, 400]} />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
              labelStyle={{ display: 'none' }}
              formatter={(value, name, props) => {
                if (name === 'power') {
                  const numValue = typeof value === 'number' ? value : Number(value) || 0;
                  return [`${numValue.toFixed(1)} dB`, 'Power'];
                }
                if (name === 'channel') return [props.payload.channelName, 'Channel'];
                return [];
              }}
            />
            <Scatter 
              data={data} 
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const cxNum = typeof cx === 'number' ? cx : Number(cx) || 0;
                const cyNum = typeof cy === 'number' ? cy : Number(cy) || 0;
                return (
                  <rect 
                    x={cxNum - 15} 
                    y={cyNum - 10} 
                    width={30} 
                    height={20} 
                    fill={getColor(payload.power)}
                    rx={2}
                    opacity={0.9}
                  />
                );
              }}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
