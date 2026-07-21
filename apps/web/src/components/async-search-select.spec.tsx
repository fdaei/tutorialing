import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocaleProvider } from './locale-provider';
import { AsyncSearchSelect } from './async-search-select';

function Harness() {
  const [value, setValue] = useState<{ id: string; label: string; description?: string } | null>(null);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}><LocaleProvider locale="en"><AsyncSearchSelect entity="users" value={value} onChange={setValue} name="userId" /></LocaleProvider></QueryClientProvider>;
}

describe('AsyncSearchSelect', () => {
  beforeEach(() => {
    sessionStorage.clear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items: [{ id: 'user-1', label: 'Sara Dadkhah', description: '09120000001' }], pagination: { page: 1, pageSize: 20, total: 1, pages: 1, hasMore: false } }) }) as jest.Mock;
  });

  it('debounces server search and selects a readable label without exposing the technical id', async () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: /Search and select/ }));
    fireEvent.change(screen.getByPlaceholderText('Name, phone, or email…'), { target: { value: 'Sara' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/search/users?q=Sara'), expect.any(Object)), { timeout: 1500 });
    const option = await screen.findByRole('option', { name: /Sara Dadkhah/ });
    fireEvent.click(option);
    expect(screen.getByText('Sara Dadkhah')).toBeTruthy();
    expect(container.textContent).not.toContain('user-1');
    expect((container.querySelector('input[name="userId"]') as HTMLInputElement).value).toBe('user-1');
  });
});
