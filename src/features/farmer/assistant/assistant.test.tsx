import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link, Route, Routes } from 'react-router-dom';
import { expect, test, vi } from 'vitest';
import { FarmerAssistantProvider } from './assistant-context';
import { FarmerAssistantEntry, FarmerAssistantPanel } from './farmer-assistant';
import { ADemoProvider, useADemo } from '../../a-demo/demo-context';
import { AssistantRequestError, type askFarmer } from './api';
import { type FarmerChatResponse } from './contract';

const answer: FarmerChatResponse = { answer: 'Nội dung tham khảo <script>bad()</script>.', sources: [{ id: 'd1', title: 'Bảng tham khảo', url: 'https://drive.google.com/file/d/example' }], followUpQuestions: ['Cây ở giai đoạn nào?'], requestId: 'r1' };
function ResetDemo() { const { reset } = useADemo(); return <button onClick={reset}>Reset demo</button>; }
function show(sendRequest: typeof askFarmer = vi.fn(async () => answer), identity = 'farmer1', path = '/farmer/dashboard') {
  const tree = (key: string) => <MemoryRouter initialEntries={[path]}><FarmerAssistantProvider key={key} sendRequest={sendRequest}>
    <ADemoProvider><Routes><Route path="/farmer/dashboard" element={<><FarmerAssistantEntry /><ResetDemo /><Link to="/farmer/lots">Lots</Link></>} /><Route path="/farmer/lots" element={<Link to="/farmer/dashboard">Dashboard</Link>} /></Routes></ADemoProvider>
    <FarmerAssistantPanel enabled />
  </FarmerAssistantProvider></MemoryRouter>;
  const view = render(tree(identity)); return { ...view, changeIdentity: (id: string) => view.rerender(tree(id)), sendRequest };
}
async function open() { await userEvent.click(screen.getByRole('button', { name: 'Hỏi trợ lý' })); }
async function submit(question = 'Câu hỏi mẫu') { fireEvent.change(screen.getByLabelText('Câu hỏi cho trợ lý'), { target: { value: question } }); await userEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' })); }

test('trailing slash on a refreshed dashboard still allows opening the assistant', async () => {
  show(undefined, 'farmer1', '/farmer/dashboard/?from=refresh');
  await open();
  expect(await screen.findByRole('dialog', { name: 'Trợ lý nhà vườn' })).toBeVisible();
  await submit();
  expect(await screen.findByText(answer.answer)).toBeVisible();
});

test('suggestions only fill composer; source and model text render safely; supplement restores original context', async () => {
  const send = vi.fn<typeof askFarmer>(async () => answer); show(send); await open();
  expect(screen.getByText(/Không nhập thông tin cá nhân/)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Dấu hiệu bệnh thường gặp' }));
  expect(screen.getByLabelText('Câu hỏi cho trợ lý')).not.toHaveValue(''); expect(send).not.toHaveBeenCalled();
  await submit(); await screen.findByText(answer.answer);
  expect(document.querySelector('script')).toBeNull(); expect(screen.getByRole('link', { name: 'Bảng tham khảo' })).toHaveAttribute('href', 'https://drive.google.com/file/d/example');
  await userEvent.selectOptions(screen.getByLabelText('Cây trồng'), 'JACKFRUIT');
  await userEvent.click(screen.getByRole('button', { name: 'Bổ sung câu hỏi' }));
  expect(screen.getByLabelText('Câu hỏi cho trợ lý')).toHaveValue('Câu hỏi mẫu'); expect(screen.getByLabelText('Cây trồng')).toHaveValue('DURIAN'); expect(screen.getByLabelText('Câu hỏi cho trợ lý')).toHaveFocus();
});
test('one pending request cannot be duplicated; errors retain question; manual retry sends a stateless payload', async () => {
  let reject!: (reason: unknown) => void;
  const send = vi.fn<typeof askFarmer>().mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; })).mockResolvedValue(answer);
  show(send); await open(); await submit();
  expect(screen.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled(); expect(screen.getByText('Trợ lý đang trả lời…')).toBeVisible();
  fireEvent.submit(screen.getByRole('button', { name: 'Gửi câu hỏi' }).closest('form')!); expect(send).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new AssistantRequestError('Hết quota', 'QUOTA_EXCEEDED')); });
  expect(screen.getByRole('alert')).toHaveTextContent('Đã chạm hạn mức'); expect(screen.getByLabelText('Câu hỏi cho trợ lý')).toHaveValue('Câu hỏi mẫu');
  await userEvent.click(screen.getByRole('button', { name: 'Gửi câu hỏi' })); await screen.findByText(answer.answer);
  expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[1][0]).toEqual({ crop: 'DURIAN', topic: 'DISEASE', growthStage: 'UNKNOWN', question: 'Câu hỏi mẫu' });
});
test('close/reopen, navigation and demo reset preserve transcript; clear erases it', async () => {
  show(); await open(); await submit(); await screen.findByText(answer.answer);
  await userEvent.keyboard('{Escape}'); expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('button', { name: 'Hỏi trợ lý' })).toHaveFocus();
  await userEvent.click(screen.getByRole('button', { name: 'Reset demo' })); await open(); expect(screen.getByText(answer.answer)).toBeVisible();
  await userEvent.keyboard('{Escape}'); await userEvent.click(screen.getByRole('link', { name: 'Lots' })); expect(screen.queryByRole('dialog')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: 'Dashboard' })); await open(); expect(screen.getByText(answer.answer)).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' })); expect(screen.queryByText(answer.answer)).toBeNull(); expect(screen.getByText('Bạn muốn tìm hiểu điều gì?')).toBeVisible();
});
test('identity change aborts pending request and ignores late response', async () => {
  let resolve!: (value: FarmerChatResponse) => void;
  const send = vi.fn<typeof askFarmer>(() => new Promise(done => { resolve = done; })); const view = show(send);
  await open(); await submit(); const signal = send.mock.calls[0][1]; view.changeIdentity('farmer2'); expect(signal.aborted).toBe(true);
  await act(async () => { resolve(answer); }); await open(); expect(screen.queryByText(answer.answer)).toBeNull(); expect(screen.getByLabelText('Câu hỏi cho trợ lý')).toHaveValue('');
});
test('clear during pending request ignores its eventual response', async () => {
  let resolve!: (value: FarmerChatResponse) => void;
  const send = vi.fn<typeof askFarmer>(() => new Promise(done => { resolve = done; })); show(send); await open(); await submit();
  await userEvent.click(screen.getByRole('button', { name: 'Xóa cuộc trò chuyện' })); expect(send.mock.calls[0][1].aborted).toBe(true);
  await act(async () => { resolve(answer); }); expect(screen.queryByText(answer.answer)).toBeNull();
});
test('leaving dashboard closes an open panel and blocks reopening off-dashboard', async () => {
  show(); await open(); await userEvent.keyboard('{Escape}'); await userEvent.click(screen.getByRole('link', { name: 'Lots' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
