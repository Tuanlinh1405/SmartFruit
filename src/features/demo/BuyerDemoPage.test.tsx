import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BuyerDemoPage } from './BuyerDemoPage';

describe('Buyer demo', () => {
  it('changes and resets an invitation without a server call', () => {
    render(<MemoryRouter><BuyerDemoPage kind="invitations" /></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Đồng ý' })[0]);
    expect(screen.getByText('Đã đồng ý')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại demo' }));
    expect(screen.queryByText('Đã đồng ý')).not.toBeInTheDocument();
  });
});
