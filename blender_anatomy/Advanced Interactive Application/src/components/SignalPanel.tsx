import React from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { SignalTrace } from '../lib/signalFixtures';

export function SignalPanel({ trace }: { trace: SignalTrace }) {
  if (!trace) return null;
  
  return (
    <div className="glass rounded-xl p-3 border border-slate-700/50 mb-3 relative overflow-hidden group">
      {/* Explicit Watermark for Synthetic Data */}
      {trace.synthetic && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.04] z-0 overflow-hidden">
          <span className="text-4xl font-black text-slate-100 -rotate-12 select-none tracking-widest uppercase whitespace-nowrap">
            Synthetic Data
          </span>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-1 z-10 relative">
        <div>
          <h4 className="text-xs font-semibold text-slate-200">{trace.name}</h4>
          <div className="text-[10px] font-mono text-slate-500">{trace.id}</div>
        </div>
        {trace.synthetic && (
          <span className="text-[9px] font-mono font-bold bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 uppercase tracking-wider">
            Synthetic: True
          </span>
        )}
      </div>

      <div className="h-28 w-full z-10 relative mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trace.data}>
            <XAxis dataKey="time" hide />
            <YAxis 
              domain={trace.yAxisDomain} 
              hide 
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px', color: '#f8fafc', borderRadius: '6px' }}
              itemStyle={{ color: trace.color, fontWeight: 600 }}
              labelStyle={{ display: 'none' }}
              formatter={(val: any) => [`${Number(val).toFixed(2)} ${trace.unit}`, trace.name]}
            />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={trace.color} 
              strokeWidth={1.5} 
              dot={false} 
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex justify-between mt-1 z-10 relative">
        <span className="text-[9px] text-slate-600 font-mono">{trace.yAxisDomain[0]} {trace.unit}</span>
        <span className="text-[9px] text-slate-600 font-mono">{trace.yAxisDomain[1]} {trace.unit}</span>
      </div>
    </div>
  );
}
