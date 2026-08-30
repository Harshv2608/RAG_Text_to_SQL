import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvalDashboard } from '../src/pages/EvalDashboard';
import * as api from '../src/services/api';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../src/services/api', () => ({
  getMetrics: vi.fn(),
  submitEvalBatch: vi.fn(),
  getBenchmarkSummary: vi.fn()
}));

// Mock recharts to prevent ResizeObserver errors in jsdom
vi.mock('recharts', () => {
  const Original = vi.importActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: () => <div data-testid="barchart" />,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

describe('EvalDashboard Metric Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders factorial conditions correctly via benchmark summary endpoint', async () => {
    (api.getMetrics as any).mockResolvedValue({ metrics: { queue: { completed: 60, failed: 0, wait: 0, active: 0 } } });
    (api.getBenchmarkSummary as any).mockResolvedValue({
      summary: [
        { tier: 'Tier 1', 'RAG OFF': { meanRetries: 1.5, successRate: 0.8 }, 'RAG ON': { meanRetries: 0.5, successRate: 1.0 } },
        { tier: 'Tier 2', 'RAG OFF': { meanRetries: 2.5, successRate: 0.6 }, 'RAG ON': { meanRetries: 1.0, successRate: 0.9 } },
        { tier: 'Tier 3', 'RAG OFF': { meanRetries: 4.0, successRate: 0.3 }, 'RAG ON': { meanRetries: 2.0, successRate: 0.7 } }
      ]
    });

    render(<BrowserRouter><EvalDashboard /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('60')).toBeInTheDocument(); // completed count
      expect(screen.getByTestId('barchart')).toBeInTheDocument();
    });
  });
});
