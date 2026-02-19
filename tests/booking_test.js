require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- הגדרות נתיבים ---
const LOKI_URL = 'http://10.77.72.45:3100/loki/api/v1/push';
const JOB_NAME = 'meeting_automation';

const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const SCREEN_DIR = path.resolve(LOG_DIR, 'screenshots');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

// --- פונקציית שליחה ל-Loki ---
async function sendToLoki(level, message, retries = 3) {
    const ts = (Date.now() * 1_000_000).toString();
    const payload = {
        streams: [{
            stream: { job: JOB_NAME, severity: level, target_env: process.env.TEST_ENV || 'TEST' },
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
            if (attempt === retries) console.error(`❌ Loki failure: ${e.message}`);
            else await new Promise(r => setTimeout(r, 1000));
        }
    }
}

async function log(level, message) {
    const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    await sendToLoki(level, message);
}

const info = msg => log('info', msg);
const warn = msg => log('warn', msg);
const error = msg => log('error', msg);

// --- פונקציית צילום מסך ---
async function takeScreenshot(page, step) {
    try {
        if (!page || page.isClosed()) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `FAIL_${step}_${timestamp}.png`;
        const filePath = path.join(SCREEN_DIR, fileName);
        
        await page.screenshot({ path: filePath, fullPage: true });
        await info(`📸 Screenshot_Saved: ${fileName}`);
    } catch (e) {
        await warn(`⚠️ Screenshot failed: ${e.message}`);
    }
}

// --- Main Script ---
(async () => {
    const ENV = (process.env.TEST_ENV || 'TEST').toUpperCase();
    const INTERCEPT_MODE = ENV === 'PROD';
    let browser, page;

    try {
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

        browser = await chromium.launch({ 
            headless: false, 
            slowMo: 300,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ] 
        });
        
        const context = await browser.newContext({ 
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true 
        });
        page = await context.newPage();
        
        page.setDefaultTimeout(60000); 

        const loginPage = new LoginPage(page);
        const bookingPage = new AppointmentsPage(page);
        const myApptsPage = new MyAppointmentsPage(page);

        await info(`🚀 STARTING SESSION | Env: ${ENV} | Dept: ${DEPARTMENT_NAME}`);

        // --- Login ---
        await info('--- Step 1: Login Process Starting ---');
        try {
            await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
        } catch (e) {
            await warn('Initial navigation failed, retrying...');
            await page.reload({ waitUntil: 'networkidle' });
        }

        // --- טיפול בבאנר עוגיות (קריטי לפני לחיצה על כניסה) ---
        const cookieAcceptBtn = page.locator('button:has-text("מאשר הכל"), button:has-text("אישור"), #onetrust-accept-btn-handler');
        try {
            if (await cookieAcceptBtn.isVisible({ timeout: 10000 })) {
                await info('🍪 Cookie banner detected, clicking accept...');
                await cookieAcceptBtn.click();
                await page.waitForTimeout(1500); // המתנה להיעלמות האנימציה של הבאנר
            }
        } catch (e) {
            await warn('Cookie banner skip or not found.');
        }

        // --- לחיצה על כפתור כניסה ---
        await info('🖱️ Attempting to click login button...');
        const loginBtn = page.locator('button[aria-label*="פתיחת מסך"], button:has-text("כניסה")').first();
        
        await loginBtn.waitFor({ state: 'visible', timeout: 20000 });
        await loginBtn.click();
        
        // וידוא שהגענו למסך הלוגין
        await page.waitForSelector('text=באמצעות סיסמה', { state: 'visible', timeout: 30000 });
        await loginPage.performMainLogin(process.env.USER_ID, process.env.USER_PASS);
        
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000); 
        
        await loginPage.navigateToAppointments();
        await info('✅ Login completed.');

        // --- Booking Flow ---
        await info('--- Step 2: Selection Flow Starting ---');
        await bookingPage.selectOption(DEPARTMENT_NAME);
        await bookingPage.selectOption(SERVICE_NAME);
        
        try {
            await page.waitForTimeout(2000);
            await bookingPage.selectOption('טלפוני');
        } catch (e) {
            await warn('Could not find "טלפוני", trying alternative or continuing...');
        }
        
        await info('📅 Scanning for available appointments...');
        
        await page.waitForSelector('.day, .cell, [role="gridcell"], td', { state: 'attached', timeout: 30000 });
        await page.waitForTimeout(2000); 
        
        // עטיפת הניסיון ב-try/catch כדי שההתרסקות מה-Page Object תקבל תיעוד מדוייק
        try {
            await bookingPage.findAndPickAvailableAppointment();
        } catch (bookingErr) {
            await warn(`Appointment scanning failed internally. Calendar DOM might have reset after clicking 'Back'.`);
            throw bookingErr;
        }

        if (INTERCEPT_MODE) {
            await info('🛑 PROD MODE: Interceptor Active.');
            await page.route('**/SetAppointment*', async route => {
                await info(`✋ INTERCEPTED: ${route.request().url()}`);
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ "CaseId": 12345, "ScriptResults": { "ReturnCode": 0 } })
                });
            });
        }

        await bookingPage.submitBooking();
        
        if (!INTERCEPT_MODE) {
            await info('--- Step 3: Cancellation Starting ---');
            await page.waitForTimeout(5000); 
            
            await myApptsPage.navigateToFutureAppointments();
            await page.waitForLoadState('networkidle');
            
            let isVisible = false;
            for (let i = 0; i < 3; i++) {
                isVisible = await page.locator('text=נושא:').first().isVisible({ timeout: 5000 }).catch(() => false);
                if (isVisible) break;
                await info(`⚠️ Attempt ${i+1}: Appointment list not visible, waiting...`);
                await page.reload({ waitUntil: 'networkidle' });
                await page.waitForTimeout(3000);
            }

            if (isVisible) {
                await myApptsPage.expandFirstAppointment();
                await myApptsPage.cancelAppointment();
                await myApptsPage.confirmCancellation();
                await info('✅ Cancellation finished.');
            } else {
                await error('❌ Failed to find appointments for cancellation after retries.');
            }
        }

        await info('🎉 SESSION COMPLETED SUCCESSFULLY!');

    } catch (err) {
        await error(`💥 CRITICAL FAILURE: ${err.message}`);
        if (page) await takeScreenshot(page, `FAILURE_${ENV}`);
        process.exitCode = 1;
    } finally {
        if (browser) {
            await info('🏁 Closing session.');
            await browser.close();
        }
        await info('👋 Process finished.');
        setTimeout(() => process.exit(process.exitCode || 0), 2000);
    }
})();