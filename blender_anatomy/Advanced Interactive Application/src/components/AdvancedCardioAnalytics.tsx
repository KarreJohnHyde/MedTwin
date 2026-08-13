import React, { useMemo, useState, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PVLoopProps {
  riskScore?: number;
}

export const AdvancedCardioAnalytics: React.FC<PVLoopProps> = ({ riskScore = 0 }) => {
  const [cycle, setCycle] = useState(0);

  // Generate PV Loop Data (Volume in mL on X-axis, Pressure in mmHg on Y-axis)
  const data = useMemo(() => {
    const points = [];
    const pointsPerCycle = 100;
    
    // Base PV loop parameters (simulate healthy)
    let EDV = 120; // End-Diastolic Volume
    let ESV = 50;  // End-Systolic Volume
    let EDP = 10;  // End-Diastolic Pressure
    let ESP = 120; // End-Systolic Pressure
    
    // Modify based on risk score (e.g. higher risk = heart failure, higher volumes, lower pressure)
    const riskFactor = riskScore / 100;
    EDV += riskFactor * 40; // Dilated
    ESV += riskFactor * 60; // Weak pump
    ESP -= riskFactor * 30; // Weak pressure
    EDP += riskFactor * 15; // High filling pressure

    for (let i = 0; i <= pointsPerCycle; i++) {
      const t = (i / pointsPerCycle) * 2 * Math.PI;
      
      // Approximation of a PV loop shape
      // Diastolic filling (bottom curve)
      // Isovolumetric contraction (right vertical)
      // Systolic ejection (top curve)
      // Isovolumetric relaxation (left vertical)
      
      // We will use a parametric ellipse transformed to look like a PV loop
      const a = (EDV - ESV) / 2;
      const b = (ESP - EDP) / 2;
      
      const x = ESV + a + a * Math.cos(t + Math.PI);
      
      let y = EDP + b + b * Math.sin(t + Math.PI);
      
      // Flatten the bottom (diastolic filling)
      if (Math.sin(t + Math.PI) < 0) {
        y = EDP + (b * 0.2) * Math.sin(t + Math.PI) + ((x - ESV) / (EDV - ESV)) * (EDP * 0.5);
      }
      
      // Add slight jitter for realism based on animation cycle
      const jitterX = Math.sin(cycle + i) * 1.5;
      const jitterY = Math.cos(cycle - i) * 1.5;

      points.push({
        volume: Math.max(0, x + jitterX),
        pressure: Math.max(0, y + jitterY)
      });
    }
    
    // Close the loop
    points.push(points[0]);
    
    return points;
  }, [riskScore, cycle]);

  // Animate the loop
  useEffect(() => {
    const interval = setInterval(() => {
      setCycle(c => c + 0.1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
          <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path>
        </svg>
      </div>

      <div className="flex justify-between items-start mb-4 z-10">
        <div>
          <h3 className="text-sm font-bold text-slate-200">Pressure-Volume (PV) Loop</h3>
          <p className="text-xs text-slate-400">Left Ventricular Hemodynamics</p>
        </div>
        <div className="flex gap-2 text-[10px] uppercase font-mono tracking-wider">
          <div className="px-2 py-1 rounded bg-red-950/50 border border-red-900/50 text-red-400">
            ESP: {Math.round(Math.max(...data.map(d => d.pressure)))} mmHg
          </div>
          <div className="px-2 py-1 rounded bg-blue-950/50 border border-blue-900/50 text-blue-400">
            EDV: {Math.round(Math.max(...data.map(d => d.volume)))} mL
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis 
              type="number" 
              dataKey="volume" 
              name="Volume" 
              unit=" mL" 
              domain={['auto', 'auto']}
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Left Ventricular Volume (mL)', position: 'insideBottom', offset: -15, fill: '#64748b', fontSize: 11 }}
            />
            <YAxis 
              type="number" 
              dataKey="pressure" 
              name="Pressure" 
              unit=" mmHg" 
              domain={['auto', 'auto']}
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              label={{ value: 'Pressure (mmHg)', angle: -90, position: 'insideLeft', offset: -5, fill: '#64748b', fontSize: 11 }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }}
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: '#334155', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
              labelStyle={{ display: 'none' }}
            />
            <Scatter 
              name="PV Loop" 
              data={data} 
              fill="#ef4444" 
              line={{ stroke: '#ef4444', strokeWidth: 2 }} 
              shape="circle" 
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
