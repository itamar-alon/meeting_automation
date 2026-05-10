const { expect } = require('@playwright/test');

class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    async setupAppointmentMock() {
        await this.page.route('**/SetAppointment*', async route => {
            console.log("🛡️ INITIATING MOCK: Intercepted real appointment request!");
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    SetAppointmentData: { ServiceId: 262, DateAndTime: "2026-04-01T08:30:00" },
                    ScriptResults: { Messages: [], ReturnCode: 0 },
                    CaseId: 1813505,
                    ProcessId: 1813214,
                    AppointmentId: 204169,
                    CalendarId: 91583,
                    QNumber: 0,
                    QCode: "",
                    CustomerTreatmentPlanId: 0
                })
            });
            console.log("✅ MOCK SUCCESS: Injected fake confirmation response.");
        });
    }

    async dismissCookieBanner() {
        const cookieBtn = this.page.getByRole('button', { name: 'מאשר הכל' });
        if (await cookieBtn.isVisible({ timeout: 5000 })) {
            await cookieBtn.click();
            await cookieBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
            console.log("✅ Cookie banner cleared.");
        }
    }

    async dismissInitialPopup() {
        const globalContinueBtn = this.page.getByRole('button', { name: 'המשך' }).first();
        if (await globalContinueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
            await globalContinueBtn.click({ force: true });
            console.log("✅ Initial informational popup cleared.");
        }
    }

    async completeInitialWizardSteps() {
        let wizardReady = false;

        for (let wizardAttempt = 1; wizardAttempt <= 3; wizardAttempt++) {
            console.log(`Navigating to Appointments wizard (Attempt ${wizardAttempt}/3)...`);
            
            await this.page.goto('/'); 
            await this.page.waitForLoadState('domcontentloaded');
            await this.dismissCookieBanner();
            await this.dismissInitialPopup();
            
            const appointmentsTile = this.page.getByText(/פגישות|זימון תורים/).first();
            await appointmentsTile.click();
            await this.page.waitForLoadState('networkidle').catch(() => {});

            let errorInSteps = false;

            for (let step = 1; step <= 3; step++) {
                console.log(`Selecting option for Step ${step}...`);
                await this.page.waitForTimeout(2000); 
                
                const noResultsMsg = this.page.getByText('אין תוצאות חיפוש מתאימות').first();
                if (await noResultsMsg.isVisible()) {
                    console.log(`⚠️ 'No matching results' found at Step ${step}. Refreshing the flow...`);
                    errorInSteps = true;
                    break; 
                }

                try {
                    const activeStepContent = this.page.locator('.MuiStepContent-root:visible').last();
                    const optionToClick = activeStepContent.locator('div[role="button"], li.MuiListItem-root, input[type="radio"] + *').first();
                    
                    await expect(optionToClick).toBeVisible({ timeout: 10000 });
                    await optionToClick.click({ force: true });
                    await this.page.waitForLoadState('networkidle').catch(() => {});
                } catch (err) {
                    console.log(`⚠️ Step ${step} failed to load options properly. Refreshing the flow...`);
                    errorInSteps = true;
                    break;
                }
            }

            if (!errorInSteps) {
                wizardReady = true;
                break; 
            }
        }

        if (!wizardReady) {
            throw new Error("Failed to load appointment wizard options after 3 reloads. API might be down.");
        }
    }

    async findAndPickAvailableAppointment() {
        console.log("Handling dynamic dates and times...");
        let appointmentFound = false;
        let monthsChecked = 0;

        while (!appointmentFound && monthsChecked < 3) {
            await this.page.waitForSelector('.MuiSkeleton-root', { state: 'hidden', timeout: 15000 }).catch(() => {});
            await this.page.waitForTimeout(3000); 
        
        const daysLocator = this.page.locator('button.MuiPickersDay-root:visible:not(.Mui-disabled):not(.MuiPickersDay-hiddenDaySpacingFiller)');
        const datesCount = await daysLocator.count();
            console.log(`🔍 Found ${datesCount} available dates in current month.`);

            for (let i = 0; i < datesCount; i++) {
                await this.page.waitForTimeout(1000); 
                
                const dateBtn = daysLocator.nth(i);
                
                try {
                    await expect(dateBtn).toBeVisible({ timeout: 10000 });
                    await dateBtn.evaluate(el => el.style.border = '3px solid yellow');
                    console.log(`🗓️ Clicking date #${i + 1} of ${datesCount}...`);
                    await dateBtn.click({ force: true });
                } catch (e) {
                    console.log(`⚠️ Could not interact with date #${i + 1}. Moving to the next date...`);
                    continue; 
                }

                await this.page.waitForTimeout(2500); 

                const timeSlots = this.page.locator('button:visible, div[role="button"]:visible, span.MuiChip-root:visible')
                    .filter({ hasText: /^\d{1,2}:\d{2}$/ })
                    .filter({ hasNot: this.page.locator('[disabled], .Mui-disabled') });
                
                const slotsCount = await timeSlots.count();
                if (slotsCount > 0) {
                    console.log(`✅ Found ${slotsCount} visible time slots! Selecting the first one...`);
                    await timeSlots.first().click({ force: true });
                    appointmentFound = true;
                    break; 
                } else {
                    console.log(`ℹ️ Date #${i + 1} has no times available.`);
                    
                    const backBtn = this.page.getByText('חזור').first();
                    if (await backBtn.isVisible({ timeout: 3000 })) {
                        console.log("🔙 Clicking 'Back' to return to the calendar view...");
                        await backBtn.click({ force: true });
                        await this.page.waitForTimeout(2000); 
                    } else {
                        const step4Header = this.page.getByText('מועדים פנויים לפגישה').first();
                        if (await step4Header.isVisible()) {
                            console.log("🔙 Clicking Step 4 Header to reopen calendar...");
                            await step4Header.click({ force: true });
                            await this.page.waitForTimeout(2000);
                        }
                    }
                    console.log("Moving to the next available date...");
                    continue; 
                }
            }

            if (!appointmentFound) {
                console.log("⏩ Month finished without results. Moving to Next Month...");
                const nextMonthBtn = this.page.locator('svg[data-testid="ChevronLeftIcon"]:visible').first().locator('..');
                try {
                    if (await nextMonthBtn.isVisible({ timeout: 5000 })) {
                        await nextMonthBtn.click({ force: true });
                        monthsChecked++;
                        await this.page.waitForTimeout(2000); 
                    } else {
                        console.log("❌ No Next Month button available.");
                        break; 
                    }
                } catch (err) {
                    console.log("❌ Failed to click Next Month.");
                    break;
                }
            }
        }

        if (!appointmentFound) {
            throw new Error("Could not find any available appointments in the next 3 months.");
        }
    }

