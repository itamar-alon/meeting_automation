Meeting Automation Service 📅
A high-performance Playwright-based automation engine designed for intelligent appointment scheduling within municipal systems. This service features advanced calendar scanning logic, real-time observability via Grafana Loki, and automated error recovery.

🚀 Key Features
Smart Date Scanning: Automatically iterates through available calendar dates until a valid time slot is found, preventing script crashes on empty days.

Environment Aware: Supports TEST and PROD modes. In production, a network interceptor prevents accidental booking of real appointments during testing.

Full Observability: Streams structured logs to a centralized Loki server with severity levels (info, warn, error).

Automated Evidence: Captures full-page screenshots (.png) automatically upon any critical failure for rapid debugging.

🛠 Project Structure
Plaintext
├── pages/              # Page Object Model (POM)
│   ├── loginPage.js    # Authentication and session handling
│   ├── meetingPage.js  # Smart calendar & time selection logic
│   └── myMeetingsPage.js # Management and cancellation logic
├── tests/
│   └── booking_test.js # Main execution entry point
├── logs/               # Local log storage & screenshots (Git Ignored)
├── .env                # Sensitive credentials (Git Ignored)
└── package.json        # Dependencies and execution scripts
⚙️ Setup & Installation
Clone and Install:

Bash
npm install
Environment Configuration:
Create a .env file in the root directory based on .env.example:

קטע קוד
USER_ID=your_id
USER_PASS=your_password
LOKI_URL=http://10.77.72.45:3100/loki/api/v1/push
🏃 Execution Commands
Pre-configured scripts for various environments:

Run in Test Environment (Full flow: Booking + Cancellation):

Bash
npm run test:test
Run in Production Environment (Interceptor Mode - API Mocking):

Bash
npm run test:prod
📊 Monitoring (Grafana)
Logs are pushed with the label job="meeting_automation".

To view errors in your Grafana Dashboard, use the following LogQL query:

קטע קוד
{job="meeting_automation", severity="error"}
How to push this to your Repo:
Save the content above into your README.md.

Run these commands in your terminal:

Bash
git add README.md
git commit -m "docs: added professional English README"
git push