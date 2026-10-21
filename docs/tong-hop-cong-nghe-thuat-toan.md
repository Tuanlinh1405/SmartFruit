# Công nghệ và thuật toán trong SmartFruit

Tài liệu giải thích dành cho người ít nền tảng kỹ thuật  
Cập nhật theo mã nguồn và biên bản bàn giao ngày 19 tháng 10 năm 2026

## 1 Dự án làm gì và công nghệ đóng vai trò gì

SmartFruit, được gọi là LogStar trong một số tài liệu, hỗ trợ kết nối nhà vườn, người mua và đơn vị vận tải. Nhà vườn đăng lô nông sản, người mua đăng nhu cầu, hai bên tìm đối tác rồi trao đổi và thống nhất điều kiện giao dịch. Đơn vị vận tải hiện quản lý hồ sơ và phương tiện; quản trị viên theo dõi và kiểm soát các nghiệp vụ được cấp quyền.

Ba phần công nghệ đáng chú ý nhất là hệ thống gợi ý đối tác, trợ lý hỏi đáp cho nhà vườn và cơ chế bảo vệ dữ liệu giao dịch. AI hỗ trợ tìm kiếm và giải thích thông tin. Giá, lượng hàng, quyền truy cập và việc chấp nhận thỏa thuận vẫn được kiểm tra bằng các quy tắc cụ thể.

### Một tình huống dễ hình dung

Người mua cần 5 tấn sầu riêng Ri6, giá mong muốn 60.000 đến 70.000 đồng mỗi kg, trong một khoảng ngày nhất định. Hệ thống tìm các lô có thể đáp ứng, ưu tiên mức khớp tên sản phẩm, sau đó kết hợp độ phù hợp về giá và lượng. Người mua gửi lời mời, nhà vườn đồng ý, hai bên nhắn tin và đề xuất điều kiện. Sau khi thống nhất, mỗi bên xác nhận hoàn tất; khi cả hai xác nhận thì mới mở đánh giá.

### Đọc nhanh toàn bộ hệ thống

| Thành phần | Cách hiểu đơn giản | Vai trò trong dự án |
| --- | --- | --- |
| Giao diện web | Quầy giao dịch trên trình duyệt | Nhập thông tin, tìm lô, chat và quản lý hồ sơ |
| Backend và cơ sở dữ liệu | Bộ phận xử lý và sổ lưu trữ chung | Lưu dữ liệu, kiểm tra quyền và quy trình |
| Matching | Bộ phận tìm đối tác phù hợp | So tên sản phẩm, điều kiện, giá và lượng |
| Trợ lý nhà vườn | Người hỗ trợ tra cứu tài liệu | Trả lời theo bộ kiến thức được cung cấp |
| Kiểm thử tự động | Các tình huống kiểm tra lặp lại | Phát hiện lỗi giao diện, thuật toán và quyền |

Các phần sau giải thích cơ chế, ví dụ và giới hạn thực tế. Nguồn đối chiếu được ghi ở cuối tài liệu để đội kỹ thuật có thể kiểm tra lại.

## 2 Những công nghệ được sử dụng

### Phần người dùng nhìn thấy

**React và TypeScript** được dùng để xây giao diện. React chia màn hình thành các phần có thể tái sử dụng như biểu mẫu, danh sách lô và hộp chat. TypeScript giúp lập trình viên phát hiện nhiều lỗi dùng sai kiểu dữ liệu trước khi chạy ứng dụng.

**Vite** hỗ trợ chạy dự án khi phát triển và đóng gói ứng dụng để triển khai. **React Router** điều hướng giữa các trang, kết hợp kiểm tra phiên đăng nhập và vai trò. **TanStack React Query** hỗ trợ lấy dữ liệu, giữ kết quả tạm và cập nhật lại sau thao tác ở các khu vực dùng thư viện này.