async submitBooking() {
    console.log("Submitting appointment request...");

    const submitBtn = this.page.locator('button.MuiButton-containedWarning')
        .filter({ hasText: 'זימון פגישה' })
        .first();
    
    await expect(submitBtn).toBeVisible({ timeout: 20000 });
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    
    const responsePromise = this.page.waitForResponse(response => 
        response.url().includes('SetAppointment') && response.status() === 200,
        { timeout: 90000 } 
    ).catch(() => null);

    await submitBtn.evaluate(el => el.style.outline = '5px solid blue');
    
    console.log("🖱️ Clicking the confirmed orange button...");
    await this.page.waitForTimeout(1000);
    await submitBtn.click({ force: true, delay: 100 });
    
    const response = await responsePromise;
    if (!response) {
        console.log("⚠️ Server did not respond to SetAppointment call in time.");
        throw new Error("Server failed to respond to SetAppointment within 90 seconds.");
    }
}

    async verifySuccess() {
        console.log("Verifying success message...");
        
        const successMessage = this.page.getByText('פגישתך נקבעה בהצלחה').first();
        
        try {
            await expect(successMessage).toBeVisible({ timeout: 30000 });
            console.log("🎉 Appointment flow completed successfully.");
        } catch (err) {
            console.log("❌ Success message not found. Capturing state...");
            throw new Error("Confirmation message did not appear. Check server latency.");
        }

        const closeBtn = this.page.getByRole('button', { name: 'סגירה' });
        if (await closeBtn.isVisible({ timeout: 5000 })) {
            await closeBtn.click();
            await this.page.waitForTimeout(2000); 
        }
    }
}

module.exports = { AppointmentsPage };