import React, { useMemo, useEffect, useRef } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

interface AnalyticsProps {
  history: number[];
  explainability: any;
  riskScore: number;
}

// Custom Live ECG Component
const LiveECGStream: React.FC<{ riskScore: number }> = ({ riskScore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    let offset = 0;
    const points: number[] = [];
    const maxPoints = 300;
    const risk = riskScore / 100; // Normalize to 0-1
    
    // Seed initial points
    for(let i=0; i<maxPoints; i++) points.push(0);

    const draw = () => {
      // Simulate ECG data based on riskScore (higher risk = more erratic)
      const isBeat = offset % 100 < 10;
      let val = 0;
      if (isBeat) {
        val = Math.sin(offset * 0.5) * 40 * (1 + risk);
      } else {
        val = (Math.random() - 0.5) * 5 * (1 + risk * 2);
      }
      points.push(val);
      if (points.length > maxPoints) points.shift();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw grid
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < canvas.width; i += 20) {
        ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
      }
      for (let i = 0; i < canvas.height; i += 20) {
        ctx.moveTo(0, i); ctx.lineTo(canvas.width, i);
      }
      ctx.stroke();

      // Draw trace
      ctx.beginPath();
      ctx.strokeStyle = risk > 0.7 ? '#ef4444' : '#2dd4bf'; // Red if high risk, else cyan
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      
      // Add glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = ctx.strokeStyle;

      for (let i = 0; i < points.length; i++) {
        const x = (i / maxPoints) * canvas.width;
        const y = canvas.height / 2 - points[i];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      // Reset shadow for next frame
      ctx.shadowBlur = 0;

      offset++;
      animationId = requestAnimationFrame(draw);
    };
    
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [riskScore]);

  return (
    <div className="relative w-full h-full bg-slate-950/50 rounded-lg overflow-hidden border border-slate-800">
      <div className="absolute top-2 left-2 flex items-center gap-2 z-10">
        <div className={`w-2 h-2 rounded-full animate-pulse ${riskScore > 70 ? 'bg-red-500' : 'bg-teal-500'}`} />
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Live Telemetry</span>
      </div>
      <canvas ref={canvasRef} width={600} height={200} className="w-full h-full object-cover opacity-80" />
    </div>
  );
};