**Tailwind CSS và CSS riêng** tạo bố cục, màu sắc và cách hiển thị trên màn hình lớn hoặc điện thoại. **Radix UI Dialog** hỗ trợ hộp thoại, **Lucide React** cung cấp biểu tượng. Các công nghệ này phục vụ trải nghiệm sử dụng, không quyết định thứ hạng matching.

### Phần xử lý và lưu trữ

**Supabase** cung cấp đăng nhập, lưu trữ ảnh, API dữ liệu và các hàm xử lý phía máy chủ. **PostgreSQL** là cơ sở dữ liệu quan hệ, có thể hình dung như nhiều sổ có liên kết: tài khoản, lô hàng, nhu cầu, hội thoại và thỏa thuận.

**Supabase Edge Functions chạy trên Deno** xử lý các yêu cầu như tìm kiếm matching, gọi AI và xử lý lô công việc tạo vector. **SQL và RPC** đưa những thao tác cần kiểm tra chặt chẽ vào cơ sở dữ liệu. RPC có thể hiểu là gọi một nghiệp vụ đã được định nghĩa sẵn, chẳng hạn chấp nhận đề nghị.

### Phần AI và tìm kiếm

**Multilingual E5 base** chuyển tên hoặc mô tả sản phẩm thành vector để tìm nội dung gần nhau. **pgvector** giúp PostgreSQL lưu và so sánh các vector này. **Python và Sentence Transformers** thực thi mô hình E5 có sẵn; dự án không huấn luyện E5 từ đầu.

Mã nguồn có đường phục vụ E5 bằng **Gradio trên Hugging Face Spaces với ZeroGPU**, cùng worker qua Edge Function. Ngoài ra còn có phương án dịch vụ Python bằng **FastAPI, Uvicorn, psycopg và Docker Compose**. Đây là các đường chạy có trong dự án; sự hiện diện của mã không có nghĩa mọi phương án đều đang được vận hành cùng lúc.

**Gemini**, với model mặc định trong mã là **gemini 3.1 flash lite**, tạo câu trả lời cho trợ lý nhà vườn. Khóa gọi AI được giữ phía máy chủ.

## 3 Thuật toán tìm và xếp hạng đối tác

### Bước đầu tiên là kiểm tra điều kiện

Trước khi chấm điểm, hệ thống kiểm tra loại nông sản; giống nếu nhu cầu đã chỉ định; thời gian thu hoạch có giao với thời gian cần hàng; trạng thái lô và nhu cầu; dữ liệu giá và lượng có hợp lệ; lượng tối thiểu và yêu cầu đáp ứng đủ trong một lô. Lô chưa công bố hoặc sai giống đã chọn sẽ không trở thành kết quả phù hợp chỉ vì giá rẻ.

Giá nằm ngoài khoảng mong muốn vẫn có thể được giữ để thương lượng, nhưng nhận điểm giá thấp hơn. Khi cho phép mua một phần, lô nhỏ hơn lượng mục tiêu vẫn có thể được gợi ý nếu đạt lượng tối thiểu. Hệ thống cho biết lô đóng góp được bao nhiêu và còn thiếu bao nhiêu; chưa tự gom nhiều lô thành một đơn hàng.

### Luồng kết hợp AI cho người mua

1. Lấy từ khóa tìm kiếm, hoặc tên nhu cầu kết hợp tên loại và giống từ danh mục.
2. E5 chuyển nội dung đó thành vector, tức một dãy 768 số biểu diễn đặc trưng của văn bản. Giá, lượng và địa chỉ không được ghép vào câu truy vấn mặc định.
3. pgvector so độ gần bằng cosine và lấy tối đa 20 lô trong nhóm đủ điều kiện. Vector phải đúng phiên bản mô hình và khớp nội dung hiện tại.
4. Đọc lại bản ghi, kiểm tra lại điều kiện rồi xếp lại chính nhóm ứng viên đó bằng tên sản phẩm, giá và lượng.
5. Chia kết quả thành các trang để hiển thị.

