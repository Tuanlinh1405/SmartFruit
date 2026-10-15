import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { FarmerProfilePanel } from './farmer-profile-panel';
import { FarmerProfileForm } from './farmer-profile-form';
import { farmerProfileKey } from './use-farmer-profile';
import { parseProfileForm, profileToForm, type FarmerProfile, type FarmerProfileRepository } from './farmer-profile.model';

function row(userId = 'farmer-1'): FarmerProfile {
  return { ...parseProfileForm({ ...profileToForm(), farm_name: 'Vườn Ri6', province: 'Tiền Giang', tree_count: '0' }).data!, user_id: userId };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function setup(repository: FarmerProfileRepository, userId: string | null = 'farmer-1') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><FarmerProfilePanel authenticatedUserId={userId} repository={repository} /></QueryClientProvider>);
  return { client, ...view, changeUser(nextId: string | null) {
    view.rerender(<QueryClientProvider client={client}><FarmerProfilePanel authenticatedUserId={nextId} repository={repository} /></QueryClientProvider>);
  } };
}
function repository() {
  return { load: vi.fn<(userId: string) => Promise<FarmerProfile | null>>().mockResolvedValue(null),
    save: vi.fn<FarmerProfileRepository['save']>().mockImplementation(async (userId, input) => ({ ...input, user_id: userId })) };
}
function fillRequired() {
  fireEvent.change(screen.getByLabelText(/Tên vườn/), { target: { value: 'Vườn Ri6' } });
  fireEvent.change(screen.getByLabelText(/Tỉnh \/ thành phố/), { target: { value: 'Tiền Giang' } });
}

test('no identity disables queries and exposes no edit form', () => {
  const repo = repository(); setup(repo, null);
  expect(screen.getByText('Chưa đăng nhập')).toBeVisible();
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(repo.load).not.toHaveBeenCalled();
});

test('loading, load error and explicit retry lead to a new-profile form', async () => {
  const pending = deferred<FarmerProfile | null>(); const repo = repository();
  repo.load.mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error('failed'));
  const view = setup(repo);
  expect(screen.getByText('Đang tải…')).toBeVisible();
  await act(async () => { pending.resolve(null); });
  expect(await screen.findByText('Chưa có hồ sơ nhà vườn')).toBeVisible();
  await act(async () => { await view.client.invalidateQueries({ queryKey: farmerProfileKey('farmer-1') }); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải hồ sơ');
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByRole('form')).toBeVisible();
  expect(repo.load).toHaveBeenCalledTimes(3);
});

test('existing profile is populated; background cache updates do not erase unsaved edits', async () => {
  const repo = repository(); repo.load.mockResolvedValue(row());
  const view = setup(repo);
  expect(await screen.findByLabelText(/Tên vườn/)).toHaveValue('Vườn Ri6');
  expect(screen.getByLabelText('Số cây')).toHaveValue(0);
  fireEvent.change(screen.getByLabelText(/Tên vườn/), { target: { value: 'Đang sửa' } });
  act(() => { view.client.setQueryData(farmerProfileKey('farmer-1'), { ...row(), farm_name: 'Server update' }); });
  expect(screen.getByLabelText(/Tên vườn/)).toHaveValue('Đang sửa');
});

test('invalid form prevents save and associates field errors', async () => {
  const save = vi.fn(); render(<FarmerProfileForm initialProfile={null} onSave={save} />);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(screen.getByLabelText(/Tên vườn/)).toHaveAttribute('aria-invalid', 'true');
  expect(save).not.toHaveBeenCalled();
  fillRequired(); fireEvent.change(screen.getByLabelText('Vĩ độ'), { target: { value: '10' } });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(screen.getByLabelText('Kinh độ')).toHaveAccessibleDescription(expect.stringContaining('nhập đủ'));
  expect(save).not.toHaveBeenCalled();
});

test('save retains input on API failure, retries and updates only the current-user cache', async () => {
  const repo = repository(); repo.save.mockRejectedValueOnce(new Error('network'));
  const view = setup(repo);
  await screen.findByRole('form'); fillRequired();
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Thông tin đã nhập được giữ lại');
  expect(screen.getByLabelText(/Tên vườn/)).toHaveValue('Vườn Ri6');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Đã lưu hồ sơ');
  expect(repo.save).toHaveBeenLastCalledWith('farmer-1', expect.objectContaining({ farm_name: 'Vườn Ri6', area_m2: null }));
  expect(view.client.getQueryData(farmerProfileKey('farmer-1'))).toMatchObject({ user_id: 'farmer-1' });
  expect(view.client.getQueryData(farmerProfileKey('farmer-2'))).toBeUndefined();
});

test('duplicate submit is blocked synchronously and fields are locked while saving', async () => {
  const pending = deferred<unknown>(); const save = vi.fn(() => pending.promise);
  render(<FarmerProfileForm initialProfile={row()} onSave={save} />);
  const form = screen.getByRole('form');
  fireEvent.submit(form); fireEvent.submit(form);
  expect(save).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeDisabled();
  expect(screen.getByLabelText(/Tên vườn/)).toBeDisabled();
  await act(async () => { pending.resolve(undefined); });
  expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toBeEnabled();
});

test('switching identity never shows another user form or dirty input; logout stops reads', async () => {
  const repo = repository(); repo.load.mockImplementation(async id => id === 'farmer-1' ? row() : null);
  const view = setup(repo);
  await screen.findByRole('form');
  fireEvent.change(screen.getByLabelText(/Tên vườn/), { target: { value: 'Riêng của user 1' } });
  view.changeUser('farmer-2');
  await waitFor(() => expect(screen.getByLabelText(/Tên vườn/)).toHaveValue(''));
  expect(repo.load).toHaveBeenLastCalledWith('farmer-2');
  view.changeUser(null);
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
  expect(screen.getByText('Chưa đăng nhập')).toBeVisible();
});
