# Discord Auto Quests — Consolidated Browser Extension (Manifest V3)

## Project Overview
Tiện ích mở rộng tổng hợp (Chrome / Chromium Extension - Manifest V3) tự động nhận diện tài khoản Discord, trích xuất token người dùng khi mở tab `discord.com`, và tự động thực hiện, nhận thưởng (claim) toàn bộ các Discord Quests khả dụng trong thời gian thực.

## Tech Stack & Architecture
- **Platform**: Chrome / Chromium Extension (Manifest V3)
- **Languages**: Pure JavaScript (ES2022+), HTML5, CSS3 (Modern Discord Dark theme `#1e1f22`, `#5865f2`, `#23a55a`).
- **Core Components**:
  - `manifest.json`: Khai báo quyền `storage`, `tabs`, `scripting`, `notifications`, `alarms`, host permissions `https://discord.com/*` và background service worker.
  - `background.js`: Service worker chạy nền:
    - Bắt sự kiện `chrome.tabs.onUpdated` khi người dùng mở `https://discord.com/`.
    - Trích xuất token từ `localStorage.token`.
    - Gọi Discord REST API v10 (`/users/@me`, `/virtual-currency/balance`, `/quests/@me`).
    - Tự động enroll, gửi video watch progress (7s/tick) hoặc heartbeat desktop app (60s/tick).
    - Tự động claim reward khi quest hoàn tất và gửi thông báo trình duyệt (Chrome notification & badge).
    - Lưu trữ trạng thái và truyền phát real-time logs qua `chrome.storage.local` và message passing.
  - `popup.html`, `popup.css`, `popup.js`:
    - Giao diện người dùng theo dõi tiến độ: Avatar, Username, số lượng Orbs 🔮.
    - Danh sách thẻ quest động: tên quest, icon phân loại (🎬 video, 🎮 desktop, 📡 stream), thanh tiến độ phần trăm, trạng thái (*waiting, running, done, claimed, failed*).
    - Bảng điều khiển: nút bật/tắt tự động chạy, nút "Chạy ngay / Dừng lại", nút làm mới, nút xóa log.
    - Cửa sổ console log thời gian thực với phân loại màu sắc (info, success, warn, error).

## Directory Structure
```
extension-auto-quests/
├── manifest.json       # Manifest V3 configuration
├── background.js       # Background Service Worker (Quest engine & tab watcher)
├── popup.html          # Popup UI layout
├── popup.css           # Styling with Discord Dark Theme
├── popup.js            # Popup UI logic and real-time state sync
├── icons/              # Extension icons (16px, 48px, 128px)
└── AGENTS.md           # Documentation for AI Agents
```

## How to Install & Test
1. Mở trình duyệt Chrome / Edge / Brave / Cốc Cốc.
2. Truy cập `chrome://extensions/`.
3. Bật **Developer mode** (Chế độ dành cho nhà phát triển).
4. Nhấn nút **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục:
   `extension-auto-quests` (nằm trong thư mục dự án)
5. Mở tab `https://discord.com/` và đăng nhập: extension sẽ tự động trích xuất token và bắt đầu làm quest. Bấm vào icon extension trên thanh công cụ để theo dõi tiến độ chi tiết.