**Cosine** đo mức gần nhau giữa hai vector. Có thể hình dung mỗi tên sản phẩm được đặt lên một bản đồ khái niệm; các điểm gần nhau có thể liên quan về nghĩa. Độ gần này không bảo đảm đúng giống, vì vậy dự án có bước so tên và điều kiện bổ sung.

### Vì sao chỉ có tối đa 20 ứng viên

Top 20 giúp giới hạn lượng kết quả cần xử lý tiếp. Nếu một số ứng viên bị loại sau khi đọc lại dữ liệu, hệ thống không lấy ứng viên thứ 21 để bù. Vì vậy danh sách có thể ngắn hoặc rỗng dù còn những tin khác trong cơ sở dữ liệu.

### Luồng đang dùng ở phía nhà vườn

Màn hình matching nhà vườn dùng bộ chấm điểm theo quy tắc chung để tìm nhu cầu đang mở. Theo biên bản ngày 19/10, Buyer đã được kiểm tra E5 hybrid trên backend thật; màn hình Farmer vẫn dùng rule only. Không thể suy ra hai màn hình đều đang dùng E5 chỉ vì cùng có chức năng gợi ý.

## 4 Kỹ thuật xử lý tên sản phẩm

### Chuẩn hóa tiếng Việt

Hệ thống chuyển chữ về dạng thống nhất: chữ thường, bỏ dấu để so sánh, quy đổi đ thành d và xử lý khoảng trắng. Ví dụ, “SẦU RIÊNG” và “sau rieng” có thể được so trên cùng dạng chữ. Bước tách từ bỏ bớt các từ giao dịch và lượng có đơn vị như “cần mua”, “kg”, “tấn”. Tên loại và giống chuẩn được lấy từ danh mục dữ liệu.

### Khớp chính xác và khớp gần đúng

Tên được so theo các từ đầy đủ. Hệ thống phân biệt nhóm khớp toàn bộ từ khóa, gần khớp toàn bộ, khớp một phần và chưa khớp. Một kết quả có đủ từ khóa không nhất thiết có tiêu đề giống nguyên câu người tìm, vì tiêu đề có thể thêm thông tin khác.

Để xử lý lỗi gõ nhỏ, mã dùng **khoảng cách chỉnh sửa Optimal String Alignment**. Thuật toán đếm số lần thêm, xóa, thay một ký tự hoặc đổi chỗ hai ký tự liền nhau để biến từ này thành từ kia. Từ có độ dài ngắn hơn trong cặp so sánh từ 4 đến 6 ký tự được cho tối đa một sửa; từ từ 7 ký tự được cho tối đa hai sửa, đồng thời độ giống phải đạt ít nhất 0,75.

Các từ dưới 4 ký tự và mã giống có số chỉ được khớp chính xác. Ví dụ, Ri6 không được tự sửa thành Ri7 hoặc RD6; 034 không được tự đổi thành 036. Cách bảo vệ này giúp tránh xem nhầm hai mã giống là lỗi chính tả.

### Nhận diện yêu cầu loại trừ

Một số cụm như “không lấy”, “không phải”, “ngoại trừ” và “trừ” được nhận diện để loại sản phẩm không mong muốn. Ví dụ “xoài cát Chu không lấy cát Hòa Lộc” có thể loại ứng viên Hòa Lộc trong nhóm đã tìm thấy. Bộ xử lý này có giới hạn theo mẫu câu, chưa hiểu mọi cách phủ định hoặc lựa chọn trong tiếng Việt.

### Thứ tự ưu tiên khi xếp lại

Nhóm khớp đầy đủ từ khóa đứng trước nhóm gần khớp, rồi nhóm khớp một phần và nhóm chưa khớp. Trong cùng nhóm, độ phủ và độ gần tên được xét trước điểm kết hợp. Nếu vẫn bằng nhau, mã định danh được dùng để giữ thứ tự ổn định.

