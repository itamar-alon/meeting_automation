class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    async selectOption(optionText) {
        const option = this.page.getByText(optionText).last(); 
        await option.waitFor({ state: 'visible', timeout: 15000 });
        await option.click();
        await this.page.waitForTimeout(1000); 
    }

    /**
     * סריקת לוח השנה: לוחץ על תאריך, ואם אין שעות - לוחץ על כותרת השלב וממשיך לבא.
     */
    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar: Checking dates with step-refresh logic.');

        // סגירת באנר עוגיות
        const cookieBtn = this.page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        if (await cookieBtn.isVisible().catch(() => false)) {
            await cookieBtn.click({ force: true });
            await this.page.waitForTimeout(1000);
        }

        let foundSlot = false;
        let checkedDates = [];

        while (!foundSlot) {
            const daySelector = 'button.MuiPickersDay-root:not(.Mui-disabled):not(.MuiPickersDay-dayOutsideMonth)';
            await this.page.waitForSelector(daySelector, { state: 'visible', timeout: 30000 });

            const allDays = this.page.locator(daySelector);
            const dayCount = await allDays.count();

            for (let i = 0; i < dayCount; i++) {
                const day = allDays.nth(i);
                const text = await day.innerText();
                const dateNum = text.trim();

                if (!dateNum.match(/^\d+$/) || checkedDates.includes(dateNum)) continue;

                console.log(`🖱️ Clicking date: ${dateNum}`);
                checkedDates.push(dateNum);

                await day.scrollIntoViewIfNeeded();
                await day.click({ force: true, delay: 300 });

                // חיפוש השעות שמופיעות (למשל 08:30)
                const timeSlots = this.page.locator('button, div')
                    .filter({ hasText: /^\d{1,2}:\d{2}$/ });

                try {
                    // המתנה חכמה של 4 שניות להופעת שעות
                    await timeSlots.first().waitFor({ state: 'visible', timeout: 4000 });

                    const timeCount = await timeSlots.count();
                    if (timeCount > 0) {
                        console.log(`✅ Found ${timeCount} slots for ${dateNum}.`);
                        await timeSlots.first().click();

                        // מחכה שהבחירה תעובד
                        await this.page.waitForLoadState('networkidle');

                        foundSlot = true;
                        return;
                    }
                } catch (e) {
                    console.log(`- No hours for ${dateNum}. Clicking step label to refresh...`);

                    const stepLabel = this.page.locator('.MuiStepLabel-root')
                        .filter({ hasText: 'מועדים פנויים לפגישה' });

                    await stepLabel.click({ force: true });
                    await this.page.waitForTimeout(800);
                }
            }

            const nextMonthBtn = this.page.locator('button[aria-label*="הבא"], [title*="הבא"]').first();
            if (await nextMonthBtn.isVisible()) {
                await nextMonthBtn.click();
                await this.page.waitForTimeout(2000);
                checkedDates = [];
            } else {
                throw new Error('❌ No slots found in calendar.');
            }
        }
    }

    async submitBooking() {
        console.log('🚀 Submitting booking via orange button...');

         const submitBtnLocator = this.page.locator('button.MuiButton-root')
             .filter({ hasText: /^זימון פגישה$/ })
             .last();

    // מחכים שהכפתור יהיה מופיע ב-viewport
         await submitBtnLocator.waitFor({ state: 'visible', timeout: 30000 });

    // מחכים שהאלמנט באמת מצוי ב-DOM וש־React סיים render
         const submitBtnHandle = await submitBtnLocator.elementHandle({ timeout: 20000 });
         if (!submitBtnHandle) {
                throw new Error('Submit button not found or not attached to DOM.');
         }

    // מחכים שהוא enabled
         await this.page.waitForFunction(
              btn => !btn.disabled && btn.getAttribute('aria-disabled') !== 'true',
             submitBtnHandle,
                { timeout: 20000, polling: 250 }
         );

    // לחיצה עם delay קטן כדי שה-React יקלט את האירוע
         await submitBtnHandle.click({ delay: 300 });

            console.log('✅ Clicked submit button. Now waiting for server response...');
        }

    async verifySuccessAndClose() {
        console.log('⏳ Verifying success message (Waiting up to 90s for slow server)...');

        const successHeader = this.page.locator('h4:has-text("פגישתך נקבעה בהצלחה")');

        await successHeader.waitFor({ state: 'visible', timeout: 90000 });
        console.log('✅ Success message detected!');

        const closeBtn = this.page.locator('button:has-text("סגירה")').first();
        await closeBtn.click({ force: true });

        await successHeader.waitFor({ state: 'hidden', timeout: 15000 });
    }
}

module.exports = { AppointmentsPage };