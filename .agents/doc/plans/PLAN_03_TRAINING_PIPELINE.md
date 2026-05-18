# Phần 3: Ý tưởng Phân chia Dữ liệu & Pipeline Fine-tuning

## 1. Giải pháp Chia Tập Dữ Liệu Tối Ưu (Stratified Split)
Do tính chất đặc thù của dự án là **chỉ có 1 sản phẩm (1 class) trên mỗi bức ảnh**, việc phân mảnh dữ liệu trở nên đơn giản và tối ưu hơn rất nhiều. Hệ thống áp dụng tỷ lệ chuẩn: **70% Train - 20% Val - 10% Test**.

- **Sử dụng Scikit-Learn:** Hệ thống không cần dùng các thuật toán Multilabel phức tạp. Chỉ cần gọi hàm `train_test_split(..., stratify=labels)` tiêu chuẩn của thư viện `scikit-learn` là đủ để bảo vệ sự cân bằng. Hàm này đảm bảo tự động bốc chính xác tỷ lệ 70-20-10 cho TỪNG class một. Không một sản phẩm nào bị bỏ sót ở tập đánh giá.

### Bẫy lỗi & Giải pháp Xử lý "Kho Ảnh Trống" (Background Images)
Ảnh trống (băng chuyền chạy không) **không có nhãn (nhãn rỗng)**. Nếu gộp chung ảnh trống vào rổ dữ liệu có nhãn rồi gọi hàm `stratify=labels`, thuật toán sẽ lập tức báo lỗi hoặc bị sai lệch (coi Trống là một class).
- **Giải pháp (Chia tách Độc lập):**
  1. Lấy rổ "Ảnh Có Nhãn" (Ảnh Mới + Ảnh Cũ) $\rightarrow$ Chạy `train_test_split(stratify=labels)` chia 70-20-10 riêng.
  2. Lấy rổ "Ảnh Trống" $\rightarrow$ Chạy cắt tỷ lệ 70-20-10 một cách độc lập.
  3. Sau khi chia xong 2 mảng, hệ thống mới Copy và gộp chung chúng lại vào các thư mục vật lý `train/`, `val/`, `test/` chuẩn YOLO.

## 2. Công Thức Trộn Dữ Liệu Chuẩn (Standard Mixing Baseline)
Để hệ thống có thể chạy tự động mà không cần can thiệp thủ công, chúng ta thiết lập một **Công thức Toán học Mức Chuẩn** để quyết định số lượng ảnh cũ được rút ra. Gọi $N$ là số lượng ảnh mới từ Project, và $K$ là tổng số Class cũ.

- **Công thức tính Hạn mức (Quota) cho MỖI Class Đang Hoạt Động (`is_active=True`):**
  `Quota = MAX( (N * 0.25) / K , 50 )`
  - *Diễn giải:* Tính 20% trên tổng dữ liệu chia đều cho số class đang hoạt động $K$. Nếu con số này **nhỏ hơn 50**, hệ thống kích hoạt mức chuẩn an toàn là **50 ảnh / 1 class cũ**.
- **Xử lý Class Ngừng Sản Xuất (`is_active=False`):** Hệ thống sẽ **bỏ qua hoàn toàn** (không rút ảnh, không đưa tên vào `data.yaml`). Khi YOLO nạp model cũ và phát hiện tên class bị đổi/mất, nó sẽ tự động kích hoạt cơ chế an toàn: **chặt bỏ Head phân loại cũ và tạo Head mới** để tránh lỗi xô lệch ID (Class Index Shift). Nhờ lượng ảnh Golden của các class còn hoạt động được bơm vào, Head mới sẽ học lại danh sách class chuẩn cực nhanh.
- **Cơ chế Trần (Ceiling Capping) trên Từng Class:** Đặt mức trần tối đa là **200 ảnh / 1 class cũ** để tránh phình to.
- **Cơ chế Trần Tổng (Global Capping - Chống Nuốt Chửng):** Như bạn đã phân tích, nếu số lượng class cũ quá lớn (VD $K = 50$), việc cố giữ 50 ảnh/class sẽ tạo ra 2500 ảnh cũ, "nuốt chửng" 200 ảnh mới. 
  - *Giải pháp chặn trên:* Tổng số ảnh cũ bốc ra từ Golden Hub tuyệt đối **không được vượt quá 50% tổng số ảnh mới (N)**. Nếu vượt quá, hệ thống sẽ tự động scale down (thu nhỏ tỷ lệ) quota của mỗi class cũ xuống để bảo vệ sự tập trung vào class mới. Lượng thiếu hụt sẽ được bù đắp bằng Class Weights.

