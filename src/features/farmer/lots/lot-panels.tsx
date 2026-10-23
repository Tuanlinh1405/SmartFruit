import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, DataTable, EmptyState, ErrorState, FilterBar, LoadingState, PageHeader } from '../../../components/shared';
import { Badge, Button, Select, TextField } from '../../../components/ui';
import { statusLabels } from '../../../components/ui/badge';
import { formatDate } from '../../../lib/formatters';
import { lotsRepository } from './lot.api';
import { LotActions } from './lot-actions';
import { LotForm } from './lot-form';
import { LotPrivateCard } from './lot-private-card';
import { LotImages, LotPhotoPicker, uploadQueuedPhotos } from './lot-images';
import { lotImagesRepository, type LotImagesRepository } from './lot-images.api';
import { lotKeys, useLotActions, useLotCatalog, useLotDetail, useLotList, useLotPrivate, useLotResources } from './use-lots';
import { initialLotFilters, lotPageSize, lotStatuses, tradeMethods, type Lot, type LotCatalog, type LotInput, type LotListFilters, type LotPrivateRepository, type LotsRepository } from './lot.model';

interface BaseProps { authenticatedUserId: string | null; repository?: LotsRepository; imagesRepository?: LotImagesRepository; onSavedLot?: (lotId: string) => void; onCompleteProfile?: () => void; onFindBuyers?: (lot: Lot) => void; onFindTransport?: (lot: Lot) => void; }
const signedOut = <EmptyState title="Chưa đăng nhập" description="Vui lòng đăng nhập bằng tài khoản Farmer." />;
const missingProfile = <EmptyState title="Chưa có hồ sơ nhà vườn" description="Hoàn thiện hồ sơ nhà vườn trước khi đăng lô hàng." />;

// Independent panels are mounted under the shared Auth guard.
export function LotsListPanel(props: BaseProps & { onOpen: (id: string) => void; onCreate: () => void }) {
  return <ListForUser key={props.authenticatedUserId ?? 'signed-out'} {...props} />;
}
function ListForUser({ authenticatedUserId: userId, repository, onOpen, onCreate, onCompleteProfile }: BaseProps & { onOpen: (id: string) => void; onCreate: () => void }) {
  const [filters, setFilters] = useState({ ...initialLotFilters });
  const resources = useLotResources(userId, repository);
  const list = useLotList(resources.profile.data ? userId : null, filters, repository);
  if (!userId) return signedOut;
  if (resources.profile.isPending || resources.catalog.isPending) return <LoadingState />;
  if (resources.profile.isError || resources.catalog.isError) return <ErrorState message="Không thể tải hồ sơ hoặc danh mục." onRetry={() => { void resources.profile.refetch(); void resources.catalog.refetch(); }} />;
  if (!resources.profile.data) return <div className="stack">{missingProfile}{onCompleteProfile && <Button onClick={onCompleteProfile}>Hoàn thiện hồ sơ nhà vườn</Button>}</div>;
  function filter<K extends Exclude<keyof LotListFilters, 'page'>>(key: K, value: LotListFilters[K]) { setFilters(current => ({ ...current, [key]: value, page: 1 })); }
  return <div className="stack">
    <PageHeader title="Danh sách lô hàng" action={<Button onClick={onCreate}>Tạo lô hàng</Button>} />
    <FilterBar search={filters.search} onSearch={value => filter('search', value)}>
      <Select label="Trạng thái" value={filters.status} onChange={event => filter('status', event.target.value as LotListFilters['status'])}><option value="">Tất cả</option>{lotStatuses.map(status => <option key={status} value={status}>{statusLabels[status].label}</option>)}</Select>
      <Select label="Loại quả" value={filters.fruitTypeId} onChange={event => filter('fruitTypeId', event.target.value)}><option value="">Tất cả</option>{resources.catalog.data!.fruits.map(fruit => <option key={fruit.id} value={fruit.id}>{fruit.name}</option>)}</Select>
      <TextField label="Tỉnh / thành phố" value={filters.province} onChange={event => filter('province', event.target.value)} />
      <Select label="Sắp xếp" value={filters.sort} onChange={event => filter('sort', event.target.value as LotListFilters['sort'])}><option value="newest">Mới tạo trước</option><option value="price_asc">Giá tăng dần</option><option value="price_desc">Giá giảm dần</option></Select>
    </FilterBar>
    {list.isPending ? <LoadingState /> : list.isError ? <ErrorState message="Không thể tải danh sách lô hàng." onRetry={() => { void list.refetch(); }} /> : <>
      <DataTable rows={list.data.rows} rowKey={lot => lot.id} caption="Lô hàng của bạn" columns={[
        { id: 'title', label: 'Lô hàng', render: lot => <span className={`lot-status-edge edge-${lot.status.toLowerCase()}`}><Button variant="ghost" onClick={() => onOpen(lot.id)}>{lot.title}</Button></span> },
        { id: 'quantity', label: 'Khối lượng', render: lot => `${lot.quantity_kg.toLocaleString('vi-VN')} kg` },
        { id: 'price', label: 'Giá chào', render: lot => `${lot.price_vnd_per_kg.toLocaleString('vi-VN')} đ/kg` },
        { id: 'province', label: 'Khu vực', render: lot => lot.province },
        { id: 'status', label: 'Trạng thái', render: lot => <Badge status={lot.status} /> },
      ]} />
      <div className="row"><Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Trang trước</Button>
        <p aria-live="polite">Trang {filters.page} / {Math.max(1, Math.ceil(list.data.count / lotPageSize))} · {list.data.count} lô</p>
        <Button variant="secondary" disabled={filters.page * lotPageSize >= list.data.count} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Trang sau</Button></div>
    </>}
  </div>;
}

