const descriptions: Record<string, [string, string]> = {
  transport: ['Vận chuyển', 'Đặt xe, báo giá, định vị GPS và tracking chưa được triển khai. Tính năng sẽ được nối API nhà vận tải sau khi chọn nhà cung cấp.'],
  policy: ['Chính sách', 'Nội dung chính sách đang chờ đội dự án phê duyệt.'],
  settings: ['Cấu hình hệ thống', 'Các cấu hình vận hành, bảng giá và thanh toán chưa được triển khai.'],
  map: ['Bản đồ', 'Bản đồ, tọa độ và khoảng cách được hoãn. Địa chỉ/tỉnh/huyện vẫn lưu để tham khảo; matching hiện chỉ xét sản phẩm, giá và lượng.'],
  prices: ['Giá tham khảo', 'Chưa có nguồn giá thị trường được tích hợp. Giá chào của lô và khoảng giá thu mua vẫn sử dụng dữ liệu đã lưu.'],
  weather: ['Thời tiết & khuyến nghị', 'Chưa có API thời tiết hoặc dữ liệu khuyến nghị được tích hợp.'],
  tracking: ['Theo dõi chuyến', 'Chưa có đơn vận chuyển hoặc API GPS/tracking để theo dõi chuyến thật.'],
  'carrier-reviews': ['Đánh giá tài xế', 'Chưa có chuyến vận chuyển hoàn tất để thực hiện đánh giá tài xế.'],
  'farmer-lots': ['Đăng / sửa lô hàng', 'CRUD lô và upload ảnh nâng cao đang chờ Dev A hoàn thiện. Danh sách lô hiện có và việc tìm người mua vẫn đọc dữ liệu thật.'],
};
export function DeferredPage({ kind = 'transport' }: { kind?: string }) {
  const [title, description] = descriptions[kind] || descriptions.settings;
  return <><div className="page-heading"><div><span className="eyebrow">Lộ trình phát triển</span><h1>{title}</h1></div></div>
    <section className="panel narrow"><span className="status-pill">Chưa hỗ trợ</span><h2>{title}</h2><p>{description}</p>
      <p className="muted">Khi tính năng sẵn sàng, thông tin và thao tác sẽ xuất hiện tại đây.</p></section></>;
}