## 2.1. Cân Bằng Trọng Số & Xử lý Ảnh Trống
Vì công thức mức chuẩn trên có thể dẫn đến việc tập Cũ lớn hơn tập Mới, ta áp dụng các chuẩn MLOps kết hợp:
- **Giữ nguyên Augmentation sinh biến thể:** Lô ảnh mới (Project mới) VẪN bắt buộc đi qua bước áp dụng các Filter/Augmentations (lật, xoay, thay đổi độ sáng...) để nhân bản số lượng ảnh. Điều này giúp tạo ra nhiều trường hợp (cases) thực tế giúp model học sự đa dạng. (Đã quy định ở Phần 2).
- **Tính toán Trọng số Lớp Động (Dynamic Class Weights):** Trọng số phạt không bị gán cứng mà được tự động tính toán dựa trên số lượng thực tế:
  - *Trường hợp 1 (Ảnh mới ít hơn):* VD 200 mới / 500 cũ. Class mới là "thiểu số". Điểm phạt sẽ gán nặng vào Class Mới để ép model học nó.
  - *Trường hợp 2 (Ảnh mới nhiều hơn):* VD 600 mới / 500 cũ (500 cũ chia cho 5 class = 100 ảnh/class cũ). Lúc này, class Mới (600 ảnh) đang "áp đảo" các class Cũ (100 ảnh/class). Nhóm "thiểu số" giờ lại chính là các class Cũ! Trọng số phạt nặng sẽ tự động **chuyển dời sang các class Cũ** để ép model không được phép quên bài cũ do bị ảnh mới lấn át.
  - *Chốt lại:* Kỹ thuật Class Weights hoạt động như một cái "bập bênh". Bên nào ít ảnh hơn, bên đó sẽ được nhận Trọng số phạt cao hơn để bắt model phải học kỹ cân bằng cả hai bên.
- **Kho Ảnh Trống (Background Images Hub):** Đúng như bạn phân tích, chúng ta cần chuẩn bị sẵn một kho ảnh rỗng. Quản trị viên chỉ cần quay/chụp sẵn các video băng chuyền chạy không (không có sản phẩm) ở nhiều điều kiện sáng khác nhau rồi upload vào "Kho Ảnh Trống". Khi Trộn dataset, hệ thống tự động bốc một lượng ảnh từ đây (khoảng 10% tổng dataset) bơm vào hỗn hợp. Cực kỳ hiệu quả để triệt tiêu lỗi nhận diện nhầm (False Positives).
- **Đồng bộ Phân mảnh (Split Sync):** Rổ Ảnh Có Nhãn và Rổ Ảnh Trống sẽ được đẩy qua luồng **Chia tách Độc lập** ở Mục 1 để rải đều 70-20-10 trước khi hợp nhất thành thư mục YOLO cuối cùng.

## 3. Chiến lược Đóng Băng Sâu (Deep Freezing / Linear Probing)
Với lượng dữ liệu mới dồi dào, ta dùng 2-Phase Fine-Tuning thông thường. Nhưng khi **dữ liệu mới quá ít**, ta áp dụng cách tiếp cận Tối ưu hơn:
- **Đóng băng Sâu (Freeze Backbone + Neck):** Chỉ mở khóa duy nhất phần đầu ra (Detection Head) để nó cập nhật thêm tên sản phẩm mới. Giữ nguyên 100% khối óc phân tích hình dáng của model cũ. Điều này giúp model học cực nhanh (chỉ vài phút), ngăn chặn hoàn toàn việc phá hỏng độ chính xác của các sản phẩm cũ.
- **Giai đoạn 2 (Mở khóa và Tinh chỉnh):** Mở khóa toàn bộ mô hình nhưng cho phép mô hình học với tốc độ cực kỳ chậm (Learning Rate siêu nhỏ). Giai đoạn này giống như việc "mài giũa", giúp các khung Bounding Box bám sát sản phẩm hơn mà không làm chấn động đến trí nhớ cốt lõi.

## 4. Chế độ Global Retrain (Train Lại Từ Đầu)
Mặc dù Fine-Tuning liên tục giúp tiết kiệm thời gian, nhưng sau một thời gian dài vận hành (ví dụ: 3-6 tháng) hoặc khi có sự thay đổi lớn về ánh sáng nhà máy, hệ thống sẽ hỗ trợ chế độ **Global Retrain**. 
- Hệ thống sẽ bốc TOÀN BỘ dữ liệu của tất cả các class từ Kho Golden (không dùng công thức 80/20) để train lại một model "Foundation" hoàn toàn mới từ đầu. Model này sẽ thay thế model cũ làm nền tảng (Base Model) cốt lõi cực kỳ vững chắc cho các lần Fine-Tuning tiếp theo.
