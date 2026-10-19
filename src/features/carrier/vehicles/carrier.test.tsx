import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';
import { carrierProfile, normalizePlate, validateVehicle, type CarrierRepository, type Vehicle, type VehicleInput } from './vehicle.model';
import { CarrierPanel, CarrierProfileForm, VehicleForm } from './carrier-panel';
import { createCarrierRepository } from './carrier.api';
const input: VehicleInput = { license_plate: '60C-123.45', vehicle_type: 'ENCLOSED', capacity_kg: 5000, provinces: ['Tiền Giang'], min_temperature_c: null, max_temperature_c: null, active: true };
const profile = { company_name: 'Nhà xe An Bình', province: 'Tiền Giang', address: null, service_provinces: ['Tiền Giang'] };
test('profile mapping trims, respects schema/list limits, and whitelists business fields', () => {
  expect(carrierProfile({ ...profile, company_name: ' An Bình ', role: 'ADMIN' } as typeof profile)).toEqual({ ...profile, company_name: 'An Bình' });
  expect(() => carrierProfile({ ...profile, province: '' })).toThrow();
  expect(() => carrierProfile({ ...profile, address: 'x'.repeat(501) })).toThrow();
  expect(() => carrierProfile({ ...profile, service_provinces: Array(33).fill('x') })).toThrow();
});
test('vehicle plate normalization and payload exclude server-generated/ownership fields', () => {
  expect(normalizePlate('60c 123.45')).toBe('60C12345');
  expect(validateVehicle({ ...input, carrier_id: 'forged', license_plate_normalized: 'bad' } as VehicleInput)).toEqual(input);
});
test.each([0, -1, NaN, Infinity, 1.0001, 100000000000])('invalid capacity %s', capacity_kg => expect(() => validateVehicle({ ...input, capacity_kg })).toThrow());
test('temperature and vehicle type constraints', () => {
  for (const partial of [
    { min_temperature_c: 0 }, { min_temperature_c: 0, max_temperature_c: 4 },
    { vehicle_type: 'REFRIGERATED', min_temperature_c: 10, max_temperature_c: 5 },
    { vehicle_type: 'REFRIGERATED', min_temperature_c: -101, max_temperature_c: 4 },
    { vehicle_type: 'REFRIGERATED', min_temperature_c: 0.001, max_temperature_c: 4 },
  ]) expect(() => validateVehicle({ ...input, ...partial } as VehicleInput)).toThrow();
  expect(validateVehicle({ ...input, vehicle_type: 'REFRIGERATED', min_temperature_c: -100, max_temperature_c: 100 })).toMatchObject({ min_temperature_c: -100 });
});
test('vehicle form invalid, clears temperatures on type change, saves and blocks duplicate submit', async () => {
  let resolve!: () => void; const save = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  render(<VehicleForm initial={null} onSave={save} />); await userEvent.click(screen.getByRole('button', { name: 'Lưu xe' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Tải trọng'); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Biển số/), { target: { value: '60C-12345' } }); fireEvent.change(screen.getByLabelText('Tải trọng', { exact: false, selector: 'input' }), { target: { value: '5' } });
  await userEvent.selectOptions(screen.getByLabelText('Loại xe'), 'REFRIGERATED');
  fireEvent.change(screen.getByLabelText('Nhiệt độ thấp nhất (°C)'), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText('Nhiệt độ cao nhất (°C)'), { target: { value: '4' } });
  await userEvent.selectOptions(screen.getByLabelText('Loại xe'), 'ENCLOSED'); expect(screen.getByText(/Đã bỏ khoảng nhiệt độ/)).toBeVisible();
  fireEvent.submit(screen.getByRole('form')); fireEvent.submit(screen.getByRole('form')); expect(save).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ capacity_kg: 5000, min_temperature_c: null }));
  resolve(); await screen.findByText('Đã lưu thành công.');
});
test('profile form keeps input on save error and allows retry', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('Chưa lưu được')).mockResolvedValue(profile);
  render(<CarrierProfileForm initial={profile} onSave={save} />);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ nhà xe' })); expect(await screen.findByRole('alert')).toHaveTextContent('Chưa lưu'); expect(screen.getByLabelText(/Tên đơn vị/)).toHaveValue(profile.company_name);
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ nhà xe' })); await screen.findByText('Đã lưu thành công.');
});
test('panel profile creation unlocks fleet and never queries for missing identity', async () => {
  const repo: CarrierRepository = { profile: vi.fn(async () => null), saveProfile: vi.fn(async () => profile), list: vi.fn(async () => ({ rows: [], count: 0 })), saveVehicle: vi.fn(async () => ({ ...input, id: 'v', carrier_id: 'u' })), remove: vi.fn(async () => undefined) };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}><CarrierPanel authenticatedUserId={null} repository={repo} /></QueryClientProvider>);
  expect(repo.profile).not.toHaveBeenCalled(); view.rerender(<QueryClientProvider client={client}><CarrierPanel authenticatedUserId="u" repository={repo} /></QueryClientProvider>);
  await screen.findByText('Hoàn thiện hồ sơ trước khi thêm xe'); expect(repo.list).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Tên đơn vị/), { target: { value: 'Nhà xe' } }); fireEvent.change(screen.getByLabelText(/Tỉnh \/ thành phố/), { target: { value: 'Tiền Giang' } });
  await userEvent.click(screen.getByRole('button', { name: 'Lưu hồ sơ nhà xe' })); await waitFor(() => expect(repo.list).toHaveBeenCalled());
});
test('repository checks Auth, zero-row mutation, duplicate plate and server-side filters', async () => {
  const calls: [string, unknown[]][] = []; let error: { code?: string } | null = null; let data: unknown = null;
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'update', 'insert', 'delete', 'eq', 'ilike', 'contains', 'order', 'range']) chain[name] = (...args: unknown[]) => { calls.push([name, args]); return chain; };
  chain.single = async () => ({ data, error }); chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data, error, count: 1 }).then(resolve);
  const from = vi.fn(() => chain); const getUser = vi.fn(async () => ({ data: { user: { id: 'u' } }, error: null }));
  const repo = createCarrierRepository({ from, auth: { getUser } } as unknown as SupabaseClient);
  await expect(repo.remove('foreign', 'v')).rejects.toThrow('Phiên'); expect(from).not.toHaveBeenCalled();
  await expect(repo.remove('u', 'v')).rejects.toThrow('Chưa xóa'); error = { code: '23505' };
  await expect(repo.saveVehicle('u', input)).rejects.toThrow('Biển số đã có'); error = null; data = [{ ...input, id: 'v', carrier_id: 'u' } as Vehicle];
  await repo.list('u', { search: '60C', province: 'Tiền Giang', active: 'true', sort: 'capacity', page: 2 });
  expect(calls).toContainEqual(['range', [20, 39]]); expect(calls).toContainEqual(['contains', ['provinces', ['Tiền Giang']]]); expect(calls).toContainEqual(['eq', ['carrier_id', 'u']]);
});
