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

describe('LiveRunner Form Validation and Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows form submission and triggers loading state', async () => {
    (api.submitQuery as any).mockResolvedValue({ jobId: 'job-1' });
    (api.checkQueryStatus as any).mockResolvedValue({ state: 'waiting' }); // hangs

    render(
      <BrowserRouter>
        <LiveRunner />
      </BrowserRouter>
    );

    const runBtn = screen.getByText('Run Query');
    fireEvent.click(runBtn);

    expect(screen.getByText('Executing...')).toBeInTheDocument();
    expect(runBtn).toBeDisabled();
    
    expect(api.submitQuery).toHaveBeenCalledWith(expect.objectContaining({
      tier: 1,
      rag_enabled: false
    }));
  });
});
