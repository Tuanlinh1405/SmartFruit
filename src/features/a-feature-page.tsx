import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FarmerProfilePanel } from './farmer/profile/farmer-profile-panel';
import { LotDetailPanel, LotEditorPanel, LotsListPanel } from './farmer/lots/lot-panels';
import { CarrierPanel } from './carrier/vehicles/carrier-panel';
import { FarmerMatchingPanel, type MatchScorer } from './farmer/matching/farmer-matching';
import { openConnection } from './trading/api';

// Mounted by the shared router under resolved FARMER/CARRIER guards.
export function AFeaturePage({ feature, authenticatedUserId, scorer, scoringVersion }: { feature: 'profile' | 'lots' | 'new' | 'edit' | 'detail' | 'vehicles' | 'matches'; authenticatedUserId: string; scorer?: MatchScorer; scoringVersion?: string }) {
  const navigate = useNavigate(); const { id } = useParams(); const [params] = useSearchParams();
  if (feature === 'profile') return <FarmerProfilePanel authenticatedUserId={authenticatedUserId} />;
  if (feature === 'vehicles') return <CarrierPanel authenticatedUserId={authenticatedUserId} />;
  if (feature === 'lots') return <LotsListPanel authenticatedUserId={authenticatedUserId} onCompleteProfile={() => navigate('/farmer/profile')} onCreate={() => navigate('/farmer/lots/new')} onOpen={lotId => navigate(`/farmer/lots/${lotId}`)} />;
  if (feature === 'detail') return <LotDetailPanel authenticatedUserId={authenticatedUserId} lotId={id ?? ''} onEdit={lotId => navigate(`/farmer/lots/${lotId}/edit`)} onDeleted={() => navigate('/farmer/lots')} onFindBuyers={lot => navigate(`/farmer/matches?lotId=${encodeURIComponent(lot.id)}`)} onFindTransport={lot => navigate(`/farmer/transport?lotId=${encodeURIComponent(lot.id)}`, { state: { transportLot: { id: lot.id, title: lot.title, quantityKg: lot.quantity_kg, province: lot.province } } })} />;
  if (feature === 'matches') return <FarmerMatchingPanel authenticatedUserId={authenticatedUserId} initialLotId={params.get('lotId') ?? ''} scorer={scorer} scoringVersion={scoringVersion} onConnect={async (lotId, requestId) => {
    const connectionId = await openConnection(lotId, requestId);
    navigate(`/farmer/invitations?connectionId=${encodeURIComponent(connectionId)}`);
  }} />;
  return <div className="stack">{feature === 'edit' && <button className="button button-secondary" onClick={() => navigate(`/farmer/lots/${id}`)}>Xem chi tiết lô</button>}<LotEditorPanel onCompleteProfile={() => navigate('/farmer/profile')} authenticatedUserId={authenticatedUserId} lotId={feature === 'edit' ? id : undefined} onSavedLot={lotId => { if (feature === 'new') navigate(`/farmer/lots/${lotId}/edit`, { replace: true }); }} /></div>;
}
