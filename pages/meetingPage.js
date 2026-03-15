class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    async selectOption(optionText) {
        const option = this.page.getByText(optionText).last(); 
        const noResults = this.page.getByText('אין תוצאות חיפוש מתאימות').last();

        await option.or(noResults).waitFor({ state: 'visible', timeout: 15000 });

        if (await noResults.isVisible()) {
            throw new Error(`ENVIRONMENT_ERROR: אין נתונים עבור הערך "${optionText}"`);
        }

        await option.click();
        await this.page.waitForTimeout(1000); 
    }

    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar: Checking dates with step-refresh logic.');

        const cookieBtn = this.page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        try {
            await cookieBtn.click({ force: true, timeout: 3000 });
            await this.page.waitForTimeout(1000);
        } catch (e) {}

        let foundSlot = false;
        let monthLimit = 0; // הגבלה לחיפוש עד 4 חודשים קדימה

        while (!foundSlot && monthLimit < 4) {
            const daySelector = 'button.MuiPickersDay-root:not(.Mui-disabled):not(.MuiPickersDay-dayOutsideMonth)';
            
            // מחכים שהיומן יטען
            await this.page.waitForTimeout(1000);
            
            const allDays = this.page.locator(daySelector);
            const dayCount = await allDays.count();

            console.log(`🔎 Found ${dayCount} potentially available days this month.`);

            if (dayCount > 0) {
                let checkedDates = [];
                for (let i = 0; i < dayCount; i++) {
                    const day = allDays.nth(i);
                    const text = await day.innerText();
                    const dateNum = text.trim();

                    if (!dateNum.match(/^\d+$/) || checkedDates.includes(dateNum)) continue;

                    console.log(`🖱️ Clicking date: ${dateNum}`);
                    checkedDates.push(dateNum);

                    await day.click({ force: true, delay: 300 });

                    const timeSlots = this.page.locator('button, div')
                        .filter({ hasText: /^\d{1,2}:\d{2}$/ });

                    try {
                        // מחכים פחות זמן לכל יום כדי לרוץ מהר
                        await timeSlots.first().waitFor({ state: 'visible', timeout: 2500 });

                        const timeCount = await timeSlots.count();
                        if (timeCount > 0) {
                            console.log(`✅ Found ${timeCount} slots for ${dateNum}.`);
                            await timeSlots.first().click();
                            await this.page.waitForLoadState('networkidle');
                            foundSlot = true;
                            return;
                        }
                    } catch (e) {
                        console.log(`- No hours for ${dateNum}.`);
                    }
                }
            }

            // --- אם הגענו לכאן, לא נמצאו פגישות בחודש הנוכחי ---
            console.log('➡️ No slots this month. Looking for next month arrow...');
            
            // סלקטורים משופרים לחץ "החודש הבא"
            const nextMonthBtn = this.page.locator('button[aria-label="Next month"], button[aria-label="החודש הבא"], .MuiPickersArrowSwitcher-nextIconButton').first();

            if (await nextMonthBtn.isVisible()) {
                const isDisabled = await nextMonthBtn.isDisabled();
                if (isDisabled) {
                    throw new Error('❌ Next month button is disabled. No more appointments available.');
                }
                
                console.log('🚀 Clicking Next Month...');
                await nextMonthBtn.click({ force: true });
                await this.page.waitForTimeout(1500); // זמן לרינדור החודש החדש
                monthLimit++;
            } else {
                throw new Error('❌ Could not find the "Next Month" button on the calendar.');
            }
        }

        if (!foundSlot) {
            throw new Error('❌ Scanned multiple months but no available appointments were found.');
        }
    }

    async submitBooking() {
        console.log('🚀 Submitting booking via orange button...');

        const submitBtnLocator = this.page.locator('button.MuiButton-root')
             .filter({ hasText: /^זימון פגישה$/ })
             .last();

        await submitBtnLocator.waitFor({ state: 'visible', timeout: 30000 });
        
        console.log('⏳ Waiting a moment for React state to sync before clicking...');
        await this.page.waitForTimeout(2000);
        
        for (let i = 0; i < 3; i++) {
            await submitBtnLocator.click({ delay: 300, force: true }); 
            console.log(`✅ Clicked submit button (Attempt ${i + 1}).`);

            try {
                await this.page.waitForTimeout(3000);
                
                const isVisible = await submitBtnLocator.isVisible();
                if (!isVisible) {
                    console.log('✅ Button disappeared. Submission is processing...');
                    break;
                }

                const isDisabled = await submitBtnLocator.evaluate(
                    btn => btn.disabled || btn.getAttribute('aria-disabled') === 'true'
                ).catch(() => false);
                
                if (isDisabled) {
                    console.log('✅ Button is disabled/loading. Submission is processing...');
                    break;
                }

                console.log('🔄 Button is still active and visible. Clicking again...');
            } catch (e) {
                console.log('✅ Button detached from DOM. Submission is processing...');
                break;
            }
        }

        console.log('⏳ Finished submit sequence. Now waiting for server response...');
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