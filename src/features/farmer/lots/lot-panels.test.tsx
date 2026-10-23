import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { LotEditorPanel, LotsListPanel, LotDetailPanel } from './lot-panels';
import { LotForm } from './lot-form';
import { LotActions } from './lot-actions';
import { lotKeys } from './use-lots';
import { testCatalog, testInput, testLot, testRepositories } from './lot.fixtures';
import type { Lot, LotListFilters, LotPrivateInput } from './lot.model';
vi.mock('./lot-images.api', async importOriginal => ({ ...(await importOriginal<typeof import('./lot-images.api')>()), lotImagesRepository: {
  list: async () => [], upload: async () => undefined, remove: async () => undefined, cleanup: async () => 0, deleteLot: async () => undefined,
} }));

function renderApp(element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: 0 } } });
  return { client, ...render(<QueryClientProvider client={client}>{element}</QueryClientProvider>) };
}
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fillForm() {
  const changes = [
    ['Tên lô hàng', 'Lô Ri6'], ['Khối lượng', '1.250125'],
    ['Giá chào (đ/kg)', '65000'], ['Bắt đầu thu hoạch', '2026-10-15'], ['Kết thúc thu hoạch', '2026-10-20'],
    ['Tỉnh / thành phố', 'Tiền Giang'],
  ];
  fireEvent.change(screen.getByRole('combobox',{name:/Loại quả/}),{target:{value:'sau rieng'}});fireEvent.click(screen.getByRole('option',{name:'Sầu riêng · Ri6'}));
  for (const [label, value] of changes) fireEvent.change(screen.getByLabelText(label, { exact: false, selector: label === 'Khối lượng' ? 'input' : undefined }), { target: { value } });
}