export function LotDetailPanel(props: BaseProps & { lotId: string; privateRepository?: LotPrivateRepository; onEdit: (id: string) => void; onDeleted: () => void }) {
  return <DetailForUser key={`${props.authenticatedUserId}/${props.lotId}`} {...props} />;
}
function DetailForUser({ authenticatedUserId: userId, lotId, repository, imagesRepository = lotImagesRepository, privateRepository, onEdit, onDeleted, onFindBuyers, onFindTransport }: BaseProps & { lotId: string; privateRepository?: LotPrivateRepository; onEdit: (id: string) => void; onDeleted: () => void }) {
  const query = useLotDetail(userId, lotId, repository); const actions = useLotActions(userId, repository);
  const client = useQueryClient();
  const catalog = useLotCatalog(userId, repository);
  if (!userId) return signedOut;
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorState message="Không tìm thấy lô hàng hoặc bạn không có quyền truy cập." onRetry={() => { void query.refetch(); }} />;
  const lot = query.data;
  return <div className="stack"><PageHeader title={lot.title} action={<Button onClick={() => onEdit(lot.id)}>Sửa nội dung</Button>} />
    {catalog.isError && <ErrorState message="Không thể tải tên loại quả và giống." onRetry={() => { void catalog.refetch(); }} />}
    <Card title="Nội dung công khai"><div className="stack-sm"><Badge status={lot.status} /><p>{lot.quantity_kg.toLocaleString('vi-VN')} kg · {lot.price_vnd_per_kg.toLocaleString('vi-VN')} đ/kg</p>
      <p>{catalog.data?.fruits.find(item => item.id === lot.fruit_type_id)?.name} {catalog.data?.varieties.find(item => item.id === lot.variety_id)?.name}</p>
      <p>{lot.province} {lot.district}</p><p>{formatDate(lot.harvest_start)} – {formatDate(lot.harvest_end)}</p><p>{lot.grade}</p><p>{tradeMethods[lot.selling_method]}</p><p>{lot.description}</p><p>{lot.certifications.join(', ')} · Tự khai báo</p><p>{lot.packaging_options.join(', ')}</p><p>{lot.growing_area_code}</p>
      </div></Card>
    <div className="row">{onFindBuyers && <Button variant="secondary" disabled={lot.status !== 'PUBLISHED'} title={lot.status !== 'PUBLISHED' ? 'Công bố lô trước khi matching.' : undefined} onClick={() => onFindBuyers(lot)}>Tìm người mua phù hợp</Button>}{onFindTransport && <Button variant="secondary" onClick={() => onFindTransport(lot)}>Thông tin vận chuyển</Button>}</div>
    <LotImages userId={userId} lotId={lot.id} repository={imagesRepository} />
    <LotActions lot={lot} onStatus={async status => { await actions.mutateAsync({ kind: 'status', id: lot.id, status }); }} onDelete={async () => {
      try { await imagesRepository.deleteLot(userId, lot.id); }
      catch (error) {
        // Preparation may have closed the lot before a Storage failure.
        void client.invalidateQueries({ queryKey: lotKeys.all(userId) });
        void client.invalidateQueries({ queryKey: ['lot-images', userId, lot.id] });
        throw error;
      }
      client.removeQueries({ queryKey: lotKeys.all(userId) }); onDeleted();
    }} />
    <LotPrivateCard userId={userId} lot={lot} repository={privateRepository} />
  </div>;
}

