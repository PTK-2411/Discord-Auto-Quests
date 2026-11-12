# Security Policy / Chính Sách Bảo Mật

[English](#english) • [Tiếng Việt](#tiếng-việt)

---

## English

### Supported Versions

We actively provide security updates, bug fixes, and compatibility patches for the latest releases of **PTK Tool Discord Auto Quests**:

| Version | Supported          |
| ------- | ------------------ |
| 2.4.x   | :white_check_mark: |
| 2.3.x   | :x:                |
| < 2.3.0 | :x:                |

We strongly encourage all users to stay updated with the latest release available on [GitHub Releases](https://github.com/PTK-2411/Discord-Auto-Quests/releases).

---

### Reporting a Vulnerability

The security of your Discord account and credentials is our highest priority. If you discover a security vulnerability or security-related issue in this project, please follow responsible disclosure guidelines:

1. **Do NOT report security vulnerabilities through public GitHub issues or public discussions.**
2. Please report the issue privately through one of the following channels:
   - **GitHub Security Advisory**: Open a private advisory report at [Report a vulnerability](https://github.com/PTK-2411/Discord-Auto-Quests/security/advisories/new).
   - **Direct Email**: Contact the maintainer directly at **khoa.ark123456@gmail.com** with the subject line `[SECURITY] Discord-Auto-Quests Vulnerability Report`.
3. In your report, please include:
   - Description of the vulnerability and its potential impact.
   - Step-by-step reproduction instructions or Proof of Concept (PoC).
   - The affected version(s) and environment (Chrome version, OS, CLI/Extension).
4. **Response Timeline**:
   - We will acknowledge receipt of your vulnerability report within **48 hours**.
   - We will provide regular status updates regarding verification and patch deployment.
   - Once resolved, a patch release will be published along with appropriate credit (if requested).

---

### Token Security & Privacy Architecture

This tool is designed with a strict **Privacy-First & Zero-Telemetry** architecture:

- **Local Storage Only**: Your Discord authentication token is stored exclusively inside your local browser via `chrome.storage.local` (for the browser extension) or your local `.env` file (for the CLI).
- **No Third-Party Transmission**: Tokens are sent **only and directly** to official Discord API endpoints (`https://discord.com/api/v10/*`). No tokens, analytics, or user identifiers are ever sent to external servers, maintainers, or third parties.
- **Minimal Permissions (MV3)**: The extension operates strictly within Chrome Manifest V3 guidelines with host permissions scoped strictly to `discord.com` and GitHub release check endpoints.
- **Token Invalidation**: If you suspect your Discord token has been compromised, you can immediately invalidate all existing tokens by changing your Discord password or enabling two-factor authentication (2FA).

---

## Tiếng Việt

### Các Phiên Bản Được Hỗ Trợ

Chúng tôi duy trì cập nhật bảo mật và sửa lỗi cho các phiên bản mới nhất của **PTK Tool Discord Auto Quests**:

| Phiên bản | Hỗ trợ             |
| --------- | ------------------ |
| 2.4.x     | :white_check_mark: |
| 2.3.x     | :x:                |
| < 2.3.0   | :x:                |

Khuyến nghị người dùng luôn cập nhật phiên bản mới nhất tại [GitHub Releases](https://github.com/PTK-2411/Discord-Auto-Quests/releases) hoặc sử dụng tính năng tự động cập nhật được tích hợp sẵn từ v2.4.

---

### Báo Cáo Lỗ Hổng Bảo Mật

An toàn tài khoản Discord của người dùng là ưu tiên hàng đầu của dự án. Nếu bạn phát hiện bất kỳ vấn đề bảo mật nào, vui lòng tuân thủ quy trình tiết lộ có trách nhiệm:

1. **Vui lòng KHÔNG tạo issue công khai hoặc thảo luận công khai về lỗ hổng bảo mật.**
2. Vui lòng gửi báo cáo bảo mật riêng tư qua một trong hai hình thức:
   - **GitHub Security Advisory**: Tạo báo cáo riêng tư tại [Báo cáo lỗ hổng](https://github.com/PTK-2411/Discord-Auto-Quests/security/advisories/new).
   - **Email trực tiếp**: Gửi email tới tác giả tại **khoa.ark123456@gmail.com** với tiêu đề `[SECURITY] Báo cáo lỗ hổng Discord-Auto-Quests`.
3. Báo cáo vui lòng bao gồm:
   - Mô tả chi tiết về lỗ hổng và mức độ ảnh hưởng tiềm ẩn.
   - Các bước tái hiện cụ thể hoặc mã minh họa (PoC).
   - Phiên bản bị ảnh hưởng và môi trường thử nghiệm (Hệ điều hành, phiên bản Chrome, Extension hay CLI).
4. **Thời gian phản hồi**:
   - Xác nhận đã nhận thông tin trong vòng **48 giờ**.
   - Thông báo tiến độ kiểm tra, xác thực và phát hành bản vá.
   - Khi bản vá được cập nhật, thông tin ghi nhận đóng góp (credit) sẽ được công bố nếu người báo cáo đồng ý.

---

### Nguyên Tắc An Toàn & Bảo Mật Token

Dự án được xây dựng với kiến trúc **Bảo vệ quyền riêng tư tuyệt đối (Zero-Telemetry)**:

- **Chỉ lưu trữ cục bộ**: Token xác thực Discord của bạn chỉ được lưu cục bộ trong máy tính của bạn thông qua `chrome.storage.local` (đối với Extension) hoặc file `.env` (đối với CLI).
- **Không gửi tới bên thứ ba**: Token chỉ được gửi **trực tiếp và duy nhất** tới API chính thức của Discord (`https://discord.com/api/v10/*`). Hoàn toàn không có máy chủ trung gian, không thu thập dữ liệu phân tích hay gửi token đi bất cứ đâu.
- **Phân quyền tối thiểu**: Extension tuân thủ nghiêm ngặt chuẩn Chrome Manifest V3, chỉ yêu cầu các quyền thực sự cần thiết và giới hạn phạm vi truy cập tên miền.
- **Hủy hiệu lực Token khi cần**: Nếu bạn nghi ngờ token của mình bị lộ, bạn có thể vô hiệu hóa ngay lập tức toàn bộ các token cũ bằng cách đổi mật khẩu tài khoản Discord hoặc kích hoạt bảo mật 2 lớp (2FA).