export const AnalyticsDashboard: React.FC<AnalyticsProps> = ({ explainability, riskScore }) => {
  const shapData = useMemo(() => {
    if (!explainability || !explainability.nlp_shap) return [];
    const data = [];
    const nlpKeys = Object.keys(explainability.nlp_shap || {});
    const visKeys = Object.keys(explainability.vision_shap || {});
    const sigKeys = Object.keys(explainability.signal_shap || {});
    const maxKeys = Math.max(nlpKeys.length, visKeys.length, sigKeys.length);
    for (let i = 0; i < maxKeys; i++) {
      data.push({
        subject: `Feat ${i+1}`,
        nlp: nlpKeys[i] ? explainability.nlp_shap[nlpKeys[i]] * 100 : 0,
        vision: visKeys[i] ? explainability.vision_shap[visKeys[i]] * 100 : 0,
        signal: sigKeys[i] ? explainability.signal_shap[sigKeys[i]] * 100 : 0,
        fullMark: 100
      });
    }
    return data;
  }, [explainability]);

  const risk = riskScore / 100;
  const riskStatus = risk > 0.7 ? 'CRITICAL' : risk > 0.4 ? 'WARNING' : 'STABLE';
  const riskColor = risk > 0.7 ? 'text-red-400 border-red-500/50 bg-red-950/30' : risk > 0.4 ? 'text-amber-400 border-amber-500/50 bg-amber-950/30' : 'text-teal-400 border-teal-500/50 bg-teal-950/30';

  return (
    <div className="flex flex-col h-full gap-5 p-5 overflow-y-auto bg-slate-900/40">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <div>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-200 tracking-tight">System Analytics</h2>
          <p className="text-xs font-mono text-slate-500 mt-1">REAL-TIME MULTIMODAL FUSION</p>
        </div>
        <div className={`px-4 py-1.5 rounded-full border shadow-[0_0_15px_rgba(0,0,0,0.5)] flex items-center gap-2 ${riskColor} transition-all duration-500`}>
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${risk > 0.7 ? 'bg-red-400' : 'bg-teal-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${risk > 0.7 ? 'bg-red-500' : 'bg-teal-500'}`}></span>
          </span>
          <span className="text-xs font-bold tracking-widest">{riskStatus}</span>
        </div>
      </div>

      {/* Live ECG Canvas */}
      <div className="glass p-1 rounded-xl border border-slate-700/50 h-48 relative shadow-lg shadow-black/50 group">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-teal-900/10 pointer-events-none rounded-xl" />
        <LiveECGStream riskScore={riskScore} />
        <div className="absolute right-4 top-4 text-right pointer-events-none">
          <div className="text-4xl font-black text-white/90 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
            {(60 + risk * 80).toFixed(0)} <span className="text-sm font-normal text-slate-400">BPM</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* SHAP Feature Importance Radar */}
        <div className="glass p-5 rounded-xl border border-slate-700/50 h-80 flex flex-col relative overflow-hidden shadow-lg shadow-black/50">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-1 h-3 bg-purple-500 rounded-full"></span> 
            Feature Attribution
          </h3>
          {shapData.length > 0 ? (
            <div className="flex-1 -mx-4 -mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="65%" data={shapData}>
                  <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="NLP" dataKey="nlp" stroke="#a855f7" strokeWidth={2} fill="url(#colorNlp)" fillOpacity={1} />
                  <Radar name="Vision" dataKey="vision" stroke="#2dd4bf" strokeWidth={2} fill="url(#colorVis)" fillOpacity={1} />
                  <Radar name="Signal" dataKey="signal" stroke="#fbbf24" strokeWidth={2} fill="url(#colorSig)" fillOpacity={1} />
                  <defs>
                    <linearGradient id="colorNlp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorVis" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorSig" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(2, 6, 23, 0.9)', border: '1px solid rgba(51, 65, 85, 0.5)', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} 
                    itemStyle={{ fontSize: '12px', fontWeight: 600 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-teal-500 border-l-transparent animate-spin"></div>
              Awaiting Tensor Outputs...
            </div>
          )}
        </div>

        {/* Cross-Modal Matrix & Metrics */}
        <div className="flex flex-col gap-5 h-80">
          <div className="glass p-5 rounded-xl border border-slate-700/50 flex-1 relative overflow-hidden shadow-lg shadow-black/50">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1 h-3 bg-blue-500 rounded-full"></span> 
              Cross-Modal Concordance
            </h3>
            
            <div className="grid grid-cols-3 gap-2 h-full pb-6">
              {['NLP', 'Vision', 'Signal'].map((modality, i) => {
                // Simulate some live variance bound by risk score
                const variance = Math.random() * risk;
                const match = 1 - variance;
                return (
                  <div key={modality} className="flex flex-col justify-end items-center gap-2 group">
                    <div className="w-full bg-slate-900 rounded-t-sm relative flex items-end justify-center group-hover:bg-slate-800 transition-colors" style={{ height: '100%' }}>
                      <div 
                        className={`w-full rounded-t-sm transition-all duration-300 ${match > 0.8 ? 'bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : match > 0.5 ? 'bg-amber-500/80 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`}
                        style={{ height: `${match * 100}%` }}
                      ></div>
                      <div className="absolute bottom-2 text-[10px] font-black text-white mix-blend-overlay">{(match*100).toFixed(0)}%</div>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase">{modality}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glass p-4 rounded-xl border border-slate-700/50 relative overflow-hidden group hover:border-slate-500 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Sub-Model Entropy</div>
              <div className="text-2xl font-black text-white drop-shadow-md">{(1.24 + risk).toFixed(2)} <span className="text-xs font-normal text-slate-500">bits</span></div>
            </div>
            <div className="glass p-4 rounded-xl border border-slate-700/50 relative overflow-hidden group hover:border-slate-500 transition-colors">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">Queue Latency</div>
              <div className="text-2xl font-black text-white drop-shadow-md">{(42 + Math.random()*15).toFixed(0)} <span className="text-xs font-normal text-slate-500">ms</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
