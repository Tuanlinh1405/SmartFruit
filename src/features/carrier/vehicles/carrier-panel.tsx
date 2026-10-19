import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, DataTable, EmptyState, ErrorState, FilterBar, LoadingState, PageHeader } from '../../../components/shared';
import { Button, Modal, Select, TextArea, TextField } from '../../../components/ui';
import { carrierRepository } from './carrier.api';
import { carrierProfile, formatQuantity, initialVehicleFilters, labels, parseQuantity, validateVehicle, vehicleTypes,
  type CarrierProfileInput, type CarrierRepository, type Vehicle, type VehicleFilters, type VehicleInput } from './vehicle.model';

export const carrierKeys = { profile: (u: string | null) => ['carrier-profile', u] as const, vehicles: (u: string | null) => ['carrier-vehicles', u] as const };
function SaveForm({ label, onSave, children }: { label: string; onSave: () => Promise<unknown>; children: ReactNode }) {
  const [pending, setPending] = useState(false); const busy = useRef(false); const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setPending(true); setMessage('');
    try { await onSave(); setMessage('Đã lưu thành công.'); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Chưa lưu được.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <form aria-label={label} noValidate className="stack-sm" onSubmit={submit}><fieldset className="stack-sm" disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>{children}<div><Button type="submit" loading={pending}>{label}</Button></div></fieldset>{message && <p role={message === 'Đã lưu thành công.' ? 'status' : 'alert'}>{message}</p>}</form>;
}
export function CarrierProfileForm({ initial, onSave }: { initial: CarrierProfileInput | null; onSave: (input: CarrierProfileInput) => Promise<unknown> }) {
  const [name, setName] = useState(initial?.company_name ?? ''); const [province, setProvince] = useState(initial?.province ?? '');
  const [address, setAddress] = useState(initial?.address ?? ''); const [regions, setRegions] = useState(initial?.service_provinces.join('\n') ?? '');
  return <SaveForm label="Lưu hồ sơ nhà xe" onSave={() => onSave(carrierProfile({ company_name: name, province, address, service_provinces: labels(regions) }))}>
    <TextField label="Tên đơn vị vận tải" required value={name} onChange={e => setName(e.target.value)} />
    <TextField label="Tỉnh / thành phố" required value={province} onChange={e => setProvince(e.target.value)} />
    <TextField label="Địa chỉ" value={address} onChange={e => setAddress(e.target.value)} />
    <TextArea label="Các tỉnh phục vụ" hint="Mỗi dòng một tỉnh, tối đa 32 mục." value={regions} onChange={e => setRegions(e.target.value)} />
  </SaveForm>;
}
export function VehicleForm({ initial, onSave }: { initial: Vehicle | null; onSave: (input: VehicleInput) => Promise<unknown> }) {
  const [plate, setPlate] = useState(initial?.license_plate ?? ''); const [type, setType] = useState<VehicleInput['vehicle_type']>(initial?.vehicle_type ?? 'ENCLOSED');
  const [quantity, setQuantity] = useState(initial ? formatQuantity(initial.capacity_kg, 'tonne') : ''); const [unit, setUnit] = useState<'kg' | 'tonne'>('tonne');
  const [provinces, setProvinces] = useState(initial?.provinces.join('\n') ?? ''); const [min, setMin] = useState(initial?.min_temperature_c == null ? '' : String(initial.min_temperature_c));
  const [max, setMax] = useState(initial?.max_temperature_c == null ? '' : String(initial.max_temperature_c)); const [active, setActive] = useState(initial?.active ?? true);
  const [notice, setNotice] = useState('');
  return <SaveForm label="Lưu xe" onSave={async () => {
    const kg = parseQuantity(quantity, unit); if (kg === null) throw new Error('Tải trọng không hợp lệ.');
    await onSave(validateVehicle({ license_plate: plate, vehicle_type: type, capacity_kg: kg, provinces: labels(provinces),
      min_temperature_c: min.trim() ? Number(min) : null, max_temperature_c: max.trim() ? Number(max) : null, active }));
  }}>
    <TextField label="Biển số" required value={plate} onChange={e => setPlate(e.target.value)} />
    <Select label="Loại xe" value={type} onChange={e => { const next = e.target.value as VehicleInput['vehicle_type']; setType(next); if (next !== 'REFRIGERATED') { if (min || max) setNotice('Đã bỏ khoảng nhiệt độ vì xe không còn là xe lạnh.'); setMin(''); setMax(''); } }}>{Object.entries(vehicleTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
    <TextField label="Tải trọng" required value={quantity} inputMode="decimal" onChange={e => setQuantity(e.target.value)} />
    <Select label="Đơn vị tải trọng" value={unit} onChange={e => { const next = e.target.value as 'kg' | 'tonne'; const kg = parseQuantity(quantity, unit); setUnit(next); if (kg !== null) setQuantity(formatQuantity(kg, next)); }}><option value="tonne">Tấn</option><option value="kg">Kg</option></Select>
    <TextArea label="Tỉnh hoạt động" hint="Mỗi dòng một tỉnh." value={provinces} onChange={e => setProvinces(e.target.value)} />
    <TextField label="Nhiệt độ thấp nhất (°C)" disabled={type !== 'REFRIGERATED'} value={min} inputMode="decimal" onChange={e => setMin(e.target.value)} />
    <TextField label="Nhiệt độ cao nhất (°C)" disabled={type !== 'REFRIGERATED'} value={max} inputMode="decimal" onChange={e => setMax(e.target.value)} />
    {notice && <p role="status">{notice}</p>}<label className="row"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Xe đang hoạt động</label>
  </SaveForm>;
}
export function CarrierPanel(props: { authenticatedUserId: string | null; repository?: CarrierRepository }) { return <PanelForUser key={props.authenticatedUserId ?? 'none'} {...props} />; }
function PanelForUser({ authenticatedUserId: userId, repository = carrierRepository }: { authenticatedUserId: string | null; repository?: CarrierRepository }) {
  const client = useQueryClient(); const [filters, setFilters] = useState({ ...initialVehicleFilters }); const [editing, setEditing] = useState<Vehicle | null | undefined>();
  const [deleting, setDeleting] = useState<Vehicle | null>(null); const [actionError, setActionError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  const profile = useQuery({ queryKey: carrierKeys.profile(userId), enabled: !!userId, queryFn: () => repository.profile(userId!), retry: false });
  const vehicles = useQuery({ queryKey: [...carrierKeys.vehicles(userId), filters], enabled: !!userId && !!profile.data, queryFn: () => repository.list(userId!, filters), retry: false });
  async function vehicleAction(work: () => Promise<unknown>) {
    if (lock.current) return; lock.current = true; setBusy(true); setActionError('');
    try { await work(); await client.invalidateQueries({ queryKey: carrierKeys.vehicles(userId) }); setDeleting(null); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Thao tác chưa hoàn tất.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (!userId) return <EmptyState title="Chưa đăng nhập" description="Vui lòng đăng nhập bằng tài khoản Carrier." />;
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) return <ErrorState message="Không thể tải hồ sơ nhà xe." onRetry={() => { void profile.refetch(); }} />;
  const filter = <K extends keyof VehicleFilters>(key: K, value: VehicleFilters[K]) => setFilters(current => ({ ...current, [key]: value, page: key === 'page' ? Number(value) : 1 }));
  return <div className="stack"><PageHeader title="Hồ sơ & danh sách xe" />
    <Card title="Hồ sơ đơn vị vận tải"><CarrierProfileForm initial={profile.data} onSave={async input => { const saved = await repository.saveProfile(userId, input); client.setQueryData(carrierKeys.profile(userId), saved); }} /></Card>
    {!profile.data ? <EmptyState title="Hoàn thiện hồ sơ trước khi thêm xe" /> : <>
      <div><Button onClick={() => setEditing(null)}>Thêm xe</Button></div>
      <FilterBar search={filters.search} onSearch={value => filter('search', value)}><TextField label="Lọc tỉnh hoạt động" value={filters.province} onChange={e => filter('province', e.target.value)} />
        <Select label="Hoạt động" value={filters.active} onChange={e => filter('active', e.target.value as VehicleFilters['active'])}><option value="">Tất cả</option><option value="true">Đang hoạt động</option><option value="false">Ngừng hoạt động</option></Select>
        <Select label="Sắp xếp xe" value={filters.sort} onChange={e => filter('sort', e.target.value as VehicleFilters['sort'])}><option value="newest">Mới tạo trước</option><option value="capacity">Tải trọng lớn trước</option></Select>
      </FilterBar>
      {vehicles.isPending ? <LoadingState /> : vehicles.isError ? <ErrorState message="Không thể tải danh sách xe." onRetry={() => { void vehicles.refetch(); }} /> : <>
        <DataTable caption="Đội xe của bạn" rows={vehicles.data.rows} rowKey={v => v.id} columns={[
          { id: 'plate', label: 'Biển số', render: v => v.license_plate }, { id: 'type', label: 'Loại xe', render: v => vehicleTypes[v.vehicle_type] },
          { id: 'capacity', label: 'Tải trọng', render: v => `${v.capacity_kg.toLocaleString('vi-VN')} kg` },
          { id: 'regions', label: 'Khu vực', render: v => v.provinces.join(', ') },
          { id: 'actions', label: 'Thao tác', render: v => <div className="row"><Button variant="secondary" disabled={busy} onClick={() => setEditing(v)}>Sửa {v.license_plate}</Button><Button variant="secondary" disabled={busy} onClick={() => { void vehicleAction(() => repository.saveVehicle(userId, { ...v, active: !v.active }, v.id)); }}>{v.active ? 'Ngừng' : 'Kích hoạt'} {v.license_plate}</Button><Button variant="danger" disabled={busy} onClick={() => setDeleting(v)}>Xóa {v.license_plate}</Button></div> },
        ]} />
        <div className="row"><Button disabled={filters.page <= 1} onClick={() => filter('page', filters.page - 1)}>Trang trước</Button><p>Trang {filters.page} · {vehicles.data.count} xe</p><Button disabled={filters.page * 20 >= vehicles.data.count} onClick={() => filter('page', filters.page + 1)}>Trang sau</Button></div>
      </>}
    </>}
    <Modal title={editing ? 'Sửa xe' : 'Thêm xe'} description="Thông tin xe được lưu thật vào đội xe của bạn." open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }}>
      {editing !== undefined && <VehicleForm key={editing?.id ?? 'new'} initial={editing} onSave={async input => { await repository.saveVehicle(userId, input, editing?.id); await client.invalidateQueries({ queryKey: carrierKeys.vehicles(userId) }); setEditing(undefined); }} />}
    </Modal>
    <Modal title="Xóa xe" description="Xóa vĩnh viễn xe khỏi danh mục của bạn." open={!!deleting} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
      <Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>Quay lại</Button><Button variant="danger" loading={busy} onClick={() => { if (deleting) void vehicleAction(() => repository.remove(userId, deleting.id)); }}>Xác nhận xóa xe</Button>{actionError && <p role="alert">{actionError}</p>}
    </Modal>
    {actionError && !deleting && <p role="alert">{actionError}</p>}
  </div>;
}
