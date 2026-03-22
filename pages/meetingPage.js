class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    // פונקציה חדשה לטיפול בעוגיות כדי שנוכל לקרוא לה מכל מקום מוקדם ככל האפשר
    async dismissCookieBanner() {
        const cookieBtn = this.page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        try {
            await cookieBtn.waitFor({ state: 'visible', timeout: 3000 });
            await cookieBtn.click({ force: true });
            await this.page.waitForTimeout(500);
        } catch (e) {
            // הבאנר לא קיים, אפשר להמשיך
        }
    }

    async selectOption(optionText) {
        // סוגרים את העוגיות לפני שמנסים ללחוץ על אופציות כדי שלא יחסמו לנו את המסך
        await this.dismissCookieBanner();

        const option = this.page.getByText(optionText).last(); 
        const noResults = this.page.getByText('אין תוצאות חיפוש מתאימות').last();

        await option.or(noResults).waitFor({ state: 'visible', timeout: 15000 });

        if (await noResults.isVisible()) {
            throw new Error(`ENVIRONMENT_ERROR: אין נתונים עבור הערך "${optionText}"`);
        }

        // מוודא שהאלמנט גלוי לפני הלחיצה
        await option.scrollIntoViewIfNeeded();
        await option.click();
        await this.page.waitForTimeout(1000); 
    }

    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar: Checking dates with step-refresh logic.');

        // גיבוי ליתר ביטחון, במקרה והבאנר קפץ שוב
        await this.dismissCookieBanner();

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
                    // חשוב: דוגמים מחדש את הימים בכל איטרציה כי ברגע שנכנסים ויוצאים מדף הפעמים, ה-DOM נבנה מחדש
                    const currentDaysList = this.page.locator(daySelector);
                    const currentDayCount = await currentDaysList.count();
                    
                    if (i >= currentDayCount) break; // הגנת חריגה

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
                        console.log(`- No hours for ${dateNum}. Clicking back to calendar.`);
                        
                        // תוספת קריטית: לחיצה על כפתור "חזור" כדי לפתוח חזרה את היומן
                        const backBtn = this.page.getByText('חזור', { exact: true }).first();
                        try {
                            if (await backBtn.isVisible()) {
                                await backBtn.click({ force: true });
                                await this.page.waitForTimeout(1000); // ממתינים לרינדור של הלוח שנה בחזרה
                            }
                        } catch (backErr) {
                            console.log('⚠️ Could not click back button.');
                        }
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
        
        // סלקטור להודעות שגיאה שקופצות (כמו שגיאת כפילות תורים או תור תפוס)
        const errorPopupLocator = this.page.locator('text=שגיאה, text=כבר קיים תור, text=התור נתפס, text=409').first();

        for (let i = 0; i < 3; i++) {
            await submitBtnLocator.click({ delay: 300, force: true }); 
            console.log(`✅ Clicked submit button (Attempt ${i + 1}).`);

            try {
                // ממתינים קצת אחרי הלחיצה
                await this.page.waitForTimeout(3000);
                
                // בודקים אם קפצה שגיאה
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
            } catch (e) {
                 if(e.message.includes('System rejected the booking')) {
                     throw e; // מעבירים את השגיאה הלאה כדי שהסקריפט ייכשל מיד
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
            // ממתינים להצלחה או לשגיאה שצצה מאוחר
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