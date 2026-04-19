class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    async dismissCookieBanner() {
        const cookieBtn = this.page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        try {
            await cookieBtn.waitFor({ state: 'visible', timeout: 3000 });
            await cookieBtn.click({ force: true });
            await this.page.waitForTimeout(500);
        } catch (e) {
        }
    }

    async triggerRefreshAndThrow(reason) {
        console.log(`🔄 מזהה תקיעה (${reason}) - מבצע רפרוש לדף...`);
        await this.page.reload({ waitUntil: 'networkidle' });
        throw new Error(`REFRESH_TRIGGERED: ${reason}`);
    }

    async selectOption(optionText) {
        await this.dismissCookieBanner();

        const option = this.page.getByText(optionText).last(); 
        const noResults = this.page.getByText('אין תוצאות חיפוש מתאימות').last();

        try {
            await option.or(noResults).waitFor({ state: 'visible', timeout: 15000 });
        } catch (e) {
            await this.triggerRefreshAndThrow(`Timeout waiting for option: ${optionText}`);
        }

        if (await noResults.isVisible()) {
            throw new Error(`ENVIRONMENT_ERROR: אין נתונים עבור הערך "${optionText}"`);
        }

        await option.scrollIntoViewIfNeeded();
        await option.click();
        await this.page.waitForTimeout(1000); 
    }

    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar: Checking dates with step-refresh logic.');

        await this.dismissCookieBanner();

        let foundSlot = false;
        let monthLimit = 0;
        let retries = 0; 

        while (!foundSlot && monthLimit < 4) {
            const daySelector = 'button.MuiPickersDay-root:not(.Mui-disabled):not(.MuiPickersDay-dayOutsideMonth)';
            
            let allDays = this.page.locator(daySelector);
            try {
                await allDays.first().waitFor({ state: 'visible', timeout: 10000 });
            } catch (e) {
                console.log('⏳ היומן לא נטען או שאין ימים פנויים החודש...');
                const skeletons = await this.page.locator('.MuiSkeleton-root').count();
                if (skeletons > 0 || retries > 1) {
                   await this.triggerRefreshAndThrow('Calendar stuck on loading skeletons');
                }
                retries++;
            }
            
            const dayCount = await allDays.count();

            console.log(`🔎 Found ${dayCount} potentially available days this month.`);

            if (dayCount > 0) {
                retries = 0; 
                let checkedDates = [];
                for (let i = 0; i < dayCount; i++) {
                    const currentDaysList = this.page.locator(daySelector);
                    const currentDayCount = await currentDaysList.count();
                    
                    if (i >= currentDayCount) break; 

                    const day = currentDaysList.nth(i);
                    const text = await day.innerText();
                    const dateNum = text.trim();

                    if (!dateNum.match(/^\d+$/) || checkedDates.includes(dateNum)) continue;

                    console.log(`🖱️ Clicking date: ${dateNum}`);
                    checkedDates.push(dateNum);

                    await day.click({ force: true, delay: 300 });

                    const timeSlots = this.page.locator('button, div')
                        .filter({ hasText: /^\d{1,2}:\d{2}$/ });

                    try {
                        await timeSlots.first().waitFor({ state: 'visible', timeout: 3500 }); 

                        const timeCount = await timeSlots.count();
                        if (timeCount > 0) {
                            console.log(`✅ Found ${timeCount} slots for ${dateNum}.`);
                            await timeSlots.first().click();
                            await this.page.waitForLoadState('networkidle');
                            foundSlot = true;
                            return;
                        }
                    } catch (e) {
                        console.log(`- No hours for ${dateNum}. Clicking back to calendar.`);
                        
                        const backBtn = this.page.getByText('חזור', { exact: true }).first();
                        try {
                            if (await backBtn.isVisible()) {
                                await backBtn.click({ force: true });
                                await this.page.waitForTimeout(1000); 
                            }
                        } catch (backErr) {
                            console.log('⚠️ Could not click back button.');
                        }
                    }
                }
            }

            if (!foundSlot) {
                console.log('➡️ No slots this month. Looking for next month arrow...');
                
                const nextMonthBtn = this.page.locator('button[aria-label="Next month"], button[aria-label="החודש הבא"], .MuiPickersArrowSwitcher-nextIconButton').first();

                if (await nextMonthBtn.isVisible()) {
                    const isDisabled = await nextMonthBtn.isDisabled();
                    if (isDisabled) {
                        throw new Error('❌ Next month button is disabled. No more appointments available.');
                    }
                    
                    console.log('🚀 Clicking Next Month...');
                    await nextMonthBtn.click({ force: true });
                    await this.page.waitForTimeout(1500); 
                    monthLimit++;
                } else {
                    throw new Error('❌ Could not find the "Next Month" button on the calendar.');
                }
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

        try {
            await submitBtnLocator.waitFor({ state: 'visible', timeout: 30000 });
        } catch (e) {
            await this.triggerRefreshAndThrow('Submit button never appeared');
        }
        
        console.log('⏳ Waiting a moment for React state to sync before clicking...');
        await this.page.waitForTimeout(2000);
        
        const errorPopupLocator = this.page.locator('text=שגיאה, text=כבר קיים תור, text=התור נתפס, text=409').first();

        for (let i = 0; i < 3; i++) {
            await submitBtnLocator.click({ delay: 300, force: true }); 
            console.log(`✅ Clicked submit button (Attempt ${i + 1}).`);

            try {
                await this.page.waitForTimeout(3000);
                
                const hasError = await errorPopupLocator.isVisible().catch(() => false);
                if (hasError) {
                     const errorText = await errorPopupLocator.innerText().catch(() => 'Unknown Error');
                     throw new Error(`System rejected the booking. Reason: ${errorText}`);
                }

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
                
                if (i === 2) {
                    await this.triggerRefreshAndThrow('Submit button clicked multiple times but system is completely unresponsive');
                }

            } catch (e) {
                 if(e.message.includes('System rejected the booking') || e.message.includes('REFRESH_TRIGGERED')) {
                     throw e; 
                 }
                console.log('✅ Button detached from DOM. Submission is processing...');
                break;
            }
        }

        console.log('⏳ Finished submit sequence. Now waiting for server response...');
    }

    async verifySuccessAndClose() {
        console.log('⏳ Verifying success message (Waiting up to 90s for slow server)...');

        const successHeader = this.page.locator('h4:has-text("פגישתך נקבעה בהצלחה")');
        const generalErrorLocator = this.page.locator('text=שגיאה מערכתית, text=אירעה תקלה').first();

        try {
            await Promise.race([
                successHeader.waitFor({ state: 'visible', timeout: 90000 }),
                generalErrorLocator.waitFor({ state: 'visible', timeout: 90000 }).then(() => {
                    throw new Error('System displayed an error message instead of success.');
                })
            ]);
            
            console.log('✅ Success message detected!');
            
            const closeBtn = this.page.locator('button:has-text("סגירה")').first();
            await closeBtn.click({ force: true });
            
            await successHeader.waitFor({ state: 'hidden', timeout: 15000 });

        } catch (e) {
             throw new Error(`Verification failed. Details: ${e.message}`);
        }
    }
}

module.exports = { AppointmentsPage };