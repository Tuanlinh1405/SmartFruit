import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { TradePage } from './TradePage';
import * as api from './api';

const { auth } = vi.hoisted(() => ({ auth: { session: { user: { id: 'farmer' } }, profile: { role: 'FARMER' } } }));
vi.mock('../auth/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('./api', () => ({ listConnections: vi.fn(), loadThread: vi.fn(), respondConnection: vi.fn(), sendMessage: vi.fn(), proposeOffer: vi.fn(), respondOffer: vi.fn(), completeAgreement: vi.fn(), loadReviews: vi.fn(), submitReview: vi.fn() }));
const connection: api.Connection = { id: 'chosen', lot_id: 'lot', lot_title: 'Lô Ri6', buy_request_id: 'request', buyer_id: 'buyer', farmer_id: 'farmer', initiated_by: 'buyer', status: 'ACCEPTED', created_at: '', updated_at: '', partnerName: 'Buyer' };
const agreement: api.Agreement = { id: 'agreement', connection_id: 'chosen', offer_id: 'offer', price_vnd_per_kg: 65000, quantity_kg: 1000, delivery_date: '2026-10-20', buyer_completed_at: null, farmer_completed_at: null, status: 'AGREED' };
function show(path = '/farmer/negotiations', view: 'invitations' | 'negotiations' | 'reviews' = 'negotiations') { return render(<MemoryRouter initialEntries={[path]}><TradePage view={view} /></MemoryRouter>); }
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.listConnections).mockResolvedValue([connection]);
  vi.mocked(api.loadThread).mockResolvedValue({ messages: [], offers: [], agreement: null });
  vi.mocked(api.loadReviews).mockResolvedValue({ reviews: [], agreements: [] });
});

test.each(['missing', ''])('an explicit unavailable ID never falls back to another accepted thread: %s', async id => {
  show(`/farmer/negotiations?connectionId=${id}`);
  expect(await screen.findByText('Không tìm thấy kết nối hoặc bạn không có quyền truy cập.')).toBeVisible();
  expect(api.loadThread).not.toHaveBeenCalled(); expect(screen.queryByLabelText('Tin nhắn')).not.toBeInTheDocument();
});
test.each(['PENDING', 'DECLINED', 'CANCELLED'] as const)('a %s connection cannot display a chat or another thread', async status => {
  vi.mocked(api.listConnections).mockResolvedValue([{ ...connection, status }, { ...connection, id: 'other' }]);
  show('/farmer/negotiations?connectionId=chosen');
  expect(await screen.findByRole('link', { name: 'Xem lời mời kết nối' })).toHaveAttribute('href', '/farmer/invitations?connectionId=chosen');
  expect(api.loadThread).not.toHaveBeenCalled();
});
test('without an ID, the existing default accepted conversation still opens', async () => {
  show(); expect(await screen.findByLabelText('Tin nhắn')).toBeVisible(); expect(api.loadThread).toHaveBeenCalledWith('chosen');
});
test('accepted invitation links to the canonical role conversation', async () => {
  show('/farmer/invitations', 'invitations');
  expect(await screen.findByRole('link', { name: 'Mở hội thoại →' })).toHaveAttribute('href', '/farmer/negotiations?connectionId=chosen');
});
test.each([['buyer', ['Đồng ý', 'Từ chối']], ['farmer', ['Hủy lời mời']]] as const)('invitation actions respect sender %s', async (initiated_by, actions) => {
  vi.mocked(api.listConnections).mockResolvedValue([{ ...connection, initiated_by, status: 'PENDING' }]);
  show('/farmer/invitations', 'invitations');
  for (const name of actions) expect(await screen.findByRole('button', { name })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Mở hội thoại →' })).not.toBeInTheDocument();
});
test('server rejection stays visible and leaves the invitation pending', async () => {
  vi.mocked(api.listConnections).mockResolvedValue([{ ...connection, status: 'PENDING' }]);
  vi.mocked(api.respondConnection).mockRejectedValue(new Error('Server từ chối'));
  show('/farmer/invitations', 'invitations'); await userEvent.click(await screen.findByRole('button', { name: 'Đồng ý' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Server từ chối');
  expect(screen.queryByRole('link', { name: 'Mở hội thoại →' })).not.toBeInTheDocument();
});
test('own offers can only be withdrawn and partner offers can be accepted or rejected', async () => {
  vi.mocked(api.loadThread).mockResolvedValue({ messages: [], agreement: null, offers: [{ id: 'offer', connection_id: 'chosen', proposed_by: 'farmer', price_vnd_per_kg: 65000, quantity_kg: 1000, delivery_date: '2026-10-20', status: 'PENDING', created_at: '' }] });
  const own = show(); expect(await screen.findByRole('button', { name: 'Rút đề nghị' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Đồng ý' })).not.toBeInTheDocument(); own.unmount();
  vi.mocked(api.loadThread).mockResolvedValue({ messages: [], agreement: null, offers: [{ id: 'offer', connection_id: 'chosen', proposed_by: 'buyer', price_vnd_per_kg: 65000, quantity_kg: 1000, delivery_date: '2026-10-20', status: 'PENDING', created_at: '' }] });
  show(); expect(await screen.findByRole('button', { name: 'Đồng ý' })).toBeVisible(); expect(screen.getByRole('button', { name: 'Từ chối' })).toBeVisible();
});
test('only completed agreements expose the review link', async () => {
  vi.mocked(api.loadThread).mockResolvedValue({ messages: [], offers: [], agreement });
  const pending = show(); await screen.findByText('Đã thống nhất'); expect(screen.queryByRole('link', { name: 'Đánh giá giao dịch' })).not.toBeInTheDocument(); pending.unmount();
  vi.mocked(api.loadThread).mockResolvedValue({ messages: [], offers: [], agreement: { ...agreement, status: 'COMPLETED', buyer_completed_at: 'done', farmer_completed_at: 'done' } });
  show(); expect(await screen.findByRole('link', { name: 'Đánh giá giao dịch' })).toHaveAttribute('href', '/farmer/reviews');
});
