require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks'); // הוספת ספרייה למדידת זמן מדויקת

// --- הגדרות נתיבים ---
const LOKI_URL = 'http://10.77.72.45:3100/loki/api/v1/push';
const JOB_NAME = 'meeting_automation';
const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const SCREEN_DIR = path.resolve(LOG_DIR, 'screenshots');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

// --- פונקציות לוג משודרגות למדידת ביצועים ---
async function sendToLoki(level, message, durationMs = null, retries = 3) {
    const ts = (Date.now() * 1_000_000).toString();
    
    // בניה של הודעה הכוללת את המטריקה בפורמט Logfmt שגרפנה אוהבת
    let logMessage = message;
    if (durationMs !== null) {
        logMessage += ` | duration_ms=${durationMs}`;
    }

    const payload = {
        streams: [{
            stream: { 
                job: JOB_NAME, 
                severity: level, 
                target_env: process.env.TEST_ENV || 'TEST',
                has_metrics: durationMs !== null ? "true" : "false" // לייבל לסינון מהיר
            },
            values: [[ts, logMessage]]
        }]
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(LOKI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return;
        } catch (e) {
            if (attempt === retries) console.error(`❌ Loki failure: ${e.message}`);
            else await new Promise(r => setTimeout(r, 1000));
        }
    }
}

const info = (msg, duration = null) => {
    const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
    const suffix = duration !== null ? ` (Duration: ${duration}ms)` : '';
    console.log(`[${timestamp}] [INFO] ${msg}${suffix}`);
    sendToLoki('info', msg, duration);
};

const error = msg => {
    console.log(`[${new Date().toLocaleTimeString('he-IL', { hour12: false })}] [ERROR] ${msg}`);
    sendToLoki('error', msg);
};

async function takeScreenshot(page, step) {
    try {
        if (!page || page.isClosed()) return;
        const fileName = `FAIL_${step}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        await page.screenshot({ path: path.join(SCREEN_DIR, fileName), fullPage: true });
        info(`📸 Screenshot_Saved: ${fileName}`);
    } catch (e) { console.error(`⚠️ Screenshot failed: ${e.message}`); }
}

// --- Main Script ---
(async () => {
    const ENV = (process.env.TEST_ENV || 'TEST').toUpperCase();
    const INTERCEPT_MODE = ENV === 'PROD';
    let browser, page;

    try {
        const { LoginPage } = require('../pages/loginPage.js');
        const { AppointmentsPage } = require('../pages/meetingPage.js');
        const { MyAppointmentsPage } = require('../pages/myMeetingsPage.js');

        const BASE_URL = ENV === 'PROD' ? 'https://my.rishonlezion.muni.il' : 'https://mytest.rishonlezion.muni.il';
        const DEPT = ENV === 'PROD' ? 'מנהל החינוך' : 'אגף הכנסות';
        const SERVICE = ENV === 'PROD' ? 'גני ילדים - רישום/ביטול רישום' : 'אישורים לטאבו - מוזמנים';

        browser = await chromium.launch({ headless: false, slowMo: 100 });
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
        page = await context.newPage();
        page.setDefaultTimeout(60000); 

        const loginPage = new LoginPage(page);
        const bookingPage = new AppointmentsPage(page);
        const myApptsPage = new MyAppointmentsPage(page);

        info(`🚀 STARTING SESSION | Env: ${ENV}`);

        // --- Step 1: Login ---
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        const cookieBtn = page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        if (await cookieBtn.isVisible({ timeout: 5000 })) await cookieBtn.click({ force: true });

        await page.locator('button:has-text("כניסה")').first().click();
        await loginPage.performMainLogin(process.env.USER_ID, process.env.USER_PASS);
        
        await page.waitForLoadState('networkidle');
        await loginPage.navigateToAppointments();

        // --- Step 2: Booking ---
        await bookingPage.selectOption(DEPT);
        await bookingPage.selectOption(SERVICE);
        try { await bookingPage.selectOption('טלפוני'); } catch (e) {}
        await bookingPage.findAndPickAvailableAppointment();

        if (INTERCEPT_MODE) {
            await page.route('**/SetAppointment*', route => route.fulfill({
                status: 200, contentType: 'application/json',
                body: JSON.stringify({ "CaseId": 12345, "ScriptResults": { "ReturnCode": 0 } })
            }));
        }

        // מדידת זמן לשלב הזימון הקריטי
        info('🚀 Submitting booking via orange button...');
        const bookingStartTime = performance.now(); // תחילת המדידה

        await bookingPage.submitBooking();

        if (!INTERCEPT_MODE) {
            await bookingPage.verifySuccessAndClose();
            
            const bookingEndTime = performance.now(); // סיום המדידה
            const bookingDuration = Math.round(bookingEndTime - bookingStartTime);
            info('✅ Booking confirmed successfully', bookingDuration); // שליחה עם המטריקה

            info('--- Step 3: Cancellation Starting ---');
            const futureApptsTab = page.locator('button[role="tab"][aria-label*="פגישות עתידיות"]');
            
            if (!(await futureApptsTab.isVisible({ timeout: 5000 }))) {
                await loginPage.navigateToAppointments();
            }

            await futureApptsTab.click({ force: true });
            await info('🖱️ Clicked "Future Appointments" tab.');

            const apptRow = page.locator('text=נושא:').first();
            try {
                await apptRow.waitFor({ state: 'visible', timeout: 20000 });
            } catch (e) {
                info('⚠️ List not visible, trying one refresh...');
                await futureApptsTab.click();
                await apptRow.waitFor({ state: 'visible', timeout: 10000 });
            }

            await myApptsPage.expandFirstAppointment();
            await myApptsPage.cancelAppointment();
            await myApptsPage.confirmCancellation();
            info('✅ Cancellation finished.');
        } else {
            info('🎉 PROD Mode: Booking intercepted, skipping confirmation wait.');
        }
        
        info('🎉 SESSION COMPLETED SUCCESSFULLY!');
    } catch (err) {
        await error(`💥 CRITICAL FAILURE: ${err.message}`);
        if (page) await takeScreenshot(page, `FAILURE_${ENV}`);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close();
        setTimeout(() => process.exit(process.exitCode || 0), 2000);
    }
})();