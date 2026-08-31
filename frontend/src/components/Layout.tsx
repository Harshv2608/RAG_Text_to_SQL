import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { checkHealth } from '../services/api';
import { Database, LayoutDashboard, Terminal } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export const Layout = () => {
  const [health, setHealth] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        setHealth(data);
      } catch (e) {
        setHealth({ status: 'error' });
      }
    };
    fetchHealth();
    const intv = setInterval(fetchHealth, 5000);
    return () => clearInterval(intv);
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'up' || status === 'healthy' || status === 'ready') return 'bg-green-500';
    if (status === 'down' || status === 'error') return 'bg-red-500';
    return 'bg-slate-500';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 font-sans text-slate-200">
      <nav className="sticky top-0 z-50 bg-slate-800/80 backdrop-blur-lg border-b border-slate-700/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center gap-2">
                <Database className="h-6 w-6 text-indigo-500" />
                <span className="font-bold text-xl tracking-tight text-white">InsightSQL AI</span>
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                <Link to="/" className={cn("inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors", location.pathname === '/' ? "bg-indigo-500/10 text-indigo-400" : "text-slate-300 hover:bg-slate-700/50 hover:text-white")}>
                  <Terminal className="w-4 h-4 mr-2" /> Live Runner
                </Link>
                <Link to="/eval" className={cn("inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors", location.pathname === '/eval' ? "bg-indigo-500/10 text-indigo-400" : "text-slate-300 hover:bg-slate-700/50 hover:text-white")}>
                  <LayoutDashboard className="w-4 h-4 mr-2" /> Eval Dashboard
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center text-xs font-medium bg-slate-800 rounded-full px-3 py-1 border border-slate-700">
                <span data-testid="gateway-badge" className={cn("w-2 h-2 rounded-full mr-2", getStatusColor(health?.services?.gateway))} /> Gateway
              </div>
              <div className="flex items-center text-xs font-medium bg-slate-800 rounded-full px-3 py-1 border border-slate-700">
                <span data-testid="redis-badge" className={cn("w-2 h-2 rounded-full mr-2", getStatusColor(health?.services?.redis))} /> Redis
              </div>
              <div className="flex items-center text-xs font-medium bg-slate-800 rounded-full px-3 py-1 border border-slate-700">
                <span data-testid="ai-badge" className={cn("w-2 h-2 rounded-full mr-2", getStatusColor(health?.services?.ai_service))} /> AI Service
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
