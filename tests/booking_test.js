require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- הגדרות נתיבים מעודכנות (Absolute Paths) ---
const LOKI_URL = 'http://10.77.72.45:3100/loki/api/v1/push';
const JOB_NAME = 'meeting_automation';
const LOG_DIR = path.resolve(__dirname, 'logs');
const SCREEN_DIR = path.resolve(LOG_DIR, 'screenshots');

// יצירת תיקיות אם אינן קיימות
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

// --- פונקציית שליחה ל-Loki עם Retry ---
async function sendToLoki(level, message, retries = 3) {
    const ts = (Date.now() * 1_000_000).toString(); // ננוסניות
    const payload = {
        streams: [{
            stream: { job: JOB_NAME, severity: level },
            values: [[ts, message]]
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
            console.error(`⚠️ Loki send attempt ${attempt} failed: ${e.message}`);
            if (attempt === retries) console.error('❌ Giving up on sending log to Loki.');
            else await new Promise(r => setTimeout(r, 1000));
        }
    }
}

// --- פונקציית לוג עם Severity ---
async function log(level, message) {
    const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    await sendToLoki(level, message);
}

const info = msg => log('info', msg);
const warn = msg => log('warn', msg);
const error = msg => log('error', msg);

// --- פונקציית צילום מסך מעודכנת ---
async function takeScreenshot(page, step) {
    try {
        if (!page || page.isClosed()) {
            console.error('❌ Cannot take screenshot: Page is already closed.');
            return;
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `FAIL_${step}_${timestamp}.png`;
        const filePath = path.join(SCREEN_DIR, fileName);
        
        await page.screenshot({ path: filePath, fullPage: true });
        // הוספת Screenshot_Saved ללוג כדי שגרפנה תוכל לחלץ את השם בעתיד
        await info(`🖼️ Screenshot_Saved: ${fileName}`);
        console.log(`✅ Screenshot physical path: ${filePath}`);
    } catch (e) {
        await warn(`⚠️ Screenshot failed: ${e.message}`);
    }
}

// --- Main Script ---
(async () => {
    const ENV = process.env.TEST_ENV || 'TEST';
    const INTERCEPT_MODE = ENV === 'PROD';

    let BASE_URL, DEPARTMENT_NAME, SERVICE_NAME;

    if (ENV === 'PROD') {
        BASE_URL = 'https://my.rishonlezion.muni.il';
        DEPARTMENT_NAME = 'מנהל החינוך';
        SERVICE_NAME = 'גני ילדים - רישום/ביטול רישום';
    } else {
        BASE_URL = 'https://mytest.rishonlezion.muni.il';
        DEPARTMENT_NAME = 'אגף הכנסות';
        SERVICE_NAME = 'אישורים לטאבו - מוזמנים';
    }

    const { LoginPage } = require('../pages/loginPage.js');
    const { AppointmentsPage } = require('../pages/meetingPage.js');
    const { MyAppointmentsPage } = require('../pages/myMeetingsPage.js');

    const browser = await chromium.launch({ headless: false, slowMo: 600 });
    const page = await browser.newPage();
    const loginPage = new LoginPage(page);
    const bookingPage = new AppointmentsPage(page);
    const myApptsPage = new MyAppointmentsPage(page);

    try {
        await info(`🚀 STARTING SESSION | Env: ${ENV} | Dept: ${DEPARTMENT_NAME}`);

        const MOCK_RESPONSE = {
            "SetAppointmentData": {
                "ParentCaseId": 0, "ServiceId": 262, "DateAndTime": "2026-02-17T16:00:00",
                "UserId": 519, "CustomerId": 255870, "AppointmentTypeId": 0,
                "CustomProperties": { "1": "PHONE" }
            },
            "ScriptResults": { "Messages": [], "ReturnCode": 0 },
            "CaseId": 1810639, "ProcessId": 1810348, "AppointmentId": 202733,
            "CalendarId": 91558, "QNumber": 0, "QCode": "", "CustomerTreatmentPlanId": 0
        };

        // --- Login ---
        await info('--- Step 1: Login Process Starting ---');
        await page.goto(BASE_URL);
        await loginPage.performMainLogin(process.env.USER_ID, process.env.USER_PASS);
        await loginPage.navigateToAppointments();
        await info('✅ Login completed.');

        // --- Booking Flow ---
        await info('--- Step 2: Selection Flow Starting ---');
        await bookingPage.selectOption(DEPARTMENT_NAME);
        await bookingPage.selectOption(SERVICE_NAME);
        await bookingPage.selectOption('טלפוני');
        
        // כאן השתמשנו בפונקציה המעודכנת שסורקת תאריכים עד למציאת שעה
        await info('📅 Scanning for available appointments...');
        await bookingPage.findAndPickAvailableAppointment();

        if (INTERCEPT_MODE) {
            await info('🛑 PROD MODE: Interceptor Active.');
            await page.route('**/SetAppointment*', async route => {
                await info(`✋ INTERCEPTED: ${route.request().url()}`);
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(MOCK_RESPONSE)
                });
            });
            await bookingPage.submitBooking();
            await page.waitForTimeout(5000);
            await info('✅ UI Verification Passed (Mock).');
        } else {
            await info('🚀 TEST MODE: Real booking.');
            await bookingPage.submitBooking();
            await page.waitForTimeout(3000);

            await info('--- Step 3: Cancellation Starting ---');
            await myApptsPage.navigateToFutureAppointments();
            await myApptsPage.expandFirstAppointment();
            await myApptsPage.cancelAppointment();
            await myApptsPage.confirmCancellation();
            await info('✅ Cancellation finished.');
        }

        await info('🎉 SESSION COMPLETED SUCCESSFULLY!');

    } catch (err) {
        await error(`💥 CRITICAL FAILURE: ${err.message}`);
        // צילום מסך לפני סגירת הדפדפן
        await takeScreenshot(page, `CRITICAL_FAILURE_${ENV}`);
        process.exitCode = 1;
    } finally {
        await info('🏁 Closing session.');
        await browser.close();
        await info('👋 Process finished.');
        
        // המתנה קלה לוודא שכל בקשות ה-Loki (fetch) הסתיימו
        await new Promise(r => setTimeout(r, 2000));
        process.exit(process.exitCode || 0);
    }
})();