Vì vậy, giá hấp dẫn không tự đẩy một tên chỉ khớp một phần lên trên tên khớp toàn bộ. Các tên gọi khác xa nhau về mặt chữ cần dữ liệu tên đồng nghĩa đã xác nhận hoặc tín hiệu từ E5; fuzzy matching không tự xác nhận chúng là cùng giống.

## 5 Cách tính điểm giá và khối lượng

### Điểm giá

Giá nằm trong khoảng mong muốn nhận điểm giá tối đa. Ra ngoài khoảng này thì điểm giảm dần theo độ lệch; khi lệch đến 20% của cận tương ứng, thành phần điểm giá về 0. Cận tương ứng là cận dưới nếu giá thấp hơn khoảng và cận trên nếu giá cao hơn khoảng. Điểm dùng giá chào công khai, không lấy giá sàn riêng của nhà vườn.

Ví dụ, khoảng mong muốn là 60.000 đến 70.000 đồng mỗi kg. Giá 65.000 nhận 100% thành phần điểm giá. Giá 77.000 cao hơn cận trên 10%, nhận 50%. Giá 84.000 cao hơn 20%, nhận 0%. Đây là cách tính độ phù hợp với khoảng khai báo, không phải thuật toán xác định giá thị trường.

### Điểm khối lượng

Điểm lượng là tỷ lệ lượng lô so với lượng cần mua, tối đa 100%. Cần 5 tấn thì lô 3 tấn đạt 60%, lô 5 tấn hoặc hơn đạt 100%. Nếu người mua bắt buộc một lô đáp ứng đủ, lô 3 tấn bị loại ở bước điều kiện, không đi tiếp để chấm điểm.

### Điểm kết hợp

Ở chế độ theo quy tắc, giá và lượng có trọng số 40 và 35, được chuẩn hóa về thang 100. Tỷ trọng sau chuẩn hóa tương đương khoảng 53,3% cho giá và 46,7% cho lượng.

Ở chế độ hybrid, cosine, giá và lượng có trọng số 45, 25 và 20, được chuẩn hóa về thang 100. Tỷ trọng tương đương 50% cho cosine, 27,8% cho giá và 22,2% cho lượng. Cosine được giới hạn trong khoảng 0 đến 1 khi đưa vào điểm kết hợp.

### Ví dụ minh họa

Giả sử các lô đều qua điều kiện và thuộc cùng mức khớp tên. Người mua cần 5 tấn, giá 60.000 đến 70.000 đồng mỗi kg.

| Lô minh họa | Giá mỗi kg | Lượng | Điểm theo quy tắc |
| --- | --- | --- | --- |
| A | 65.000 đồng | 5 tấn | 100,0 |
| B | 77.000 đồng | 5 tấn | 73,3 |
| C | 65.000 đồng | 3 tấn | 81,3 |

Lô C chỉ được xét khi chấp nhận mua một phần và đạt lượng tối thiểu. Các con số là ví dụ tính toán, không phải dữ liệu giao dịch thật. Điểm là công cụ sắp xếp; 90 điểm không có nghĩa có 90% khả năng giao dịch thành công. Danh sách cuối cũng có thể không giảm đều theo điểm vì mức khớp tên được ưu tiên trước.

## 6 Trợ lý nhà vườn dùng AI như thế nào

### Hỏi đáp dựa trên bộ kiến thức được cung cấp

Trợ lý dùng Gemini để diễn đạt câu trả lời từ bộ kiến thức phía máy chủ. Bộ dữ liệu hiện có 27 mục, gồm 14 mục bệnh và 13 mục phân loại, cho sầu riêng, mít và thanh long. Dữ liệu được biên tập từ bảng tổng hợp do khách hàng cung cấp, có mã nguồn và phiên bản để đối chiếu.

