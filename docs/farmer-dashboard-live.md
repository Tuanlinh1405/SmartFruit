# Tổng quan Farmer: OpenRouter, thời tiết và khu vực thu mua

Cập nhật 19/10/2026 cho mục đích demo/đồ án. Không migration hoặc thay RLS. `/farmer/dashboard` dùng component riêng; dashboard Carrier và các trang demo khác giữ nguyên.

## Hành vi đã triển khai

- Tổng quan có bản đồ Khu vực thu mua và Thời tiết tại vườn cạnh nhau trên desktop, xếp dọc khi hẹp. Bỏ các số đếm mẫu của Tổng quan Farmer; khối vận chuyển vẫn có nhãn Minh họa riêng.
- Thời tiết đọc tọa độ hồ sơ chính chủ; thiếu tọa độ thì chỉ tự dùng tỉnh khi xác định duy nhất ADM1 của Việt Nam khớp tên. Không GPS, không ghi ngược hồ sơ, không tự chọn kết quả đầu tiên.
- Người dùng có thể tìm/chọn một địa điểm tham khảo. Lựa chọn nằm trong state màn hình; F5 lấy lại vị trí hồ sơ. Không gửi địa chỉ cụ thể, tên vườn hoặc hồ sơ sang API ngoài.
- Dự báo Open-Meteo có nhiệt độ, độ ẩm, gió, khả năng mưa và ba ngày dự báo, timezone `Asia/Ho_Chi_Minh`. Cache dự báo trong memory 15 phút; cache geocoding trong browser 24 giờ. Không polling 5 giây. Lỗi khi làm mới giữ dữ liệu cũ với timestamp nếu có; không tạo dự báo mẫu.
- Bản đồ đọc các trường công khai của nhu cầu `OPEN` chưa hết hạn, phân trang 100 dòng, dừng ở 1.000 và báo rõ nếu còn dữ liệu. Gom theo `preferred_provinces`, khử trùng từng ID mỗi vùng; tổng không cộng trùng nhu cầu nhiều vùng.
- Không có tỉnh → nhóm Không giới hạn khu vực. Không dùng tỉnh trụ sở Buyer để thay thế. Không đổi địa danh cũ sang tỉnh mới. Vùng chưa định vị được vẫn ở danh sách.
- Leaflet + tiles OpenStreetMap qua HTTPS; marker là điểm đại diện tỉnh, không phải địa chỉ kho. Bấm marker mở thông tin; nút trong popup lọc danh sách. Có lọc loại quả/tỉnh và chế độ chỉ xem danh sách. Tiles lỗi không làm mất danh sách.
- Giữ attribution, không offline/prefetch. URL tiles có thể cấu hình bằng `VITE_MAP_TILE_URL`; khi đổi nhà cung cấp phải cập nhật attribution trong component cho đúng giấy phép.

## Chi tiết quan trọng về địa danh

Open-Meteo `/search?name=Tiền Giang` thực tế trả một điểm dân cư ở Hà Tĩnh; `/search?name=Đồng Nai` có thể trả huyện ở Lâm Đồng. Không dùng các kết quả này để tự đánh dấu tỉnh.

`province-ids.ts` chứa ID hành chính VN từ [GeoNames](https://download.geonames.org/export/dump/admin1CodesASCII.txt), đối chiếu ngày 19/10/2026. Dùng `/get?id=...` của Open-Meteo rồi kiểm tra lại `ADM1`, `country_code=VN` và tên chuẩn hóa trước khi tự đặt điểm. Danh mục chỉ là ID, không tự chế tọa độ. Tỉnh cũ không còn kết quả ADM1 hợp lệ sẽ ở danh sách chưa định vị; không ép ghép vào tỉnh mới. Tìm địa điểm thủ công có thể chọn kết quả điểm dân cư nhưng phải mang nhãn Địa điểm đại diện.

## Nguồn và giới hạn

- [Open-Meteo Free](https://open-meteo.com/en/pricing): phi thương mại, hiện 10.000 lượt/ngày, không SLA; cần gói phù hợp khi vận hành thương mại.
- [Geocoding](https://open-meteo.com/en/docs/geocoding-api): dữ liệu GeoNames; cache 24 giờ giảm số request.
- [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/): attribution hiển thị, giữ Referer và cache của trình duyệt, không quét tiles trong test.
- Khu vực chỉ để tham khảo, không thay thuật toán matching, không tính km và không đặt xe.
- `/farmer/weather` và `/farmer/map` vẫn là các màn minh họa cũ có nhãn. Bản tích hợp thật trong đợt này nằm tại Tổng quan.

## Kiểm tra tự động và cloud

Unit test bao phủ tên tỉnh, ADM1/địa danh trùng tên, cache, timezone, lỗi dự báo, gom nhóm, phân trang/cap và lỗi quyền. Playwright mock API và tiles, kiểm tra Tổng quan ở 1440/390/320px, filter/marker/list, F5, chọn địa điểm và lỗi nhà cung cấp. Các test mock không chứng minh dịch vụ bên ngoài đang sẵn sàng.

Kết quả chi tiết của đợt này xem [biên bản tích hợp](openrouter-dashboard-acceptance.md). Không tuyên bố đã deploy frontend/function khi mới chạy local.

## Tự kiểm tra sau deploy

1. Đăng nhập Farmer, mở Tổng quan; thời tiết theo tọa độ hồ sơ hoặc yêu cầu chọn địa điểm rõ ràng.
2. Đổi địa điểm tham khảo, xem ba ngày và giờ cập nhật; F5 trở về hồ sơ.
3. Tạo nhu cầu Buyer còn hạn có tỉnh hiện hành, mở Farmer để xem vùng; bấm marker và lọc tỉnh/loại quả.
4. Đóng nhu cầu ở Buyer, bấm Tải lại khu vực ở Farmer; nhu cầu biến mất.
5. Địa danh không khớp vẫn có trong danh sách, không có marker giả. Chặn request tiles trong DevTools để kiểm tra danh sách còn dùng được.
6. Mở Hỏi trợ lý, gửi câu mẫu, xem nguồn và requestId khi lỗi. Khi CORS lỗi kiểm tra origin deploy trong Supabase Secrets.
