import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import { ADemoProvider } from './demo-context';
import { CarrierRequests, CarrierTracking, DemoDashboard, DemoReviews, FarmerChat, FarmerMap, FarmerNotifications, FarmerPrices, FarmerTransport, FarmerWeather } from './demo-pages';
function show(children: React.ReactNode) { return render(<ADemoProvider><MemoryRouter>{children}</MemoryRouter></ADemoProvider>); }
test('transport validates before publishing a demo request and reset clears local fields', async () => {
  show(<FarmerTransport />); await userEvent.click(screen.getByRole('button', { name: 'Tìm xe minh họa' })); expect(screen.getByRole('alert')).toHaveTextContent('Nhập đủ');
  fireEvent.change(screen.getByLabelText(/Điểm nhận/), { target: { value: 'Vườn test' } });
  await userEvent.click(screen.getByRole('button', { name: 'Đặt lại minh họa' })); expect(screen.getByLabelText(/Điểm nhận/)).toHaveValue(''); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('quotation rejects insufficient data and accepted trip updates timeline/dashboard without real mutations', async () => {
  show(<><CarrierRequests /><CarrierTracking /><DemoDashboard role="CARRIER" /></>);
  await userEvent.click(screen.getByRole('button', { name: 'Chi tiết / báo giá' })); await userEvent.click(screen.getByRole('button', { name: 'Nhận chuyến minh họa' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Chọn xe đủ tải'); await userEvent.selectOptions(screen.getByLabelText('Chọn xe'), 'vehicle-demo-1'); await userEvent.click(screen.getByRole('button', { name: 'Nhận chuyến minh họa' }));
  await userEvent.selectOptions(screen.getByLabelText('Chọn yêu cầu theo dõi'), 'transport-demo-1'); expect(screen.getByText('Nhận chuyến minh họa · Đã đạt')).toBeVisible();
  const metric = screen.getByRole('heading', { name: 'Chuyến nhận mẫu' }).closest('section')!; expect(within(metric).getByText('1', { exact: true })).toBeVisible();
});
test('chat keeps local messages, rejects blank input and confirms only the chosen context', async () => {
  show(<FarmerChat />); await userEvent.click(screen.getByRole('button', { name: 'Vựa An Phú' })); await userEvent.click(screen.getByRole('button', { name: 'Gửi minh họa' })); expect(screen.getByRole('alert')).toHaveTextContent('nhập tin nhắn');
  fireEvent.change(screen.getByLabelText('Tin nhắn minh họa'), { target: { value: '  Lịch thu hoạch  ' } }); await userEvent.click(screen.getByRole('button', { name: 'Gửi minh họa' }));
  expect(screen.getByRole('region', { name: 'Tin nhắn' })).toHaveTextContent('Bạn: Lịch thu hoạch'); await userEvent.click(screen.getByRole('button', { name: 'Xác nhận đàm phán minh họa' })); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xác nhận minh họa' })); expect(screen.getByText('Đã xác nhận minh họa.')).toBeVisible();
});
test.each(['FARMER', 'CARRIER'] as const)('%s reviews empty/sent and star validation', async role => {
  show(<DemoReviews role={role} />); await userEvent.selectOptions(screen.getByLabelText('Nhóm đánh giá'), 'sent'); expect(screen.getByText('Chưa có đánh giá')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá minh họa' })); expect(screen.getByRole('alert')).toHaveTextContent('một đến năm');
  await userEvent.selectOptions(screen.getByLabelText('Số sao'), '4'); fireEvent.change(screen.getByLabelText('Nhận xét'), { target: { value: 'Đúng hẹn' } }); await userEvent.click(screen.getByRole('button', { name: 'Gửi đánh giá minh họa' })); expect(screen.getByText('Đúng hẹn')).toBeVisible();
});
test('reference prices and weather have meaningful no-data states', async () => {
  const view = show(<FarmerPrices />); await userEvent.selectOptions(screen.getByLabelText('Loại quả tham khảo'), 'Thanh long'); expect(screen.getByText('Chưa có giá minh họa')).toBeVisible(); view.unmount();
  show(<FarmerWeather />); await userEvent.selectOptions(screen.getByLabelText('Tỉnh xem thời tiết'), 'Đồng Tháp'); expect(screen.getByText('Chưa có dữ liệu minh họa tại khu vực')).toBeVisible();
});
test('map fallback, filtering and notifications preserve demo semantics', async () => {
  const view = show(<FarmerMap />); await userEvent.click(screen.getByRole('button', { name: 'Chỉ xem danh sách' })); expect(screen.queryByRole('img')).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('Khu vực'), 'Đồng Tháp'); expect(screen.getByText('Không có đối tác minh họa phù hợp')).toBeVisible(); view.unmount();
  show(<FarmerNotifications />); await userEvent.click(screen.getByRole('button', { name: 'Mở thông báo' })); expect(screen.getByRole('dialog')).toHaveTextContent('Kiểm tra lại khối lượng'); await userEvent.keyboard('{Escape}'); expect(screen.getByText('Đã xem · Minh họa')).toBeVisible(); expect(screen.getByText(/Chưa có nội dung chính sách chính thức/)).toBeVisible();
});
