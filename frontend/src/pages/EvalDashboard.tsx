import React, { useEffect, useState } from 'react';
import { getMetrics, submitEvalBatch, getBenchmarkSummary } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play } from 'lucide-react';



export const EvalDashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [summary, setSummary] = useState<any>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await getMetrics();
        setMetrics(data.metrics.queue);
        const summ = await getBenchmarkSummary();
        if (summ.summary) setSummary(summ.summary);
      } catch (e) {
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRunBatch = async () => {
    setRunning(true);
    try {
      await submitEvalBatch([]); // Backend handles loading the benchmark payload now
    } catch (e) {
      alert("Failed to submit batch");
    }
    setTimeout(() => setRunning(false), 2000);
  };

  const totalCompleted = metrics?.completed || 0;
  const totalFailed = metrics?.failed || 0;
  const totalPending = (metrics?.wait || 0) + (metrics?.active || 0);

  const chartData = summary.length > 0 ? summary.map((s: any) => ({
    name: s.tier,
    'RAG OFF': s['RAG OFF']?.meanRetries || 0,
    'RAG ON': s['RAG ON']?.meanRetries || 0
  })) : [
    { name: 'Tier 1', 'RAG OFF': 0, 'RAG ON': 0 },
    { name: 'Tier 2', 'RAG OFF': 0, 'RAG ON': 0 },
    { name: 'Tier 3', 'RAG OFF': 0, 'RAG ON': 0 },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center glass-panel p-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Evaluation Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Run and monitor the 60-query 2x3 factorial benchmark.</p>
        </div>
        <button
          onClick={handleRunBatch}
          disabled={running}
          className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          {running ? 'Queueing...' : 'Trigger Batch Evaluation'}
        </button>
      </div>

      <div className="glass-panel p-6">
        <h3 className="text-lg font-medium text-white mb-4">Queue Progress</h3>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Completed</div>
            <div className="text-2xl font-bold text-green-400">{totalCompleted}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Failed</div>
            <div className="text-2xl font-bold text-red-400">{totalFailed}</div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50">
            <div className="text-sm text-slate-400">Pending</div>
            <div className="text-2xl font-bold text-yellow-400">{totalPending}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-lg font-medium text-white mb-6">Mean Retry Count by Tier</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend />
                <Bar dataKey="RAG OFF" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="RAG ON" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
