# Discord Auto Quests (PTK Tool by PTKhoa)

## Project Overview
Hệ sinh thái công cụ hỗ trợ tự động hoàn thành và nhận thưởng (claim) các nhiệm vụ (Quests) trên Discord, tích lũy điểm ảo (Orbs) và quà tặng. Dự án bao gồm cả công cụ dòng lệnh (CLI Node.js/TypeScript) và các tiện ích mở rộng trình duyệt (Chrome Extension Manifest V3).

## Tech Stack & Architecture
- **CLI Engine**: Node.js (>=20.12), TypeScript 5.3+, `@discordjs/core`, `@discordjs/rest`, `@discordjs/ws`, `chalk`, `cli-table3`.
- **Browser Extensions**:
  - Pure JavaScript (ES2022+), HTML5, CSS3.
  - Manifest V3 compliant.
  - Tích hợp Chrome APIs: `storage`, `tabs`, `scripting`, `notifications`, `alarms`.

## Directory Structure
```
Discord-Auto-Quests/
├── farm.ts                    # Entrypoint CLI chạy auto quest bằng terminal
├── accounts.json              # Danh sách tài khoản lưu cục bộ cho CLI
├── src/
│   ├── engine.ts              # Core logic gọi Discord Quest API v10
│   └── accounts.ts            # Quản lý tài khoản và tương tác CLI
├── extension-get-token/       # Extension trích xuất Discord User Token độc lập
│   ├── manifest.json
│   ├── popup.html
│   ├── popup.js
│   └── AGENTS.md
├── extension-auto-quests/     # Extension tổng hợp tự động lấy token và hoàn thành quest
│   ├── manifest.json          # Manifest V3 (Service worker + Popup + Permissions)
│   ├── background.js          # Service worker theo dõi tab discord.com & chạy quest
│   ├── popup.html             # Giao diện popup dashboard
│   ├── popup.css              # Giao diện Discord Dark theme
│   ├── popup.js               # Logic điều khiển & hiển thị real-time
│   ├── icons/                 # Bộ biểu tượng extension
│   └── AGENTS.md
└── AGENTS.md                  # Hướng dẫn tổng quát cho AI agents
```

## Available Extensions
1. **`extension-get-token/`**: Tiện ích gọn nhẹ giúp trích xuất token Discord từ tab hiện tại và copy vào clipboard.
2. **`extension-auto-quests/`**: Tiện ích tổng hợp toàn diện. Tự động phát hiện khi người dùng mở `https://discord.com/`, trích xuất token, load quest, tự động chạy video/heartbeat, tự động claim thưởng và cập nhật tiến độ real-time trên Popup UI.

## Key Commands (CLI)
- Cài đặt dependencies: `npm install`
- Chạy CLI: `npm run go`
