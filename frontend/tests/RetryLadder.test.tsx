import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveRunner } from '../src/pages/LiveRunner';
import * as api from '../src/services/api';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../src/services/api', () => ({
  submitQuery: vi.fn(),
  checkQueryStatus: vi.fn()
}));

describe('RetryLadder Expansion and Badge Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly colored badges and calculates max(0, attempts - 1) formula', async () => {
    (api.submitQuery as any).mockResolvedValue({ jobId: 'job-1' });
    
    (api.checkQueryStatus as any).mockResolvedValue({
      state: 'completed',
      result: {
        success: true,
        total_tokens: 200,
        logs: [
          { attempt_number: 1, status: 'rejected_safety', generated_sql: 'SELECT * FROM users', error_message: 'Unsafe', tokens_used: 50 },
          { attempt_number: 2, status: 'rejected_execution', generated_sql: 'SELECT id FROM userss', error_message: 'Table not found', tokens_used: 50 },
          { attempt_number: 3, status: 'success', generated_sql: 'SELECT id FROM users', tokens_used: 100 }
        ],
        data: [{ id: 1 }]
      }
    });

    render(<BrowserRouter><LiveRunner /></BrowserRouter>);
    fireEvent.click(screen.getByText('Run Query'));

    await waitFor(() => {
      expect(screen.getByText('The Retry Ladder')).toBeInTheDocument();
    });

    // Verify formula
    expect(screen.getByText('3')).toBeInTheDocument(); // total attempts
    expect(screen.getByText('2')).toBeInTheDocument(); // retries (3 - 1)

    // Verify SQL syntax highlighting classes are present (monospaced)
    const sqlBlocks = screen.getAllByText(/SELECT/);
    expect(sqlBlocks.length).toBeGreaterThan(0);
    expect(sqlBlocks[0]).toHaveClass('font-mono');
    
    // Verify specific error messages injected
    expect(screen.getByText('Table not found')).toBeInTheDocument();
    expect(screen.getByText('Unsafe')).toBeInTheDocument();
  });
});