Quy trình gồm xác thực người hỏi có vai trò Farmer; nhận loại cây, chủ đề, giai đoạn và câu hỏi; lọc kiến thức theo cây và chủ đề; gửi nội dung liên quan cùng câu hỏi sang Gemini; kiểm tra câu trả lời và mã nguồn; cuối cùng hiển thị nội dung cùng nguồn cho người dùng.

Đây là kỹ thuật đưa tài liệu tham chiếu vào ngữ cảnh cho mô hình. Phần chatbot hiện lọc tài liệu bằng trường dữ liệu, không dùng kho vector hoặc thuật toán E5 để lấy kiến thức. Tìm đối tác và hỏi đáp dùng hai cơ chế khác nhau.

### Kiểm soát đầu vào và đầu ra

Câu hỏi giới hạn tối đa 1.500 đơn vị ký tự theo cách đếm của giao diện. Backend chỉ nhận các trường đã định nghĩa, không cho người dùng gửi thêm lịch sử, model hoặc bộ kiến thức tùy ý. Mỗi lần hỏi gửi một yêu cầu độc lập; mô hình không được nhận toàn bộ hội thoại trước đó.

Gemini được yêu cầu trả dữ liệu có cấu trúc gồm câu trả lời, mã nguồn và tối đa hai câu hỏi làm rõ. Backend kiểm tra cấu trúc, trạng thái phản hồi và việc mã nguồn có thuộc tập đã gửi hay không. Tên và đường dẫn nguồn được lấy từ dữ liệu backend. Giao diện hiển thị văn bản thuần để nội dung AI không được thực thi như mã HTML.

Nếu hết hạn mức, quá thời gian hoặc đầu ra không hợp lệ, hệ thống hiển thị lỗi thật. Không tạo câu trả lời giả để che lỗi. Mã yêu cầu và các thông tin kỹ thuật hạn chế được dùng để chẩn đoán; khóa và token không được đưa vào phản hồi.

### Giới hạn cần hiểu

Trợ lý không nhận ảnh, không chẩn đoán bệnh chắc chắn, không đưa thuốc hoặc liều lượng, không tự lấy giá hay thời tiết trực tiếp và không cấp chứng nhận xuất khẩu. Việc kiểm tra cấu trúc và mã nguồn không chứng minh mọi câu trả lời đúng về nông học. Nội dung nền cần được chuyên gia đối soát trước khi áp dụng thực tế.

Khung chat giữ nội dung khi đóng mở hoặc chuyển trang trong cùng phiên giao diện; tải lại trang hoặc đổi người dùng sẽ xóa nội dung này. Việc giữ nội dung trên màn hình không có nghĩa mô hình có trí nhớ hội thoại.

## 7 Kỹ thuật bảo vệ dữ liệu và giao dịch

### Xác thực và phân quyền nhiều lớp

Supabase Auth xử lý đăng nhập và phiên làm việc. JWT có thể hiểu như vé xác nhận danh tính trong các yêu cầu gửi lên server. Hệ thống có các vai trò Buyer, Farmer, Carrier và Admin. Đăng ký email có bước xác nhận; SMS OTP chưa triển khai.

**Row Level Security hay RLS** đặt quy tắc truy cập trên từng dòng dữ liệu ở cơ sở dữ liệu. Ví dụ, người dùng không được sửa lô của người khác chỉ bằng cách thay mã lô trong yêu cầu. Kiểm tra ở server và database là cần thiết vì việc ẩn nút trên giao diện không đủ bảo vệ dữ liệu.

Ảnh nằm trong vùng lưu trữ riêng tư. **Signed URL** là đường dẫn truy cập có thời hạn được cấp khi đủ quyền. Các trường nhạy cảm như giá sàn và ghi chú riêng không được trả cho Buyer; Admin dùng API giới hạn và không có quyền mặc định đọc chat riêng hay giá sàn.

### Quy trình giao dịch có trạng thái

