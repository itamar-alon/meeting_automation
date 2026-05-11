require('dotenv').config();
const { test, expect } = require('@playwright/test');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

const LOKI_URL = 'http://10.77.72.45:3100/loki/api/v1/push';
const JOB_NAME = 'meeting_automation';
const LOG_DIR = path.resolve(__dirname, '..', 'logs');
const SCREEN_DIR = path.resolve(LOG_DIR, 'screenshots');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
if (!fs.existsSync(SCREEN_DIR)) fs.mkdirSync(SCREEN_DIR, { recursive: true });

const logFileName = `detailed_log_${new Date().toISOString().split('T')[0]}.txt`;
const logFilePath = path.join(LOG_DIR, logFileName);

let lastTimestamp = 0;

function cleanupOldFiles(directory, daysToKeep = 7) {
    if (!fs.existsSync(directory)) return;

    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const threshold = daysToKeep * msPerDay;

    const files = fs.readdirSync(directory);
    files.forEach(file => {
        const filePath = path.join(directory, file);
        try {
            const stats = fs.statSync(filePath);
            const age = now - stats.mtimeMs;

            if (age > threshold) {
                fs.unlinkSync(filePath);
                writeToLogs('SYSTEM', 'INFO', `🗑️ Deleted old file: ${file}`);
            }
        } catch (e) {
            writeToLogs('SYSTEM', 'ERROR', `❌ Failed to delete ${file}: ${e.message}`);
        }
    });
}

function writeToLogs(env, level, msg) {
    const timestamp = new Date().toLocaleTimeString('he-IL', { hour12: false });
    const formattedMsg = `[${timestamp}] [${env}] [${level}] ${msg}`;
    console.log(formattedMsg);
    fs.appendFileSync(logFilePath, formattedMsg + '\n', 'utf8');
}