test('missing identity makes all panels inert without any repository queries', () => {
  const repo = testRepositories(); const load = vi.spyOn(repo.lots, 'list'); const detail = vi.spyOn(repo.lots, 'detail'); const catalog = vi.spyOn(repo.lots, 'catalog');
  renderApp(<><LotsListPanel authenticatedUserId={null} repository={repo.lots} onOpen={vi.fn()} onCreate={vi.fn()} /><LotEditorPanel authenticatedUserId={null} repository={repo.lots} /><LotDetailPanel authenticatedUserId={null} lotId="lot-1" repository={repo.lots} onEdit={vi.fn()} onDeleted={vi.fn()} /></>);
  expect(screen.getAllByText('Chưa đăng nhập')).toHaveLength(3);
  expect(load).not.toHaveBeenCalled(); expect(detail).not.toHaveBeenCalled(); expect(catalog).not.toHaveBeenCalled();
});
test('missing Farmer profile blocks creation; catalog errors offer retry', async () => {
  const repo = testRepositories(); vi.spyOn(repo.lots, 'hasFarmerProfile').mockResolvedValue(false);
  const view = renderApp(<LotEditorPanel authenticatedUserId="farmer-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  expect(await screen.findByText('Chưa có hồ sơ nhà vườn')).toBeVisible(); expect(screen.queryByRole('form')).not.toBeInTheDocument();
  view.unmount();
  vi.spyOn(repo.lots, 'catalog').mockRejectedValueOnce(new Error('catalog failed')).mockResolvedValue(testCatalog);
  renderApp(<LotEditorPanel authenticatedUserId="farmer-1" repository={repo.lots} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh mục');
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Chưa có hồ sơ nhà vườn')).toBeVisible();
});
test('invalid draft/publish does not save; preview is live and public-only', async () => {
  const save = vi.fn(); renderApp(<LotForm initialLot={null} catalog={testCatalog} priceFloor={null} onSave={save} />);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' })); expect(save).not.toHaveBeenCalled();
  expect(screen.getByLabelText(/Tên lô hàng/)).toHaveAttribute('aria-invalid', 'true');
  fillForm();
  const preview = within(screen.getByRole('complementary', { name: 'Xem trước' }));
  expect(preview.getByRole('heading', { name: 'Lô Ri6' })).toBeVisible();
  expect(preview.getByText(/1.250125 tấn/)).toBeVisible();
  expect(preview.queryByText(/Giá sàn|Ghi chú nội bộ/)).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/upload/i)).not.toBeInTheDocument();
  expect(preview.getByText('Ảnh đã chọn được lưu sau khi có lô nháp.')).toBeVisible();
});
test('unit changes preserve exact quantity; changing fruit resets variety', async () => {
  const save = vi.fn().mockResolvedValue(testLot());
  renderApp(<LotForm initialLot={testLot()} catalog={testCatalog} priceFloor={null} onSave={save} />);
  await userEvent.selectOptions(screen.getByLabelText('Đơn vị khối lượng'), 'kg');
  expect(screen.getByRole('textbox', { name: 'Khối lượng' })).toHaveValue('1250.125');
  await userEvent.selectOptions(screen.getByLabelText('Đơn vị khối lượng'), 'tonne');
  expect(screen.getByRole('textbox', { name: 'Khối lượng' })).toHaveValue('1.250125');
  await userEvent.clear(screen.getByRole('combobox',{name:/Loại quả/}));await userEvent.type(screen.getByRole('combobox',{name:/Loại quả/}),'mit');await userEvent.click(screen.getByRole('option',{name:'Mít'}));
  expect(screen.getByRole('combobox',{name:/Loại quả/})).toHaveValue('Mít');
  expect(screen.queryByRole('option', { name: 'Ri6' })).not.toBeInTheDocument();
});
test('edit preserves assigned inactive catalog without permitting new inactive selections', async () => {
  const old = testLot({ fruit_type_id: 'inactive-fruit', variety_id: null }); const save = vi.fn().mockResolvedValue(old);
  renderApp(<LotForm initialLot={old} catalog={testCatalog} priceFloor={null} onSave={save} />);
  await userEvent.click(screen.getByRole('combobox',{name:/Loại quả/}));
  expect(screen.getByRole('option', { name: 'Quả cũ (ngừng sử dụng)' })).toHaveAttribute('aria-disabled','true');
  expect(screen.getByLabelText(/Loại quả/)).toHaveValue('Quả cũ');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ fruit_type_id: 'inactive-fruit' }), 'save');
});
test('failed create retains input; successful retry creates one draft per attempt with stable ID', async () => {
  const repo = testRepositories(); const create = vi.spyOn(repo.lots, 'createDraft').mockRejectedValueOnce(new Error('Chưa tạo được lô nháp')).mockImplementation(async (userId, input, id) => testLot({ ...input, id, farmer_id: userId }));
  renderApp(<LotEditorPanel authenticatedUserId="farmer-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  await screen.findByRole('form'); fillForm();
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tạo được');
  expect(screen.getByLabelText(/Tên lô hàng/)).toHaveValue('Lô Ri6');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
  expect(await screen.findByText('Đã lưu lô nháp.')).toBeVisible();
  expect(create.mock.calls[0][2]).toBe(create.mock.calls[1][2]);
});
test('publish failure after create keeps draft ID; retry updates/publishes the same lot, without duplicate insert', async () => {
  const repo = testRepositories(); const create = vi.spyOn(repo.lots, 'createDraft');
  const update = vi.spyOn(repo.lots, 'update');
  const publish = vi.spyOn(repo.lots, 'changeStatus').mockRejectedValueOnce(new Error('network')).mockImplementation(async (userId, id, status) => testLot({ id, farmer_id: userId, status }));
  const view = renderApp(<LotEditorPanel authenticatedUserId="farmer-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  await screen.findByRole('form'); fillForm();
  await userEvent.click(screen.getByRole('button', { name: 'Đăng lô hàng' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Đã lưu nháp nhưng chưa đăng');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng lô hàng' })).toBeEnabled());
  const id = create.mock.calls[0][2];
  await userEvent.click(screen.getByRole('button', { name: 'Đăng lô hàng' }));
  expect(await screen.findByText('Đã lưu lô đã đăng.')).toBeVisible();
  expect(create).toHaveBeenCalledOnce(); expect(update).toHaveBeenCalledWith('farmer-1', id, expect.any(Object));
  expect(publish.mock.calls.map(call => call[1])).toEqual([id, id]);
  expect(view.client.getQueryData(lotKeys.detail('farmer-1', id))).toMatchObject({ status: 'PUBLISHED' });
});
test('double submit is blocked before state updates; background data does not overwrite dirty form', async () => {
  const pending = deferred<Lot>(); const save = vi.fn(() => pending.promise);
  const view = renderApp(<LotForm initialLot={testLot()} catalog={testCatalog} priceFloor={null} onSave={save} />);
  fireEvent.change(screen.getByLabelText(/Tên lô hàng/), { target: { value: 'Đang sửa' } });
  view.rerender(<QueryClientProvider client={view.client}><LotForm initialLot={testLot({ title: 'Server update' })} catalog={testCatalog} priceFloor={null} onSave={save} /></QueryClientProvider>);
  expect(screen.getByLabelText(/Tên lô hàng/)).toHaveValue('Đang sửa');
  const form = screen.getByRole('form'); fireEvent.submit(form); fireEvent.submit(form);
  expect(save).toHaveBeenCalledOnce(); expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeDisabled();
  await act(async () => { pending.resolve(testLot()); });
});
test('unknown private floor disables public save; successful retry enables it; floor blocks a lower ask', async () => {
  const repo = testRepositories(); vi.spyOn(repo.privateDetails, 'load').mockRejectedValueOnce(new Error('private load error')).mockResolvedValue({ price_floor_vnd_per_kg: 60000, internal_notes: 'SECRET' });
  const update = vi.spyOn(repo.lots, 'update');
  renderApp(<LotEditorPanel authenticatedUserId="farmer-1" lotId="lot-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  await screen.findByRole('form', { name: 'Thông tin lô hàng' });
  await waitFor(() => expect(screen.getAllByRole('alert').some(item => item.textContent?.includes('Chưa tải được giá sàn'))).toBe(true));
  expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Tải lại thông tin riêng' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu nháp' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/Giá chào/), { target: { value: '59000' } });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }));
  expect(screen.getByLabelText(/Giá chào/)).toHaveAccessibleDescription(expect.stringContaining('giá sàn thấp hơn'));
  expect(update).not.toHaveBeenCalled();
  expect(within(screen.getByRole('complementary')).queryByText('SECRET')).not.toBeInTheDocument();
});
test('private form clears floor to null, keeps notes on failure, retries separately from public content', async () => {
  const repo = testRepositories(); vi.spyOn(repo.privateDetails, 'load').mockResolvedValue({ price_floor_vnd_per_kg: 60000, internal_notes: 'Ghi chú riêng' });
  const privateSave = vi.spyOn(repo.privateDetails, 'save').mockRejectedValueOnce(new Error('failed')).mockImplementation(async (_userId, _id, input) => input);
  const publicSave = vi.spyOn(repo.lots, 'update');
  renderApp(<LotEditorPanel authenticatedUserId="farmer-1" lotId="lot-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  const input = await screen.findByLabelText('Giá sàn riêng (đ/kg)');
  fireEvent.change(input, { target: { value: '' } });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu thông tin riêng' }));
  expect(await screen.findByText(/Chưa lưu được thông tin riêng/)).toBeVisible();
  expect(screen.getByLabelText('Ghi chú nội bộ')).toHaveValue('Ghi chú riêng');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu thông tin riêng' }));
  expect(await screen.findByText('Đã lưu thông tin riêng.')).toBeVisible();
  expect(privateSave).toHaveBeenLastCalledWith('farmer-1', 'lot-1', { price_floor_vnd_per_kg: null, internal_notes: 'Ghi chú riêng' });
  expect(publicSave).not.toHaveBeenCalled();
});
test('server pagination and filters reset page; navigation handlers are live', async () => {
  const repo = testRepositories(); const filters: LotListFilters[] = [];
  vi.spyOn(repo.lots, 'list').mockImplementation(async (_id, filter) => { filters.push(filter); return { rows: [testLot()], count: 41 }; });
  const onOpen = vi.fn(); const onCreate = vi.fn();
  renderApp(<LotsListPanel authenticatedUserId="farmer-1" repository={repo.lots} onOpen={onOpen} onCreate={onCreate} />);
  await screen.findByRole('table');
  await userEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
  await waitFor(() => expect(filters.at(-1)?.page).toBe(2));
  fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: 'Ri6' } });
  await waitFor(() => expect(filters.at(-1)).toMatchObject({ page: 1, search: 'Ri6' }));
  await userEvent.selectOptions(screen.getByLabelText('Sắp xếp'), 'price_asc');
  await waitFor(() => expect(filters.at(-1)?.sort).toBe('price_asc'));
  await userEvent.click(screen.getAllByRole('button', { name: 'Lô Ri6' })[0]); expect(onOpen).toHaveBeenCalledWith('lot-1');
  await userEvent.click(screen.getByRole('button', { name: 'Tạo lô hàng' })); expect(onCreate).toHaveBeenCalledOnce();
  expect(screen.queryByRole('button', { name: /Sắp xếp Giá chào/ })).not.toBeInTheDocument();
});
test('list loading/error retry and empty state are distinct', async () => {
  const repo = testRepositories(); const pending = deferred<{ rows: Lot[]; count: number }>();
  vi.spyOn(repo.lots, 'list').mockReturnValueOnce(pending.promise).mockResolvedValue({ rows: [], count: 0 });
  renderApp(<LotsListPanel authenticatedUserId="farmer-1" repository={repo.lots} onOpen={vi.fn()} onCreate={vi.fn()} />);
  await waitFor(() => expect(repo.lots.list).toHaveBeenCalledOnce()); expect(screen.getByText('Đang tải…')).toBeVisible();
  await act(async () => { pending.reject(new Error('network')); });
  expect(await screen.findByRole('alert')).toHaveTextContent('Không thể tải danh sách');
  await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
  expect(await screen.findByText('Không tìm thấy kết quả')).toBeVisible();
});
test('detail not found does not show private form or actions', async () => {
  const repo = testRepositories(); vi.spyOn(repo.lots, 'detail').mockRejectedValue(new Error('denied'));
  renderApp(<LotDetailPanel authenticatedUserId="farmer-1" lotId="foreign" repository={repo.lots} onEdit={vi.fn()} onDeleted={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy lô hàng hoặc bạn không có quyền');
  expect(screen.queryByRole('button', { name: 'Xóa lô' })).not.toBeInTheDocument();
});
test('status/delete actions require confirmation, show errors and suppress reopening', async () => {
  const status = vi.fn().mockRejectedValueOnce(new Error('Trạng thái đã thay đổi')).mockResolvedValue(undefined);
  const remove = vi.fn().mockRejectedValue(new Error('Lô có ảnh. Cần xử lý ảnh ở A-03 trước khi xóa lô.'));
  renderApp(<LotActions lot={testLot()} onStatus={status} onDelete={remove} />);
  await userEvent.click(screen.getByRole('button', { name: 'Công bố lô' }));
  await userEvent.click(screen.getByRole('button', { name: 'Quay lại' })); expect(status).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Công bố lô' }));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Trạng thái đã thay đổi');
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument()); expect(status).toHaveBeenLastCalledWith('PUBLISHED');
  await userEvent.click(screen.getByRole('button', { name: 'Xóa lô' }));
  await userEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Lô có ảnh');
});
test('switching user removes dirty input and keeps query caches scoped to identity', async () => {
  const repo = testRepositories(); const load = vi.spyOn(repo.lots, 'detail').mockImplementation(async (userId, id) => testLot({ farmer_id: userId, id }));
  const view = renderApp(<LotEditorPanel authenticatedUserId="farmer-1" lotId="lot-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  await screen.findByRole('form', { name: 'Thông tin lô hàng' });
  fireEvent.change(screen.getByLabelText(/Tên lô hàng/), { target: { value: 'Riêng user 1' } });
  view.rerender(<QueryClientProvider client={view.client}><LotEditorPanel authenticatedUserId="farmer-2" lotId="lot-2" repository={repo.lots} privateRepository={repo.privateDetails} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getByLabelText(/Tên lô hàng/)).toHaveValue('Lô Ri6'));
  expect(load).toHaveBeenLastCalledWith('farmer-2', 'lot-2');
  expect(view.client.getQueryData(lotKeys.detail('farmer-2', 'lot-2'))).toMatchObject({ farmer_id: 'farmer-2', id: 'lot-2' });
  expect(view.client.getQueryData(lotKeys.detail('farmer-2', 'lot-1'))).toBeUndefined();
});
test('explicit reload refreshes asking price and private data without erasing edits', async () => {
  const repo = testRepositories(); vi.spyOn(repo.lots, 'detail').mockResolvedValueOnce(testLot()).mockResolvedValue(testLot({ price_vnd_per_kg: 70000 }));
  const privateLoad = vi.spyOn(repo.privateDetails, 'load');
  renderApp(<LotEditorPanel authenticatedUserId="farmer-1" lotId="lot-1" repository={repo.lots} privateRepository={repo.privateDetails} />);
  await screen.findByRole('form', { name: 'Thông tin lô hàng' });
  fireEvent.change(screen.getByLabelText(/Tên lô hàng/), { target: { value: 'Đang sửa, chưa lưu' } });
  await userEvent.click(screen.getByRole('button', { name: 'Tải lại thông tin riêng' }));
  expect(await screen.findByText('Đã tải lại dữ liệu đã lưu. Các ô đang sửa được giữ nguyên.')).toBeVisible();
  expect(screen.getByText(/Giá chào đã lưu: 70/)).toBeVisible(); expect(screen.getByLabelText(/Tên lô hàng/)).toHaveValue('Đang sửa, chưa lưu'); expect(privateLoad.mock.calls.length).toBeGreaterThanOrEqual(2);
});