Hệ thống kiểm tra từng bước: gửi kết nối, chấp nhận, chat, đưa đề nghị, phản hồi đề nghị, lập thỏa thuận, xác nhận hoàn tất và đánh giá. Chỉ người nhận được chấp nhận đề nghị. Các trường hợp tự chấp nhận, đánh giá sớm hoặc đánh giá trùng được chặn phía server.

**Transaction** giúp những thay đổi liên quan được xử lý cùng nhau. **Snapshot** giữ bản điều kiện tại thời điểm thỏa thuận để lịch sử không phụ thuộc hoàn toàn vào nội dung tin đã sửa sau đó. Chỉ khi hai bên đều xác nhận hoàn tất mới mở đánh giá, mỗi bên một lần cho mỗi thỏa thuận.

Thỏa thuận hiện không tự giữ hàng, trừ tồn kho hoặc tạo thanh toán. Xác nhận hoàn tất là thao tác của hai bên; hệ thống chưa tự xác minh hàng đã giao ngoài thực tế.

### Cập nhật và xử lý nền

Chat dùng **polling**, tức hỏi lại server mỗi 5 giây, và hiển thị 100 tin mới nhất. Đây là cơ chế cập nhật định kỳ; chưa có giao diện đọc toàn bộ lịch sử cũ, thông báo đẩy hoặc xác nhận đã đọc.

Việc tạo vector có hàng đợi và worker xử lý theo lô. Mã kiểm tra phiên bản model và dấu vân tay nội dung để tránh dùng vector cũ sau khi tin được sửa. Cơ chế khóa hoặc thuê công việc hạn chế xử lý chồng nhau; khi lỗi có thử lại với khoảng chờ tăng dần. Bộ nhớ đệm truy vấn và gộp yêu cầu trùng giúp giảm số lần gọi model. Tin mới không được cam kết có vector tức thời.

## 8 Trạng thái triển khai và mức độ kiểm chứng

### Phần có bằng chứng hoạt động

Biên bản bàn giao ngày 19/10/2026 ghi nhận frontend chạy local kết nối Supabase cloud thật, bốn vai trò và giao dịch hai chiều đã được kiểm tra. Farmer quản lý lô và ảnh, Buyer quản lý nhu cầu, Carrier quản lý hồ sơ và xe. Backend matching Buyer đã trả chế độ hybrid với model E5 base và phạm vi vector top 20. Trợ lý Farmer đã trả câu trả lời kèm bốn nguồn trong lượt kiểm tra backend thật.

Màn hình matching Farmer vẫn dùng rule only. Việc bật hybrid phía Buyer phụ thuộc cấu hình frontend; một lượt kiểm tra backend thành công không bảo đảm mọi bản frontend đều bật cùng chế độ. Lượt nghiệm thu chưa bao gồm một URL frontend production đã triển khai.

### Các phần chưa thuộc khả năng đã hoàn thiện

| Hạng mục | Trạng thái cần trình bày đúng |
| --- | --- |
| Khoảng cách và bản đồ trong matching | Chưa dùng để lọc hoặc cộng điểm; địa chỉ vẫn lưu để tham khảo |
| Graph matching và RRF | Có dấu vết thiết kế và mã cũ; luồng hiện hành không gộp ứng viên graph và từ khóa vào top 20 |
| Qwen và E5 small | Từng được khảo sát; model dùng cho luồng hiện hành là E5 base |
| Đặt xe và báo giá vận chuyển tự động | Chưa tích hợp nghiệp vụ vận chuyển thực |
| GPS và nhiệt độ từ thiết bị | Chưa có tích hợp dữ liệu thiết bị thật |
| Thanh toán và đối soát | Chưa triển khai |
| Giá và thời tiết trực tiếp | Không có nguồn trực tiếp trong trợ lý; một số màn hình là minh họa |

### Kiểm thử đã ghi nhận

