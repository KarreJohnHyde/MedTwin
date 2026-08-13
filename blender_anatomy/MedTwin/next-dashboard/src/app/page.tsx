"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import XRayOrganViewer, { ORGAN_REGISTRY } from '@/components/XRayOrganViewer';

export default function Dashboard() {
  const [organ, setOrgan] = useState<keyof typeof ORGAN_REGISTRY>('lungs');
  const [tracking, setTracking] = useState<boolean>(true);
  const [annotationMode, setAnnotationMode] = useState<boolean>(false);

  const [forecastDay, setForecastDay] = useState<number>(0);
  const [forecastSpread, setForecastSpread] = useState<number>(1.0);
  const [forecastSeverity, setForecastSeverity] = useState<number>(0.0);

  const [clinicalReport, setClinicalReport] = useState<string>('');
  const [workspaceResult, setWorkspaceResult] = useState<string>('API-ready. Enter data and run inference.');

  const [isInferring, setIsInferring] = useState(false);
  const [isConflict, setIsConflict] = useState(false);
  const [fusionScore, setFusionScore] = useState(0);
  const [riskScore, setRiskScore] = useState(0);
  const [visPred, setVisPred] = useState<string>('No finding');
  const [forecastData, setForecastData] = useState<any[]>([]);

  // Base64 of a dummy chest X-Ray (1x1 transparent PNG for demo purposes)
  const dummyImageB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";

  const runInference = async (useMissingImage = false) => {
    setWorkspaceResult('Running fusion pipeline...');
    setIsInferring(true);

    // Gateway runs on port 4000 per the repo docs
    const endpoint = 'http://localhost:4000/api/fusion/infer';

    try {
      const payload = {
        patient_id: "PT-001",
        inputs: {
          report_text: clinicalReport,
          labs: { wbc: 12.5 },
          ecg_signal: null,
          image: useMissingImage ? null : dummyImageB64,
          image_modality: organ === 'lungs' ? 'xray' : 'mri'
        }
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const result = await res.json();

      setFusionScore(Math.round((result.fusion_confidence ?? 0) * 100));
      setRiskScore(result.risk_index ?? 0);
      setIsConflict(result.concordance === "DISCORDANT");

      if (result.findings && result.findings.length > 0) {
        const findingStr = result.findings.map((f: any) => f.finding).join(', ');
        setVisPred(findingStr);
        setWorkspaceResult(`Inference complete. Findings: ${findingStr}`);
      } else {
        setVisPred('No finding');
        setWorkspaceResult(`Inference complete. Status: ${result.concordance}`);
      }

      if (result.forecast) {
        setForecastData(result.forecast);
        updateForecastParams(forecastDay, result.forecast);
      }

    } catch (e: any) {
      setWorkspaceResult(`Inference failed: ${e.message}`);
    } finally {
      setIsInferring(false);
    }
  };

  const updateForecastParams = (day: number, data: any[]) => {
    if (!data || data.length === 0) return;

    // Find closest forecast point
    let closest = data[0];
    for (const point of data) {
      if (Math.abs(point.day - day) < Math.abs(closest.day - day)) {
        closest = point;
      }
    }

    // Interpolate severity spread
    let severityVal = 0.0;
    if (closest.severity_band === 'low') severityVal = 0.3;
    if (closest.severity_band === 'moderate') severityVal = 0.6;
    if (closest.severity_band === 'high') severityVal = 0.8;
    if (closest.severity_band === 'critical') severityVal = 1.0;

    // Scale spread based on day progression (further out = wider spread)
    const baseSpread = 1.0 + (day / 14) * 0.5;

    setForecastSeverity(severityVal);
    setForecastSpread(baseSpread);
  };

  useEffect(() => {
    updateForecastParams(forecastDay, forecastData);
  }, [forecastDay, forecastData]);

  return (
    <main className="relative w-full min-h-screen text-slate-200 overflow-hidden font-sans">
      <XRayOrganViewer
        organ={organ}
        forecastDay={forecastDay}
        forecastSpread={forecastSpread}
        forecastSeverity={forecastSeverity}
        tracking={tracking}
        visionFinding={visPred}
        annotationMode={annotationMode}
        heartRate={72}
        riskIndex={riskScore}
        fusionConfidence={fusionScore / 100}
      />

      <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-between pointer-events-none z-10">

        {/* Top Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between gap-4 items-start"
        >
          {/* Top Left: Patient Panel */}
          <section className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 shadow-2xl pointer-events-auto w-72">
            <div className="flex justify-between items-center mb-1">
              <h2 className="text-[0.65rem] uppercase tracking-widest text-teal-400 font-semibold">MedTwin / Research</h2>
              <div className="flex items-center gap-2 border border-teal-500/40 bg-teal-900/30 px-2 py-0.5 rounded-full">
                <div className={`w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse`} />
                <span className="text-[0.6rem] uppercase tracking-widest text-teal-300">Live</span>
              </div>
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-1">Anatomy Intelligence</h1>
            <p className="text-xs text-slate-400 mb-5">PT-001 - Digital twin session</p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <h3 className="text-[0.6rem] text-slate-400 uppercase tracking-wider mb-1">Heart Rate</h3>
                <div className="text-2xl font-light text-teal-300">72 <span className="text-xs text-slate-500">bpm</span></div>
              </div>
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                <h3 className="text-[0.6rem] text-slate-400 uppercase tracking-wider mb-1">Risk Index</h3>
                <div className="text-2xl font-light text-amber-400">{riskScore}<span className="text-xs text-slate-500">%</span></div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[0.6rem] text-slate-400 uppercase tracking-wider">Anatomical Model</label>
              <select
                value={organ}
                onChange={(e) => setOrgan(e.target.value as keyof typeof ORGAN_REGISTRY)}
                className="bg-slate-800 border border-slate-700 rounded-md p-2 text-sm text-slate-300 outline-none focus:ring-1 focus:ring-teal-500 transition-shadow"
              >
                <option value="lungs">Lungs - pulmonary</option>
                <option value="heart">Heart - cardiovascular</option>
                <option value="brain">Brain - neurological</option>
              </select>
            </div>
          </section>

          {/* Top Right: Fusion Panel */}
          <section className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 shadow-2xl pointer-events-auto w-80">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold tracking-tight">Multimodal fusion</h2>
              <span className={`text-[0.6rem] uppercase tracking-widest px-2 py-0.5 rounded-full border ${isConflict ? 'border-amber-500/40 bg-amber-900/30 text-amber-400' : 'border-teal-500/40 bg-teal-900/30 text-teal-300'}`}>
                {isConflict ? 'Discordant' : 'Concordant'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-700/50 pb-2">
                <span className="text-xs text-slate-400 w-24">Vision / model</span>
                <span className="text-xs font-medium text-sky-400 text-right">{visPred}</span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-xs text-slate-400">Fusion confidence</span>
                <span className={`text-sm font-bold ${fusionScore < 50 ? 'text-amber-400' : 'text-teal-400'}`}>{fusionScore}%</span>
              </div>
            </div>
          </section>
        </motion.header>

        {/* Bottom Section */}
        <div className="flex justify-between items-end gap-4 pointer-events-auto">
          {/* Bottom Left: AI Workspace */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 shadow-2xl w-80"
          >
            <h2 className="font-semibold mb-2">AI workspace</h2>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                onClick={() => runInference(false)}
                disabled={isInferring}
                className="rounded-lg bg-teal-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400 transition-colors disabled:opacity-50"
              >
                {isInferring ? 'Running...' : 'Run Fusion'}
              </button>
              <button
                onClick={() => runInference(true)}
                disabled={isInferring}
                className="rounded-lg border border-amber-600 bg-amber-900/30 px-3 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-800/50 transition-colors disabled:opacity-50"
                title="Test missing modality penalty"
              >
                Missing Image Test
              </button>
            </div>

            <div className="mt-2 text-right">
              <button onClick={() => setTracking(!tracking)} className={`rounded-lg border px-3 py-1 text-xs transition-colors ${tracking ? 'border-teal-500 bg-teal-900/30 text-teal-300' : 'border-slate-600 bg-slate-800'}`}>
                Tracking: {tracking ? 'on' : 'off'}
              </button>
            </div>

            <label className="text-[10px] font-semibold text-slate-400 uppercase mt-4 mb-1 block">Clinical report (text modality)</label>
            <textarea
              value={clinicalReport}
              onChange={(e) => setClinicalReport(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs outline-none focus:border-sky-500"
              placeholder="Enter findings..."
            ></textarea>

            <p className="mt-3 text-[11px] leading-4 text-slate-400 min-h-[2rem]">
              {workspaceResult}
            </p>
          </motion.section>

          {/* Bottom Right: Disease Progression */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 w-[28rem] border border-slate-700/50 shadow-xl"
          >
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-semibold text-sm">Disease progression forecast</h2>
                <p className="text-[10px] text-slate-400 mt-1">Current morphology · baseline risk</p>
              </div>
              <span className="font-mono text-teal-300 text-sm">Day {forecastDay}</span>
            </div>
            <input
              type="range"
              min="0" max="14"
              value={forecastDay}
              onChange={(e) => setForecastDay(Number(e.target.value))}
              className="mt-4 w-full accent-teal-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Current</span><span>+7 days</span><span>+14 days</span>
            </div>
          </motion.section>
        </div>

      </div>
    </main>
  );
}
