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

        // סגירת באנר עוגיות - שופר כדי למנוע Flakiness של isVisible
        const cookieBtn = this.page.locator('button:has-text("מאשר הכל"), button:has-text("אישור")');
        try {
            await cookieBtn.click({ force: true, timeout: 3000 });
            await this.page.waitForTimeout(1000);
        } catch (e) {
            // הבאנר לא הופיע, הכל בסדר, ממשיכים.
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

        // Playwright יודע לחכות בעצמו שהכפתור יהיה גלוי, זמין ומוכן ללחיצה.
        // הסרנו את ה-elementHandle שעושה בעיות עם רינדור מחדש של React.
        await submitBtnLocator.waitFor({ state: 'visible', timeout: 30000 });
        
        // המתנה קצרה כדי לתת למערכת לעדכן את הטופס שהשעה נבחרה בהצלחה
        console.log('⏳ Waiting a moment for React state to sync before clicking...');
        await this.page.waitForTimeout(2000);
        
        // click מוודא אוטומטית שהכפתור enabled ולא מקבל pointer-events: none
        await submitBtnLocator.click({ delay: 300, force: true }); 

        // מנגנון הגנה: אם הכפתור עדיין שם אחרי הלחיצה, נבצע לחיצה נוספת
        try {
            if (await submitBtnLocator.isVisible({ timeout: 1500 })) {
                console.log('🔄 Button still visible, executing a second click just in case...');
                await submitBtnLocator.click({ delay: 300, force: true });
            }
        } catch (e) {
            // הכל בסדר, הכפתור נעלם או שהדף התחלף
        }

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