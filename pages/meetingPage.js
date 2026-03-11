class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    async selectOption(optionText) {
        const option = this.page.getByText(optionText).last(); 
        const noResults = this.page.getByText('אין תוצאות חיפוש מתאימות').last();

        // Playwright ימתין עד שאו שהאופציה תופיע, או שהודעת "אין תוצאות" תופיע
        await option.or(noResults).waitFor({ state: 'visible', timeout: 15000 });

        // אם ההודעה של אין תוצאות מופיעה על המסך, נזרוק מיד שגיאה חכמה שתסווג כתקלת סביבה
        if (await noResults.isVisible()) {
            throw new Error(`ENVIRONMENT_ERROR: אין נתונים עבור הערך "${optionText}"`);
        }

        // אחרת, האופציה נמצאה ונלחץ עליה כרגיל
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
        await submitBtnLocator.waitFor({ state: 'visible', timeout: 30000 });
        
        // המתנה קצרה כדי לתת למערכת לעדכן את הטופס שהשעה נבחרה בהצלחה
        console.log('⏳ Waiting a moment for React state to sync before clicking...');
        await this.page.waitForTimeout(2000);
        
        // --- מנגנון לחיצה חכם ועקשן ---
        for (let i = 0; i < 3; i++) {
            await submitBtnLocator.click({ delay: 300, force: true }); 
            console.log(`✅ Clicked submit button (Attempt ${i + 1}).`);

            try {
                // נחכה 3 שניות לראות איך המערכת מגיבה ללחיצה
                await this.page.waitForTimeout(3000);
                
                const isVisible = await submitBtnLocator.isVisible();
                if (!isVisible) {
                    console.log('✅ Button disappeared. Submission is processing...');
                    break; // יוצאים מהלולאה, הלחיצה עבדה!
                }

                // בודקים אם הכפתור עבר למצב disabled (למשל, יש ספינר טעינה שרץ ברקע)
                const isDisabled = await submitBtnLocator.evaluate(
                    btn => btn.disabled || btn.getAttribute('aria-disabled') === 'true'
                ).catch(() => true);
                
                if (isDisabled) {
                    console.log('✅ Button is disabled/loading. Submission is processing...');
                    break; // יוצאים מהלולאה, הבקשה נשלחה לשרת!
                }

                console.log('🔄 Button is still active and visible. Click was likely swallowed by React. Clicking again...');
            } catch (e) {
                // אם הגענו לכאן, האלמנט כנראה נותק מה-DOM (הדף התחלף לגמרי)
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