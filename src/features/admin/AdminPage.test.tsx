import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminPage } from './AdminPage';

describe('Admin fixture controls', () => {
  it('shows details, edits only the fixture and resets it', () => {
    render(<MemoryRouter initialEntries={['/admin/buyers']}><Routes>
      <Route path="/admin/:section" element={<AdminPage />} />
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
    expect(screen.getByRole('dialog', { name: 'Chi tiết fixture' })).toHaveTextContent('Nông sản Vạn Đạt');
    fireEvent.click(screen.getByRole('dialog').querySelector('button[aria-label="Đóng"]')!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Chỉnh sửa' })[0]);
    fireEvent.change(screen.getByLabelText('Tên hiển thị'), { target: { value: 'Tên thử nghiệm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }));
    expect(screen.getByText('Tên thử nghiệm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại demo' }));
    expect(screen.getByText('Nông sản Vạn Đạt')).toBeInTheDocument();
  });
});