export function LotEditorPanel(props: BaseProps & { lotId?: string; privateRepository?: LotPrivateRepository }) {
  return <EditorForUser key={`${props.authenticatedUserId}/${props.lotId ?? 'new'}`} {...props} />;
}
function EditorForUser({ authenticatedUserId: userId, lotId, repository, imagesRepository, privateRepository, onSavedLot, onCompleteProfile }: BaseProps & { lotId?: string; privateRepository?: LotPrivateRepository }) {
  const resources = useLotResources(userId, repository); const detail = useLotDetail(userId, lotId ?? '', repository);
  if (!userId) return signedOut;
  if (resources.profile.isPending || resources.catalog.isPending || (lotId && detail.isPending)) return <LoadingState />;
  if (resources.profile.isError || resources.catalog.isError || (lotId && detail.isError)) return <ErrorState message="Không thể tải danh mục/hồ sơ hoặc không truy cập được lô." onRetry={() => { void resources.profile.refetch(); void resources.catalog.refetch(); if (lotId) void detail.refetch(); }} />;
  if (!resources.profile.data) return <div className="stack">{missingProfile}{onCompleteProfile && <Button onClick={onCompleteProfile}>Hoàn thiện hồ sơ nhà vườn</Button>}</div>;
  return <Editor userId={userId} initialLot={lotId ? detail.data! : null} catalog={resources.catalog.data!} repository={repository} imagesRepository={imagesRepository} privateRepository={privateRepository} onSavedLot={onSavedLot} />;
}
function Editor({ userId, initialLot, catalog, repository = lotsRepository, imagesRepository = lotImagesRepository, privateRepository, onSavedLot }: { userId: string; initialLot: Lot | null; catalog: LotCatalog; repository?: LotsRepository; imagesRepository?: LotImagesRepository; privateRepository?: LotPrivateRepository; onSavedLot?: (id: string) => void }) {
  const [saved, setSaved] = useState(initialLot);
  const draftId = useRef(initialLot?.id ?? crypto.randomUUID());
  const actions = useLotActions(userId, repository); const client = useQueryClient();
  const details = useLotPrivate(userId, saved?.id ?? '', privateRepository);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]); const completedPhotos = useRef(new Set<File>());
  const [reloading, setReloading] = useState(false); const [reloadMessage, setReloadMessage] = useState('');
  async function reloadStoredData() {
    if (!saved || reloading || actions.isPending) return;
    setReloading(true); setReloadMessage('');
    try {
      const latest = await repository.detail(userId, saved.id); setSaved(latest);
      client.setQueryData(lotKeys.detail(userId, latest.id), latest);
      await details.refetch({ throwOnError: true });
      setReloadMessage('Đã tải lại dữ liệu đã lưu. Các ô đang sửa được giữ nguyên.');
    } catch { setReloadMessage('Chưa tải lại được đầy đủ dữ liệu. Vui lòng thử lại.'); }
    finally { setReloading(false); }
  }
  async function save(input: LotInput, intent: 'save' | 'publish'): Promise<Lot> {
    const lot = await actions.mutateAsync(saved ? { kind: 'update', id: saved.id, input } : { kind: 'create', draftId: draftId.current, input });
    if (!lot) throw new Error('Chưa lưu được lô.');
    setSaved(lot);
    try {
      await uploadQueuedPhotos(imagesRepository, userId, lot.id, photoFiles, completedPhotos.current);
      setPhotoFiles([]); void client.invalidateQueries({ queryKey: ['lot-images', userId, lot.id] });
    } catch (cause) { throw new Error(`Nội dung lô đã lưu nhưng ảnh chưa hoàn tất. ${cause instanceof Error ? cause.message : 'Vui lòng thử lại.'}`); }
    if (intent === 'publish' && lot.status === 'DRAFT') {
      try {
        const published = await actions.mutateAsync({ kind: 'status', id: lot.id, status: 'PUBLISHED' });
        if (!published) throw new Error(); setSaved(published); onSavedLot?.(published.id); return published;
      } catch { throw new Error('Đã lưu nháp nhưng chưa đăng. Thử Đăng lô hàng lại trên cùng lô; không cần tạo lô mới.'); }
    }
    onSavedLot?.(lot.id); return lot;
  }
  return <div className="stack"><PageHeader title={saved ? 'Sửa lô hàng' : 'Tạo lô hàng'} />
    {saved && <div className="row"><Badge status={saved.status} /><Button variant="secondary" loading={reloading} disabled={actions.isPending} onClick={() => { void reloadStoredData(); }}>Tải lại thông tin riêng</Button><p>Giá chào đã lưu: {saved.price_vnd_per_kg.toLocaleString('vi-VN')} đ/kg</p></div>}
    {reloadMessage && <p role="status">{reloadMessage}</p>}
    {saved && details.isError && <ErrorState message="Chưa tải được giá sàn. Không thể lưu nội dung lô cho tới khi tải lại thành công." onRetry={() => { void details.refetch(); }} />}
    <LotForm initialLot={saved} catalog={catalog} disabled={reloading || (!!saved && (details.isPending || details.isError))} priceFloor={details.data?.price_floor_vnd_per_kg ?? null} onSave={save} imagePicker={<LotPhotoPicker files={photoFiles} onChange={setPhotoFiles} />} />
    {saved && <LotImages userId={userId} lotId={saved.id} repository={imagesRepository} />}
    {saved && <LotPrivateCard userId={userId} lot={saved} repository={privateRepository} />}
  </div>;
}
