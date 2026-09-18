import { useEffect, useState } from 'react';
import { getDatasetSchema, getDatasetQueries } from '../services/dataset';

export const DatasetDashboard = () => {
  const [schema, setSchema] = useState<any[]>([]);
  const [queries, setQueries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'queries' | 'schema'>('queries');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const schemaRes = await getDatasetSchema();
        setSchema(schemaRes.schema || []);
        
        const queriesRes = await getDatasetQueries();
        setQueries(queriesRes.queries || []);
      } catch (e) {
        console.error('Failed to fetch dataset details');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="p-6 text-white">Loading Dataset...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center glass-panel p-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Dataset & Schema Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Review the database structure and the exact 30 benchmark queries.</p>
        </div>
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700/50 mt-4 md:mt-0">
          <button
            onClick={() => setActiveTab('queries')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'queries' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Benchmark Queries ({queries.length})
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === 'schema' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Database Schema
          </button>
        </div>
      </div>

      {activeTab === 'queries' && (
        <div className="glass-panel p-6 overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-300">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">ID</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3 rounded-tr-lg">Gold SQL</th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q, i) => (
                <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-xs text-indigo-300">{q.question_id}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded bg-slate-800 text-xs font-medium border border-slate-700">
                      Tier {q.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-white">{q.question}</td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400 whitespace-pre-wrap">{q.gold_sql}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'schema' && (
        <div className="space-y-6">
          {schema.map((table, idx) => (
            <div key={idx} className="glass-panel p-6 overflow-x-auto">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-indigo-400">TABLE</span> {table.tableName}
              </h3>
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Column Name</th>
                    <th className="px-4 py-3">Data Type</th>
                    <th className="px-4 py-3 rounded-tr-lg">Details / Constraints</th>
                  </tr>
                </thead>
                <tbody>
                  {table.columns.map((col: any, cIdx: number) => (
                    <tr key={cIdx} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400 font-medium">{col.name}</td>
                      <td className="px-4 py-3 font-mono text-indigo-300">{col.type}</td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{col.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {schema.length === 0 && (
             <div className="glass-panel p-6 text-slate-400 text-center">No tables parsed or schema is empty.</div>
          )}
        </div>
      )}
    </div>
  );
};
