import React from 'react';

interface HistoryEvent {
  date: string;
  type: 'lab' | 'imaging' | 'diagnosis' | 'note';
  title: string;
  description: string;
  severity: 'normal' | 'warn' | 'alert';
}

interface TimelineProps {
  events: HistoryEvent[];
}

export const PatientHistoryTimeline: React.FC<TimelineProps> = ({ events }) => {
  return (
    <div className="flex flex-col h-full overflow-y-auto pr-2 custom-scrollbar">
      <h3 className="text-sm font-mono text-slate-400 uppercase tracking-wider mb-4 sticky top-0 bg-slate-950/90 py-2 backdrop-blur z-10">
        EHR Longitudinal History
      </h3>
      
      <div className="relative border-l border-slate-700/50 ml-3 space-y-6 pb-4">
        {events.map((evt, idx) => (
          <div key={idx} className="relative pl-6">
            {/* Timeline Dot */}
            <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full border-2 border-slate-950
              ${evt.severity === 'alert' ? 'bg-red-500' : 
                evt.severity === 'warn' ? 'bg-amber-400' : 'bg-teal-400'}`} 
            />
            
            {/* Event Card */}
            <div className={`p-3 rounded-lg border bg-slate-900/50 transition-colors hover:bg-slate-800/50
              ${evt.severity === 'alert' ? 'border-red-900/50' : 
                evt.severity === 'warn' ? 'border-amber-900/50' : 'border-slate-800'}`}>
              
              <div className="flex justify-between items-start mb-1">
                <span className="text-xs font-mono text-slate-500">{evt.date}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
                  ${evt.type === 'lab' ? 'bg-blue-900/40 text-blue-400' :
                    evt.type === 'imaging' ? 'bg-purple-900/40 text-purple-400' :
                    evt.type === 'diagnosis' ? 'bg-rose-900/40 text-rose-400' :
                    'bg-slate-800 text-slate-400'}`}>
                  {evt.type.toUpperCase()}
                </span>
              </div>
              
              <h4 className={`text-sm font-semibold mb-1 
                ${evt.severity === 'alert' ? 'text-red-300' : 
                  evt.severity === 'warn' ? 'text-amber-300' : 'text-slate-200'}`}>
                {evt.title}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {evt.description}
              </p>
            </div>
          </div>
        ))}
        
        {events.length === 0 && (
          <div className="text-xs text-slate-500 pl-6 italic">No historical records found.</div>
        )}
      </div>
    </div>
  );
};
