import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Layout } from '../src/components/Layout';
import * as api from '../src/services/api';
import { BrowserRouter } from 'react-router-dom';

vi.mock('../src/services/api', () => ({
  checkHealth: vi.fn()
}));

describe('Layout Component Health Polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly maps the nested health.services schema to status colors', async () => {
    (api.checkHealth as any).mockResolvedValue({
      status: 'ok',
      services: {
        gateway: 'up',
        redis: 'down',
        ai_service: 'up'
      }
    });

    render(<BrowserRouter><Layout /></BrowserRouter>);

    await waitFor(() => {
      // The status badges are rendered inside spans next to the text.
      // Green = bg-green-500, Red = bg-red-500
      
      const gatewayBadge = screen.getByTestId('gateway-badge');
      expect(gatewayBadge).toHaveClass('bg-green-500');
      
      const redisBadge = screen.getByTestId('redis-badge');
      expect(redisBadge).toHaveClass('bg-red-500');
      
      const aiBadge = screen.getByTestId('ai-badge');
      expect(aiBadge).toHaveClass('bg-green-500');
    });
  });
});
