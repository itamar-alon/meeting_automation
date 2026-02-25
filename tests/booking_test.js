require('dotenv').config();
const { chromium } = require('playwright');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// --- הגדרות נתיבים ---
const LOKI_URL = 'http://10.77.72.45:3100/loki/api/v1/push';
const JOB_NAME = 'meeting_automation';
const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const SCREEN_DIR = path.resolve(LOG_DIR, 'screenshots');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

// --- פונקציות לוג משודרגות (לא נמחק!) ---
async function sendToLoki(level, message, durationMs = null, retries = 3) {
    const ts = (Date.now() * 1_000_000).toString();
    let logMessage = message;
    if (durationMs !== null) logMessage += ` | duration_ms=${durationMs}`;

    const payload = {
        streams: [{
            stream: { 
                job: JOB_NAME, 
                severity: level, 
                target_env: process.env.TEST_ENV || 'TEST',
                has_metrics: durationMs !== null ? "true" : "false" 
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
    console.log(`[${timestamp}] [INFO] ${msg}${duration !== null ? ` (${duration}ms)` : ''}`);
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

        // --- שלב 1: כניסה ---
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        const cookieBtn = page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        if (await cookieBtn.isVisible({ timeout: 5000 })) await cookieBtn.click({ force: true });

        await page.locator('button:has-text("כניסה")').first().click();
        await loginPage.performMainLogin(process.env.USER_ID, process.env.USER_PASS);
        await page.waitForLoadState('networkidle');
        await loginPage.navigateToAppointments();

        // --- שלב 2: זימון ---
        await bookingPage.selectOption(DEPT);
        await bookingPage.selectOption(SERVICE);
        try { await bookingPage.selectOption('טלפוני'); } catch (e) {}
        
        // כאן נכנסת הפונקציה החדשה שבודקת את השעות לעומק
        try {
            await bookingPage.findAndPickAvailableAppointment();
        } catch (noSlotsErr) {
            if (noSlotsErr.message.includes('No slots found')) {
                info('⚠️ SKIPPING: No available appointments found. Ending session.');
                return; 
            }
            throw noSlotsErr;
        }

        if (INTERCEPT_MODE) {
            await page.route('**/SetAppointment*', route => route.fulfill({
                status: 200, contentType: 'application/json',
                body: JSON.stringify({ "CaseId": 12345, "ScriptResults": { "ReturnCode": 0 } })
            }));
        }

        info('🚀 Submitting booking...');
        const bookingStartTime = performance.now();

        await bookingPage.submitBooking();

        if (!INTERCEPT_MODE) {
            // המתנה חכמה לאסמכתא
            await bookingPage.verifySuccessAndClose();
            const bookingDuration = Math.round(performance.now() - bookingStartTime);
            info('✅ Booking confirmed successfully', bookingDuration);

            // --- שלב 3: ביטול ---
            info('--- Step 3: Cancellation Starting ---');
            const futureApptsTab = page.locator('button[role="tab"][aria-label*="פגישות עתידיות"]');
            
            // אם הועפנו החוצה, חוזרים פנימה (הלוגיקה שביקשת לשמור!)
            if (!(await futureApptsTab.isVisible({ timeout: 5000 }))) {
                await loginPage.navigateToAppointments();
            }

            await futureApptsTab.click({ force: true });
            const apptRow = page.locator('text=נושא:').first();
            try {
                await apptRow.waitFor({ state: 'visible', timeout: 20000 });
            } catch (e) {
                await futureApptsTab.click();
                await apptRow.waitFor({ state: 'visible', timeout: 10000 });
            }

            await myApptsPage.expandFirstAppointment();
            await myApptsPage.cancelAppointment();
            await myApptsPage.confirmCancellation();
            info('✅ Cancellation finished.');
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