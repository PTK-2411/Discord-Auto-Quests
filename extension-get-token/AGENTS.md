# Discord Token Extractor — Chrome Extension

## Project Overview
Tiện ích mở rộng trình duyệt (Chrome Extension - Manifest V3) hỗ trợ trích xuất **Discord User Token** từ tab Discord đang hoạt động và tự động copy vào clipboard. Extension này được sử dụng kèm với dự án chính **Discord-Auto-Quests** (PTK Tool by PTKhoa) để người dùng lấy token nhanh chóng mà không cần mở DevTools.

## Tech Stack & Architecture
- **Platform**: Chrome Extension (Manifest V3)
- **Ngôn ngữ**: Pure JavaScript (ES6+), HTML5, CSS3 (không dùng bundler hay framework ngoài)
- **Quyền hạn (Permissions)**:
  - `activeTab`: Truy cập tab Discord đang được mở ở foreground.
  - `scripting`: Thực thi script inject trực tiếp vào trang web.
  - `clipboardWrite`: Tự động sao chép token vào clipboard.

## Directory Structure
```
extension-get-token/
├── manifest.json   # Cấu hình extension (Manifest V3, permissions, popup, icons)
├── popup.html      # Giao diện popup khi click vào biểu tượng extension
├── popup.js        # Logic xử lý sự kiện popup, execute script lấy token và copy
├── logo.png        # Biểu tượng của extension (16x16, 48x48, 128x128)
└── AGENTS.md       # Tài liệu & chỉ dẫn dành cho AI Agents
```

## How It Works
1. Người dùng mở trang `https://discord.com/app` (hoặc bất kỳ trang nào bắt đầu bằng `https://discord.com/`).
2. Mở popup extension và bấm nút "Extract Token".
3. `popup.js` kiểm tra URL tab hiện tại và gọi `chrome.scripting.executeScript` để inject hàm `extractToken()`.
4. Hàm trích xuất giá trị `localStorage.token`.
5. Kết quả trả về được làm sạch dấu ngoặc kép (`"`) và ghi vào clipboard thông qua `navigator.clipboard.writeText()`.

## Development & Testing
- **Cài đặt vào trình duyệt**:
  1. Mở Chrome / Brave / Cốc Cốc / Edge và truy cập `chrome://extensions/`.
  2. Bật chế độ **Developer mode** (Chế độ dành cho nhà phát triển).
  3. Chọn **Load unpacked** (Tải tiện ích đã giải nén) và trỏ tới thư mục `extension-get-token/`.
- **Reload khi sửa code**: Bấm nút Reload icon tại trang quản lý extension sau khi chỉnh sửa bất kỳ file nào trong thư mục.

## Agent Guidelines & Constraints
- **Giữ cấu trúc đơn giản**: Extension không dùng build tool/bundler; giữ mã nguồn vanila thuần để người dùng có thể nạp thẳng dạng unpacked mà không cần compile.
- **Bảo mật**:
  - Không gửi token ra server ngoài; chỉ copy vào clipboard cục bộ.
  - Chỉ cho phép chạy injection trên domain `https://discord.com/`.
- **Tương thích Manifest V3**: Không dùng `eval()` hoặc remote hosted scripts; tuân thủ chính sách CSP của Chrome Extension Manifest V3.