async function sendCourierErrorEmail(env, errorMessage, screenshotPath = null) {
    const courierToken = process.env.COURIER_AUTH_TOKEN;
    const targetEmail = process.env.ALERT_EMAIL_ADDRESS;

    if (!courierToken || !targetEmail) {
        writeToLogs(env, 'WARN', '⚠️ חסרים נתוני Courier ב-.env. מדלג על שליחת אימייל.');
        return;
    }

    const screenshotHtml = screenshotPath && fs.existsSync(screenshotPath)
        ? `<img src="data:image/png;base64,${fs.readFileSync(screenshotPath).toString('base64')}" style="max-width:100%; border:1px solid #ccc;">`
        : '<p style="color: #999;">לא נוצר צילום מסך</p>';

    const payload = {
        message: {
            to: { email: targetEmail },
            template: "R7KTSBP8AF407EN9EJTKXK44P32K",
            data: {
                env: env,
                timestamp: new Date().toLocaleString('he-IL'),
                errorMessage: errorMessage,
                screenshotHtml: screenshotHtml
            }
        }
    };

    try {
        const res = await fetch('https://api.courier.com/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${courierToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        writeToLogs(env, 'INFO', '📧 התראת אימייל נשלחה בהצלחה דרך Courier.');
    } catch (e) {
        writeToLogs(env, 'ERROR', `❌ שליחת אימייל דרך Courier נכשלה: ${e.message}`);
    }
}

async function sendToLoki(env, level, message, durationMs = null, retries = 3) {
    let now = Date.now() * 1_000_000;
    if (now <= lastTimestamp) now = lastTimestamp + 1; 
    lastTimestamp = now;
    const ts = now.toString();

    let logMessage = message;
    if (durationMs !== null) logMessage += ` | duration_ms=${durationMs}`;

    const payload = {
        streams: [{
            stream: { job: JOB_NAME, severity: level, target_env: env, has_metrics: durationMs !== null ? "true" : "false" },
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

const info = (env, msg, duration = null) => {
    writeToLogs(env, 'INFO', `${msg}${duration !== null ? ` (${duration}ms)` : ''}`);
    let finalMsg = msg.includes('COMPLETED SUCCESSFULLY') ? `SUCCESS | ${msg}` : msg;
    sendToLoki(env, 'info', finalMsg, duration);
};

const error = async (env, msg, screenshotPath = null) => {
    writeToLogs(env, 'ERROR', msg);
    await sendToLoki(env, 'error', msg);
    await sendCourierErrorEmail(env, msg, screenshotPath);
};

async function takeScreenshot(env, page, step) {
    try {
        if (!page || page.isClosed()) return;
        const fileName = `FAIL_${env}_${step}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
        await page.screenshot({ path: path.join(SCREEN_DIR, fileName), fullPage: true });
        info(env, `📸 Screenshot_Saved: ${fileName}`);
    } catch (e) { console.error(`⚠️ Screenshot failed: ${e.message}`); }
}

const ENVIRONMENTS = ['TEST', 'PROD'];

for (const ENV of ENVIRONMENTS) {
    test(`meeting - ${ENV}`, async ({ browser, browserName }) => {
        test.skip(browserName !== 'chromium', 'Running only on Chrome/Chromium');

        const separator = `\n${'='.repeat(60)}\n🌍 ENVIRONMENT: ${ENV}\n${'='.repeat(60)}\n`;
        fs.appendFileSync(logFilePath, separator, 'utf8');
        test.setTimeout(120000); 
        const INTERCEPT_MODE = ENV === 'PROD'; 
        const AUTH_PATH = path.resolve(__dirname, `auth_state_${ENV}.json`);
        let context, page;

        try {
            const { LoginPage } = require('../pages/loginPage.js');
            const { AppointmentsPage } = require('../pages/meetingPage.js');
            const { MyAppointmentsPage } = require('../pages/myMeetingsPage.js');

            const BASE_URL = ENV === 'PROD' ? 'https://my.rishonlezion.muni.il' : 'https://mytest.rishonlezion.muni.il';

            info(ENV, `🚀 STARTING SESSION | Env: ${ENV} | Attempt: ${test.info().retry + 1}`);

            let storageState = fs.existsSync(AUTH_PATH) ? AUTH_PATH : undefined;
            context = await browser.newContext({ 
                viewport: { width: 1280, height: 720 }, 
                ignoreHTTPSErrors: true,
                storageState: storageState,
                baseURL: BASE_URL 
            });

            page = await context.newPage();
            page.setDefaultTimeout(30000); 

            const loginPage = new LoginPage(page);
            const bookingPage = new AppointmentsPage(page);
            const myApptsPage = new MyAppointmentsPage(page);

            await page.goto('/', { waitUntil: 'domcontentloaded' }); 
            await bookingPage.dismissCookieBanner();

            const isAlreadyLoggedIn = await loginPage.checkIfLoggedIn();
            if (!isAlreadyLoggedIn) {
                info(ENV, '🔑 Performing fresh login...');
                await loginPage.performMainLogin(process.env.USER_ID, process.env.USER_PASS);
                await page.waitForLoadState('networkidle');
                await context.storageState({ path: AUTH_PATH });
                info(ENV, `💾 Session saved.`);
            } else {
                info(ENV, '✅ Session restored.');
            }

            let attempt = 0;
            const maxAttempts = 3;
            let sessionCompleted = false;

            while (attempt < maxAttempts && !sessionCompleted) {
                attempt++;
                try {
                    if (attempt > 1) info(ENV, `--- 🔄 Recovery Attempt ${attempt}/${maxAttempts} ---`);
                    if (INTERCEPT_MODE) await bookingPage.setupAppointmentMock();

                    info(ENV, 'Step 1: Running Wizard steps...');
                    await bookingPage.completeInitialWizardSteps();

                    info(ENV, 'Step 2: Scanning calendar for slots...');
                    await bookingPage.findAndPickAvailableAppointment();

                    info(ENV, 'Step 3: Submitting booking...');
                    const bookingStartTime = performance.now();
                    await bookingPage.submitBooking(); 
                    await bookingPage.verifySuccess();
                    const bookingDuration = Math.round(performance.now() - bookingStartTime);
                    info(ENV, `✅ Booking confirmed successfully`, bookingDuration);

                    if (!INTERCEPT_MODE) {
                        info(ENV, 'Step 5: Cancellation Starting (Cleanup)...');
                        await bookingPage.dismissCookieBanner();
                        await myApptsPage.navigateToFutureAppointments();
                        await myApptsPage.expandFirstAppointment();
                        await myApptsPage.cancelAppointment();
                        await myApptsPage.confirmCancellation();
                        info(ENV, '✅ Cancellation finished.');
                    }
                    sessionCompleted = true;
                } catch (err) {
                    if (err.message.includes('REFRESH_TRIGGERED') || err.message.includes('System rejected') || err.message.includes('timeout')) {
                        info(ENV, `⚠️ ${err.message}. Navigating to Home for soft-reset...`);
                        try {
                            const homeBtn = page.getByRole('button', { name: 'חזרה לדף הבית' });
                            if (await homeBtn.isVisible({ timeout: 5000 })) {
                                await homeBtn.click();
                                await page.waitForLoadState('networkidle');
                            } else {
                                await page.goto('/', { waitUntil: 'networkidle' });
                            }
                        } catch (navErr) { await page.goto('/', { waitUntil: 'domcontentloaded' }); }
                        continue; 
                    } else if (err.message.includes('ENVIRONMENT_ERROR') || err.message.includes('no available appointments')) {
                        info(ENV, `⚠️ ENVIRONMENT ALERT: ${err.message}. Ending session.`);
                        return; 
                    }
                    throw err; 
                }
            }

            if (!sessionCompleted) throw new Error(`❌ Failed after ${maxAttempts} attempts.`);
            info(ENV, '🎉 SESSION COMPLETED SUCCESSFULLY!');

        } catch (err) {
            const isLastRetry = test.info().retry === test.info().project.retries;
    
            let screenshotPath = null;
            if (page && !page.isClosed()) {
              const fileName = `FAIL_${ENV}_FAILURE_ATTEMPT_${test.info().retry + 1}_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
              screenshotPath = path.join(SCREEN_DIR, fileName);
             await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => { screenshotPath = null; });
             }

             if (isLastRetry) {
                 await error(ENV, `💥 CRITICAL FAILURE (Final Attempt): ${err.message}`, screenshotPath);
             } else {
             info(ENV, `⚠️ Attempt ${test.info().retry + 1} failed, retrying... | Error: ${err.message}`);
             }
             throw err;
        }
    });
}