// Browser test entry only. Never imported by src/main or registered in AppRouter.
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '../../src/app/providers';
import { FarmerProfilePanel } from '../../src/features/farmer/profile/farmer-profile-panel';
import type { FarmerProfile, FarmerProfileRepository } from '../../src/features/farmer/profile/farmer-profile.model';
import { LotDetailPanel, LotEditorPanel, LotsListPanel } from '../../src/features/farmer/lots/lot-panels';
import { testCatalog, testLot } from '../../src/features/farmer/lots/lot.fixtures';
import type { Lot, LotPrivateInput, LotPrivateRepository, LotsRepository } from '../../src/features/farmer/lots/lot.model';
import type { LotImagesRepository, SignedImage } from '../../src/features/farmer/lots/lot-images.api';
import { CarrierPanel } from '../../src/features/carrier/vehicles/carrier-panel';
import type { CarrierProfileInput, CarrierRepository, Vehicle } from '../../src/features/carrier/vehicles/vehicle.model';
import { FarmerMatchingPanel, type FarmerMatchingRepository, type MatchScorer } from '../../src/features/farmer/matching/farmer-matching';
import '../../src/styles.css';
const farmer = '30000000-0000-4000-8000-000000000001'; const lotId = '40000000-0000-4000-8000-000000000001';
const lots = new Map<string, Lot>([[lotId, testLot({ id: lotId, farmer_id: farmer })]]); const privateData = new Map<string, LotPrivateInput>(); const images = new Map<string, SignedImage[]>(); const profiles = new Map<string, FarmerProfile>(); const vehicles = new Map<string, Vehicle>(); const carriers = new Map<string, CarrierProfileInput>();
const repository: LotsRepository = {
  hasFarmerProfile: async () => true, catalog: async () => testCatalog,
  list: async (u, f) => { const rows = [...lots.values()].filter(l => l.farmer_id === u && (!f.search || l.title.includes(f.search)) && (!f.status || l.status === f.status)); return { rows: rows.slice((f.page - 1) * 20, f.page * 20), count: rows.length }; },
  detail: async (u, id) => { const lot = lots.get(id); if (!lot || lot.farmer_id !== u) throw new Error('No access'); return lot; },
  createDraft: async (u, input, id) => { const value = testLot({ ...input, id, farmer_id: u }); lots.set(id, value); return value; },
  update: async (u, id, input) => { const value = { ...await repository.detail(u, id), ...input }; lots.set(id, value); return value; },
  changeStatus: async (u, id, status) => { const value = { ...await repository.detail(u, id), status }; lots.set(id, value); return value; }, remove: async (_u, id) => { lots.delete(id); },
};
const privateRepository: LotPrivateRepository = { load: async (_u, id) => privateData.get(id) ?? null, save: async (_u, id, input) => { privateData.set(id, input); return input; } };
const imageRepository: LotImagesRepository = {
  list: async (_u, id) => images.get(id) ?? [],
  upload: async (u, id, file, replaceId) => { const rows = images.get(id) ?? []; const old = rows.find(i => i.id === replaceId); if (!old && rows.length >= 8) throw new Error('Tối đa tám ảnh.'); const value = { id: old?.id ?? crypto.randomUUID(), lot_id: id, storage_path: `${u}/${id}/${crypto.randomUUID()}.png`, sort_order: old?.sort_order ?? rows.length, url: URL.createObjectURL(file), expiresAt: Date.now() + 60000 }; images.set(id, [...rows.filter(i => i.id !== old?.id), value]); if (old?.url) URL.revokeObjectURL(old.url); },
  remove: async (_u, id, image) => { const old = images.get(id)?.find(i => i.id === image.id); if (old?.url) URL.revokeObjectURL(old.url); images.set(id, (images.get(id) ?? []).filter(i => i.id !== image.id)); }, cleanup: async () => 0,
  deleteLot: async (u, id) => { for (const image of images.get(id) ?? []) await imageRepository.remove(u, id, image); lots.delete(id); },
};
const carrierRepo: CarrierRepository = {
  profile: async u => carriers.get(u) ?? null, saveProfile: async (u, input) => { carriers.set(u, input); return input; },
  list: async u => ({ rows: [...vehicles.values()].filter(v => v.carrier_id === u), count: [...vehicles.values()].filter(v => v.carrier_id === u).length }),
  saveVehicle: async (u, input, id = crypto.randomUUID()) => { const vehicle = { ...input, id, carrier_id: u }; vehicles.set(id, vehicle); return vehicle; }, remove: async (_u, id) => { vehicles.delete(id); },
};
const profileRepo: FarmerProfileRepository = { load: async u => profiles.get(u) ?? null, save: async (u, input) => { const profile = { ...input, user_id: u }; profiles.set(u, profile); return profile; } };
const matchingRepo: FarmerMatchingRepository = { lots: async () => [...lots.values()], candidates: async (u, id) => ({ lot: await repository.detail(u, id), requests: [{ id: 'request-test', status: 'OPEN', buyer_id: 'buyer-test', fruit_type_id: 'fruit-1', variety_id: null, title: 'Nhu cầu test', target_quantity_kg: 5000, min_lot_quantity_kg: null, allow_partial: true, min_price_vnd_per_kg: 60000, max_price_vnd_per_kg: 70000, required_start: '2026-10-15', required_end: '2026-10-20', preferred_provinces: [] }], partners: [{ user_id: 'buyer-test', display_name: 'Đối tác test', province: 'Tiền Giang' }] }) };
// Fixed contract fixture, not a second production scoring algorithm.
const testScorer: MatchScorer = lot => [{ lotId: lot.id, requestId: 'request-test', score: 86, reasons: ['Lý do test'], missingInformation: [], ruleVersion: 'test-only', suggestedQuantityKg: 1000 }];
function Harness() {
  const [page, setPage] = useState(new URLSearchParams(location.search).get('panel') ?? 'new'); const [current, setCurrent] = useState(lotId); const [user, setUser] = useState<string | null>(farmer);
  return <main className="dev-page stack"><p>Test harness độc lập, repository giả lập; không chứng minh persistence hoặc RLS thật.</p><label>Test identity<select aria-label="Test identity" value={user ?? ''} onChange={e => setUser(e.target.value || null)}><option value={farmer}>Farmer test 1</option><option value="30000000-0000-4000-8000-000000000002">Farmer test 2</option><option value="">Signed out</option></select></label>
    <nav className="row">{['profile', 'lots', 'new', 'carrier', 'matching'].map(p => <button key={p} className="button button-secondary" onClick={() => setPage(p)}>Harness {p}</button>)}</nav>
    {page === 'profile' && <FarmerProfilePanel authenticatedUserId={user} repository={profileRepo} />}
    {page === 'lots' && <LotsListPanel authenticatedUserId={user} repository={repository} onCreate={() => setPage('new')} onOpen={id => { setCurrent(id); setPage('detail'); }} />}
    {(page === 'new' || page === 'edit') && <LotEditorPanel authenticatedUserId={user} repository={repository} privateRepository={privateRepository} imagesRepository={imageRepository} lotId={page === 'edit' ? current : undefined} />}
    {page === 'detail' && <LotDetailPanel authenticatedUserId={user} lotId={current} repository={repository} privateRepository={privateRepository} imagesRepository={imageRepository} onEdit={() => setPage('edit')} onDeleted={() => setPage('lots')} />}
    {page === 'carrier' && <CarrierPanel authenticatedUserId={user} repository={carrierRepo} />}
    {page === 'matching' && <FarmerMatchingPanel authenticatedUserId={user} repository={matchingRepo} scorer={testScorer} onConnect={async () => { setPage('lots'); }} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<AppProviders><MemoryRouter><Harness /></MemoryRouter></AppProviders>);
