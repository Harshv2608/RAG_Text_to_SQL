import React, { useState, useEffect } from 'react';
import { submitQuery, checkQueryStatus } from '../services/api';
import { Loader2, Play, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../components/Layout';

export const LiveRunner = () => {
  const [question, setQuestion] = useState('How many active users are there?');
  const [tier, setTier] = useState<1|2|3>(1);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    let interval: any;
    if (jobId && loading) {
      interval = setInterval(async () => {
        try {
          const status = await checkQueryStatus(jobId);
          if (status.state === 'completed') {
            setResult(status.result);
            setLoading(false);
            clearInterval(interval);
          } else if (status.state === 'failed') {
            setResult({ success: false, error: status.error, logs: [] });
            setLoading(false);
            clearInterval(interval);
          }
        } catch (e) {
          // ignore transient poll errors
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [jobId, loading]);

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await submitQuery({ question, tier, rag_enabled: ragEnabled });
      setJobId(res.jobId);
    } catch (e) {
      setLoading(false);
      alert('Failed to submit query');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="glass-panel p-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Live Query Runner</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <label className="block text-sm font-medium text-slate-400 mb-2">Natural Language Question</label>
            <textarea
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
              rows={3}
              value={question}
              onChange={e => setQuestion(e.target.value)}
            />
          </div>
          <div className="md:col-span-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Complexity Tier</label>
              <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                {[1, 2, 3].map(t => (
                  <button
                    key={t}
                    onClick={() => setTier(t as 1|2|3)}
                    className={cn(
                      "flex-1 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                      tier === t ? "bg-indigo-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    Tier {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">RAG Context</label>
              <button
                onClick={() => setRagEnabled(!ragEnabled)}
                className={cn(
                  "w-full py-2 px-4 rounded-lg flex items-center justify-between transition-all duration-200 border",
                  ragEnabled ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600"
                )}
              >
                <span>{ragEnabled ? 'ON' : 'OFF'}</span>
                <div className={cn("w-3 h-3 rounded-full transition-all duration-300", ragEnabled ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" : "bg-slate-600")} />
              </button>
            </div>
            <button
              onClick={handleRun}
              disabled={loading || !question}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {loading ? 'Executing...' : 'Run Query'}
            </button>
          </div>
        </div>
      </div>

      {result && result.logs && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-slate-300">The Retry Ladder</h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
            {result.logs.map((log: any, idx: number) => {
              const isSuccess = log.status === 'success';
              const isSafety = log.status === 'rejected_safety';
              const Icon = isSuccess ? CheckCircle : isSafety ? AlertTriangle : XCircle;
              const color = isSuccess ? 'text-green-400' : isSafety ? 'text-yellow-400' : 'text-red-400';
              const bg = isSuccess ? 'bg-green-500/10 border-green-500/20' : isSafety ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20';

              return (
                <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-900 bg-slate-800 text-slate-400 group-hover:text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                    <Icon className={cn("w-5 h-5", color)} />
                  </div>
                  <div className={cn("w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border backdrop-blur-sm", bg)}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-sm text-white">Attempt {log.attempt_number}</span>
                      <span className="text-xs text-slate-400 font-mono">{log.tokens_used} tokens</span>
                    </div>
                    <div className="bg-slate-950/50 p-2 rounded-md border border-slate-800/50 mb-2 overflow-x-auto">
                      <code className="text-xs font-mono text-slate-300 whitespace-pre">{log.generated_sql}</code>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-slate-300 bg-slate-900/50 p-2 rounded border border-slate-700/50">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="glass-panel p-6 mt-8 border-t-2 border-indigo-500/50">
            <h3 className="text-lg font-medium text-white mb-4">Execution Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Total Attempts</div>
                <div className="text-2xl font-bold text-white">{result.logs.length}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Retry Count</div>
                <div className="text-2xl font-bold text-indigo-400">{Math.max(0, result.logs.length - 1)}</div>
                <div className="text-xs text-slate-500 mt-1">max(0, attempts - 1)</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Total Tokens</div>
                <div className="text-2xl font-bold text-emerald-400">{result.total_tokens}</div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
                <div className="text-sm text-slate-400 mb-1">Result</div>
                <div className="text-xl font-bold text-white">{result.success ? 'Success' : 'Failed'}</div>
              </div>
            </div>
            
            {result.error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <h4 className="font-bold mb-1">Infrastructure Error</h4>
                <p className="text-sm font-mono">{result.error}</p>
              </div>
            )}
            
            {result.data && result.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 rounded-t-lg">
                    <tr>
                      {Object.keys(result.data[0]).map(k => <th key={k} className="px-4 py-3">{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((row: any, i: number) => (
                      <tr key={i} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-800/30">
                        {Object.values(row).map((v: any, j: number) => <td key={j} className="px-4 py-2">{String(v)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