Biên bản ngày 19/10 ghi nhận 349 unit test và 165 Playwright test đạt, cùng các nhóm kiểm tra PostgreSQL, pgvector, worker và API. TypeScript và production build cũng đạt. Đây là kết quả đã được ghi trong biên bản, không phải một lượt chạy lại khi lập tài liệu này. Kiểm thử có mock và kiểm tra backend thật được ghi tách biệt; không cộng chúng thành một số ca cloud duy nhất.

Một phép thử E5 base bằng model thật trên bộ nhỏ có 31 tên sản phẩm ghi nhận đúng kết quả đầu tiên ở 147 trên 155 truy vấn có nhãn, khoảng 94,8%. Đây là dữ liệu tổng hợp, chưa có bộ kiểm chứng độc lập và không phải cam kết độ chính xác thực tế. Benchmark cũng cho thấy cosine có thể hiểu sai câu phủ định, là lý do cần thêm bước xử lý tên và loại trừ.

Quy mô dữ liệu lớn, phân trang server, lịch sử chat dài và chất lượng trả lời nông học vẫn cần được đánh giá thêm trước khi mở rộng vận hành.

## 9 Thuật ngữ và nguồn đối chiếu

### Các thuật ngữ thường gặp

| Thuật ngữ | Diễn giải ngắn |
| --- | --- |
| Thuật toán | Các bước xử lý để đưa ra kết quả |
| API | Cách các phần mềm gửi yêu cầu và nhận kết quả |
| Frontend | Phần ứng dụng hiển thị trong trình duyệt |
| Backend | Phần máy chủ xử lý và kiểm soát dữ liệu |
| Embedding hoặc vector | Dãy số biểu diễn đặc trưng nội dung |
| Cosine similarity | Thước đo độ gần nhau giữa hai vector |
| Rerank | Xếp lại các kết quả đã tìm được |
| Rule only | Xếp hạng theo quy tắc, không dùng điểm vector |
| Hybrid | Kết hợp tìm kiếm vector và quy tắc nghiệp vụ |
| Fallback hoặc degraded | Chế độ dự phòng khi luồng AI không sẵn sàng |
| Cache | Giữ kết quả tạm để hạn chế tính hoặc tải lại |
| Worker | Tiến trình xử lý công việc ở phía sau |
| Content hash | Dấu vân tay giúp nhận biết nội dung đã đổi |
| Migration | Tập thay đổi có phiên bản cho cơ sở dữ liệu |

### Tài liệu và mã nguồn trong dự án

Các đường dẫn dưới đây tính từ thư mục gốc SmartFruit. Biên bản ngày 19/10 là căn cứ trạng thái mới hơn các ghi chú chưa deploy trong tài liệu ngày 15/10.

- `docs/handover-acceptance-2026-10-19.md`: kết quả bàn giao, kiểm tra cloud và giới hạn.
- `package.json`: công nghệ giao diện, công cụ build và kiểm thử.
- `src/features/matching/core.ts`: điều kiện, công thức và thứ tự xếp hạng.
- `src/features/matching/name-match.ts`: chuẩn hóa, khớp từ, khoảng cách chỉnh sửa và loại trừ.
- `src/features/matching/search-service.ts` và `supabase/migrations/202610150003_vector_top20.sql`: truy hồi top 20 và kiểm tra lại dữ liệu.
- `src/features/farmer/matching/shared-scorer.ts`: chế độ rule only trên màn hình Farmer.
- `services/embedding/model.py`, `services/embedding/space/app.py` và `src/features/matching/embedding-worker.ts`: E5 và xử lý vector.
- `supabase/functions/farmer-chat/service.ts` và `docs/farmer-chatbot.md`: bộ kiến thức, gọi Gemini và kiểm tra phản hồi.
- `docs/implementation-status.md` và `src/features/trading/TradePage.tsx`: nghiệp vụ, quyền và cơ chế cập nhật chat.
- `docs/benchmarks/e5-varieties-2026-10-15/README.md`: kết quả thử nghiệm E5 và giới hạn của số liệu.
