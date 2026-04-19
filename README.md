# 📅 Meeting Automation Service

[![Node.js](https://img.shields.io/badge/Language-Node.js-green)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Framework-Playwright-orange)](https://playwright.dev/)
[![Loki](https://img.shields.io/badge/Logging-Grafana%20Loki-blue)](https://grafana.com/oss/loki/)

A high-performance **Playwright-based** automation engine designed for intelligent appointment scheduling within municipal systems. This service features advanced calendar scanning logic, real-time observability via Grafana Loki, and automated error recovery.

## 🚀 Key Features

- **Smart Date Scanning**: Automatically iterates through available calendar dates until a valid time slot is found, preventing script crashes on empty days.
- **Environment Aware**: Supports **TEST** and **PROD** modes. In production, a network interceptor prevents accidental booking of real appointments during testing.
- **Full Observability**: Streams structured logs to a centralized Loki server with severity levels (`info`, `warn`, `error`).
- **Automated Evidence**: Captures full-page screenshots (.png) automatically upon any critical failure for rapid debugging.
- **POM Architecture**: Built using the **Page Object Model** for high maintainability and scalability.
<img width="1383" height="634" alt="image" src="https://github.com/user-attachments/assets/13ac53f6-c74b-4f4e-95ec-a69a61599dcd" />

## 🛠 Project Structure

```text
├── pages/                # Page Object Model (POM)
│   ├── loginPage.js      # Authentication and session handling
│   ├── meetingPage.js    # Smart calendar & time selection logic
│   └── myMeetingsPage.js # Management and cancellation logic
├── tests/
│   └── booking_test.js   # Main execution entry point
├── logs/                 # Local log storage & screenshots (Git Ignored)
├── .env                  # Sensitive credentials (Git Ignored)
└── package.json          # Dependencies and execution scripts
⚙️ Setup & Installation
1. Clone and Install
Bash
git clone [https://github.com/itamar-alon/meeting_automation.git](https://github.com/itamar-alon/meeting_automation.git)
cd meeting_automation
npm install
2. Environment Configuration
Create a .env file in the root directory based on .env.example:

USER_ID=your_id
USER_PASS=your_password
LOKI_URL=http://your-loki-ip:3100/loki/api/v1/push
🏃 Execution Commands
Run in Test Environment (Full flow: Booking + Cancellation):

Bash
npm run test:test
Run in Production Environment (Interceptor Mode - API Mocking):

Bash
npm run test:prod
📊 Monitoring (Grafana)
Logs are pushed with the label job="meeting_automation".

To view errors in your Grafana Dashboard, use the following LogQL query:

{job="meeting_automation", severity="error"}
📄 License
Internal municipal automation project.

