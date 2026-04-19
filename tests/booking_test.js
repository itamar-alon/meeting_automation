require('dotenv').config();
const { chromium } = require('playwright');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV = (process.env.TEST_ENV || 'TEST').toUpperCase();
const LOKI_URL = 'http://10.77.72.45:3100/loki/api/v1/push';
const JOB_NAME = 'meeting_automation';
const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const SCREEN_DIR = path.resolve(LOG_DIR, 'screenshots');
const AUTH_PATH = path.resolve(__dirname, `auth_state_${ENV}.json`);

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

function killOldProcesses() {}

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

(async () => {
    const INTERCEPT_MODE = ENV === 'PROD';
    let browser, page, context;

    try {
        const { LoginPage } = require('../pages/loginPage.js');
        const { AppointmentsPage } = require('../pages/meetingPage.js');
        const { MyAppointmentsPage } = require('../pages/myMeetingsPage.js');

        const BASE_URL = ENV === 'PROD' ? 'https://my.rishonlezion.muni.il' : 'https://mytest.rishonlezion.muni.il';
        const DEPT = ENV === 'PROD' ? 'מנהל החינוך' : 'אגף הכנסות';
        const SERVICE = ENV === 'PROD' ? 'גני ילדים - רישום/ביטול רישום' : 'אישורים לטאבו - מוזמנים';

        info(`🚀 STARTING SESSION | Env: ${ENV}`);

        browser = await chromium.launch({ 
            headless: true, 
            slowMo: 100,
            args: [
                '--no-sandbox', 
                '--disable-dev-shm-usage'
            ]
        });

        let storageState = fs.existsSync(AUTH_PATH) ? AUTH_PATH : undefined;
        
        context = await browser.newContext({ 
            viewport: { width: 1280, height: 720 }, 
            ignoreHTTPSErrors: true,
            storageState: storageState 
        });

        page = await context.newPage();
        page.setDefaultTimeout(60000); 

        const loginPage = new LoginPage(page);
        const bookingPage = new AppointmentsPage(page);
        const myApptsPage = new MyAppointmentsPage(page);

        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        
        const cookieBtn = page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        if (await cookieBtn.isVisible({ timeout: 3000 })) await cookieBtn.click({ force: true });

        const isAlreadyLoggedIn = await loginPage.checkIfLoggedIn();

        if (!isAlreadyLoggedIn) {
            info('🔑 No valid session found. Performing login...');
            
            await loginPage.performMainLogin(process.env.USER_ID, process.env.USER_PASS);
            await page.waitForLoadState('networkidle');
            
            await context.storageState({ path: AUTH_PATH });
            info(`💾 Session saved to auth_state_${ENV}.json`);
        } else {
            info('✅ Session restored from storage. Skipping login.');
        }

        await loginPage.navigateToAppointments();
        await page.waitForLoadState('networkidle');

        let attempt = 0;
        const maxAttempts = 3;
        let sessionCompleted = false;

        while (attempt < maxAttempts && !sessionCompleted) {
            attempt++;
            try {
                if (attempt > 1) {
                    info(`\n--- 🔄 מתחיל ניסיון התאוששות ${attempt}/${maxAttempts} ---`);
                }

                await bookingPage.selectOption(DEPT);
                await bookingPage.selectOption(SERVICE);
                try { await bookingPage.selectOption('טלפוני'); } catch (e) {}
                
                await bookingPage.findAndPickAvailableAppointment();

                if (INTERCEPT_MODE) {
                    await page.route('**/SetAppointment*', route => route.fulfill({
                        status: 200, 
                        contentType: 'application/json',
                        body: JSON.stringify({
                            "SetAppointmentData": {
                                "ParentCaseId": 0, "ServiceId": 124, "DateAndTime": "2026-04-16T10:10:00", 
                                "UserId": 519, "CustomerId": 211531, "AppointmentTypeId": 0, "Subject": null, 
                                "Notes": null, "ExtRef": null, "ClassificationIds": null, "PreventAutoQueue": false, 
                                "LanguageCode": "he", "IsWalkIn": false, "ForceSimultaneousAppointment": true, 
                                "ForceWastedDuration": false, "AutoFreeUp": false, "SlotOrdinalNumber": 0, 
                                "CalendarId": 0, "Resources": null, "BasedOnAppointmentRequestId": 0, 
                                "Duration": 0, "SimulationOnly": false, "ForceNoDynamicVacancy": false, 
                                "TreatmentPlanId": 0, "TreatmentPlanStepId": 0, "CustomerTreatmentPlanId": 0, 
                                "ExistingProcessId": 0, "ActOptionId": 0, "CustomProperties": {"1": "PHONE"}
                            },
                            "ScriptResults": { "Messages": [], "ReturnCode": 0 },
                            "CaseId": 1559557,
                            "ProcessId": 1559416,
                            "AppointmentId": 117393,
                            "CalendarId": 80802,
                            "QNumber": 0,
                            "QCode": "",
                            "CustomerTreatmentPlanId": 0
                        })
                    }));
                }

                info('🚀 Submitting booking...');
                const bookingStartTime = performance.now();

                await bookingPage.submitBooking();

                await bookingPage.verifySuccessAndClose();
                const bookingDuration = Math.round(performance.now() - bookingStartTime);
                info('✅ Booking confirmed successfully', bookingDuration);

                if (!INTERCEPT_MODE) {
                    info('--- Step 3: Cancellation Starting ---');
                    const futureApptsTab = page.locator('button[role="tab"][aria-label*="פגישות עתידיות"]');
                    
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
                
                sessionCompleted = true;

            } catch (err) {
                if (err.message.includes('REFRESH_TRIGGERED')) {
                    info(`⚠️ השרת נתקע ובוצע רפרוש. מתחיל סבב מחדש (ניסיון ${attempt} מתוך ${maxAttempts})...`);
                    await page.waitForTimeout(2000); 
                    continue; 
                } else if (err.message.includes('System rejected the booking')) {
                    info(`❌ המערכת דחתה את התור (כנראה נתפס בינתיים). נרפרש ונתחיל חיפוש חדש (ניסיון ${attempt} מתוך ${maxAttempts})...`);
                    await page.reload({ waitUntil: 'networkidle' });
                    continue; 
                } else if (err.message.includes('No slots found') || 
                           err.message.includes('ENVIRONMENT_ERROR') || 
                           err.message.includes('אין נתונים') ||
                           err.message.includes('no available appointments') || 
                           err.message.includes('No more appointments')) {
                    
                    info(`⚠️ ENVIRONMENT ALERT: ${err.message}. Ending session gracefully.`);
                    return; 
                }
                
                throw err;
            }
        }

        if (!sessionCompleted) {
            throw new Error(`❌ נכשלנו לאחר ${maxAttempts} ניסיונות עקב תקיעות מערכת או דחיות.`);
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