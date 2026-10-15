import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FarmerProfilePanel } from './farmer/profile/farmer-profile-panel';
import { LotDetailPanel, LotEditorPanel, LotsListPanel } from './farmer/lots/lot-panels';
import { CarrierPanel } from './carrier/vehicles/carrier-panel';
import { FarmerMatchingPanel, type MatchScorer } from './farmer/matching/farmer-matching';

// B can mount this under its resolved FARMER/CARRIER guard. This does not create
// an Auth session, select a role, or register any public route itself.
export function AFeaturePage({ feature, authenticatedUserId, scorer, scoringVersion }: { feature: 'profile' | 'lots' | 'new' | 'edit' | 'detail' | 'vehicles' | 'matches'; authenticatedUserId: string; scorer?: MatchScorer; scoringVersion?: string }) {
  const navigate = useNavigate(); const { id } = useParams(); const [params] = useSearchParams();
  if (feature === 'profile') return <FarmerProfilePanel authenticatedUserId={authenticatedUserId} />;
  if (feature === 'vehicles') return <CarrierPanel authenticatedUserId={authenticatedUserId} />;
  if (feature === 'lots') return <LotsListPanel authenticatedUserId={authenticatedUserId} onCreate={() => navigate('/farmer/lots/new')} onOpen={lotId => navigate(`/farmer/lots/${lotId}`)} />;
  if (feature === 'detail') return <div className="stack"><LotDetailPanel authenticatedUserId={authenticatedUserId} lotId={id ?? ''} onEdit={lotId => navigate(`/farmer/lots/${lotId}/edit`)} onDeleted={() => navigate('/farmer/lots')} /><div className="row"><Link to={`/farmer/matches?lotId=${encodeURIComponent(id ?? '')}`}>Tìm người mua phù hợp</Link><Link to={`/farmer/transport?lotId=${encodeURIComponent(id ?? '')}`}>Tìm xe minh họa</Link></div></div>;
  if (feature === 'matches') return <FarmerMatchingPanel authenticatedUserId={authenticatedUserId} initialLotId={params.get('lotId') ?? ''} scorer={scorer} scoringVersion={scoringVersion} onConnect={(lotId, buyerId, demoDeal) => navigate(`/farmer/chat?lotId=${encodeURIComponent(lotId)}&partnerId=${encodeURIComponent(buyerId)}`, { state: { demoDeal } })} />;
  return <LotEditorPanel authenticatedUserId={authenticatedUserId} lotId={feature === 'edit' ? id : undefined} onSavedLot={lotId => { if (feature === 'new') navigate(`/farmer/lots/${lotId}/edit`, { replace: true }); }} />;
}
