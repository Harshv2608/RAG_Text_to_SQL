import React, { useEffect, useState } from 'react';
import { getBenchmarkSummary, submitEvalBatch, getConditions } from '../services/api';
import { Play, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../components/Layout';

export const EvalDashboard = () => {
  const [data, setData] = useState<any>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [showConditions, setShowConditions] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const summ = await getBenchmarkSummary();
        setData(summ);
        if (showConditions) {
          const cond = await getConditions();
          setConditions(cond.conditions);
        }
      } catch (e) {
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [showConditions]);

  const handleRunBatch = async () => {
    setRunning(true);
    try {
      const res = await submitEvalBatch([]);
      alert(res.message);
    } catch (e) {
      alert("Failed to submit batch");
    }
    setTimeout(() => setRunning(false), 2000);
  };

  if (!data) return <div className="p-6 text-white">Loading...</div>;

  const { manifest, progress, summary } = data;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-center glass-panel p-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Research Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Goal: Does RAG improve Text-to-SQL performance across query difficulty?</p>
          {manifest && (
            <div className="flex gap-4 mt-2 text-xs text-slate-500">
              <span>Model: <span className="text-slate-300">{manifest.model_config}</span></span>
              <span>Dataset SHA: <span className="text-slate-300 font-mono">{manifest.dataset_sha256?.slice(0,8)}</span></span>
            </div>
          )}
        </div>
        <button
          onClick={handleRunBatch}
          disabled={running}
          className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          {running ? 'Dispatching...' : 'Dispatch Batch'}
        </button>
      </div>

      {(progress?.completed + progress?.model_failed) === 60 ? (
        <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 p-4 rounded-lg flex items-center gap-2">
          <span className="font-bold">✅ FINAL RESULTS (60/60)</span>
          <span>The factorial experiment has completely finished.</span>
        </div>
      ) : (
        <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 p-4 rounded-lg flex items-center gap-2">
          <span className="font-bold">⚠️ PRELIMINARY RESULTS</span>
          <span>The experiment is still in progress.</span>
        </div>
      )}

      <div className="glass-panel p-6">
        <h3 className="text-lg font-medium text-white mb-4">Experiment Progress ({progress?.completed + progress?.model_failed} / 60)</h3>
        
        <div className="w-full bg-slate-900 rounded-full h-4 mb-4 overflow-hidden flex">
          <div className="bg-emerald-500 h-4 transition-all duration-500" style={{ width: `${(progress?.completed / 60) * 100}%` }}></div>
          <div className="bg-red-500 h-4 transition-all duration-500" style={{ width: `${(progress?.model_failed / 60) * 100}%` }}></div>
          <div className="bg-yellow-500 h-4 transition-all duration-500" style={{ width: `${(progress?.quota_interrupted / 60) * 100}%` }}></div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Completed (Success)</div>
            <div className="text-2xl font-bold text-emerald-400">{progress?.completed}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Model Failed</div>
            <div className="text-2xl font-bold text-red-400">{progress?.model_failed}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Quota Interrupted</div>
            <div className="text-2xl font-bold text-yellow-400">{progress?.quota_interrupted}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Infra Failed</div>
            <div className="text-2xl font-bold text-orange-400">{progress?.infrastructure_failed}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">API Requests</div>
            <div className="text-2xl font-bold text-indigo-400">{progress?.api_requests}</div>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 overflow-x-auto">
        <h3 className="text-lg font-medium text-white mb-6">Primary Outcome: RAG Effect on Success Rate</h3>
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Tier</th>
              <th className="px-4 py-3">RAG State</th>
              <th className="px-4 py-3">N (Completed)</th>
              <th className="px-4 py-3 text-emerald-400">Success Rate</th>
              <th className="px-4 py-3">Mean Tokens</th>
              <th className="px-4 py-3">Mean Retries</th>
              <th className="px-4 py-3">Mean Latency (ms)</th>
              <th className="px-4 py-3 text-indigo-400">API Requests</th>
              <th className="px-4 py-3 rounded-tr-lg">RAG Delta</th>
            </tr>
          </thead>
          <tbody>
            {summary?.map((row: any, i: number) => {
              const off = row['RAG OFF'];
              const on = row['RAG ON'];
              const delta = on.successRate - off.successRate;
              const deltaColor = delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-slate-400';

              return (
                <React.Fragment key={i}>
                  <tr className="border-t border-slate-700/50">
                    <td className="px-4 py-3 font-semibold text-white" rowSpan={2}>{row.tier}</td>
                    <td className="px-4 py-3">OFF</td>
                    <td className="px-4 py-3">{off.count}/10</td>
                    <td className="px-4 py-3 font-mono">{(off.successRate * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 font-mono">{Math.round(off.meanTokens)}</td>
                    <td className="px-4 py-3 font-mono">{off.meanRetries.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono">{Math.round(off.meanLatency)}</td>
                    <td className="px-4 py-3 font-mono text-indigo-400">{off.apiRequests}</td>
                    <td className="px-4 py-3 border-l border-slate-700/50" rowSpan={2}>
                      <span className={cn("font-bold text-lg", deltaColor)}>
                        {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-700/50 bg-indigo-500/5">
                    <td className="px-4 py-3 text-indigo-300 font-medium">ON</td>
                    <td className="px-4 py-3">{on.count}/10</td>
                    <td className="px-4 py-3 font-mono text-indigo-300">{(on.successRate * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 font-mono">{Math.round(on.meanTokens)}</td>
                    <td className="px-4 py-3 font-mono">{on.meanRetries.toFixed(1)}</td>
                    <td className="px-4 py-3 font-mono">{Math.round(on.meanLatency)}</td>
                    <td className="px-4 py-3 font-mono text-indigo-400">{on.apiRequests}</td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="glass-panel overflow-hidden">
        <button 
          onClick={() => setShowConditions(!showConditions)}
          className="w-full p-6 flex justify-between items-center hover:bg-slate-800/50 transition-colors"
        >
          <h3 className="text-lg font-medium text-white">Condition-Level Inspection ({conditions.length})</h3>
          {showConditions ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>
        
        {showConditions && (
          <div className="p-6 pt-0 overflow-x-auto border-t border-slate-800">
            <table className="w-full text-sm text-left text-slate-300">
              <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3">Question ID</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">RAG</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Success</th>
                  <th className="px-4 py-3">Tokens</th>
                  <th className="px-4 py-3">API Req</th>
                  <th className="px-4 py-3">Latency</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {conditions.sort((a,b) => new Date(b.execution_timestamp || 0).getTime() - new Date(a.execution_timestamp || 0).getTime()).map((c, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-xs">{c.question_id}</td>
                    <td className="px-4 py-3">{c.tier}</td>
                    <td className="px-4 py-3">{c.rag_enabled ? 'ON' : 'OFF'}</td>
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-1 rounded text-xs font-medium", 
                        c.state === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                        c.state === 'pending' ? 'bg-slate-500/10 text-slate-400' :
                        c.state === 'model_failed' ? 'bg-red-500/10 text-red-400' :
                        'bg-yellow-500/10 text-yellow-400'
                      )}>
                        {c.state}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.success === 1 ? 'Yes' : c.success === 0 ? 'No' : '-'}</td>
                    <td className="px-4 py-3 font-mono">{c.total_tokens || '-'}</td>
                    <td className="px-4 py-3 font-mono">{c.api_requests_consumed || '-'}</td>
                    <td className="px-4 py-3 font-mono">{c.latency_ms ? Math.round(c.latency_ms) + 'ms' : '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs">{c.execution_timestamp ? new Date(c.execution_timestamp).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

