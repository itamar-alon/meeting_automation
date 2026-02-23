class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    // פונקציה לבחירת אופציה לפי טקסט
    async selectOption(optionText) {
        const option = this.page.getByText(optionText).last(); 
        await option.waitFor({ state: 'visible', timeout: 15000 });
        await option.click();
        // המתנה קצרה לאנימציה של פתיחת השלב הבא
        await this.page.waitForTimeout(1000); 
    }

    /**
     * סריקת לוח השנה למציאת תור פנוי
     */
    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar for available appointments...');
        let foundSlot = false;
        let checkedDates = [];

        while (!foundSlot) {
            // המתנה חכמה ללוח השנה
            await this.page.waitForSelector('.day, .cell, [role="gridcell"], td', { state: 'attached', timeout: 30000 });
            
            const allDays = this.page.locator('.day, .cell, [role="gridcell"], td');
            const dayCount = await allDays.count();
            
            if (dayCount === 0) throw new Error('❌ Calendar days not found!');

            let clickedDay = false;

            for (let i = 0; i < dayCount; i++) {
                const day = allDays.nth(i);
                if (!(await day.isVisible().catch(() => false))) continue;

                const classAttribute = await day.getAttribute('class') || '';
                const ariaDisabled = await day.getAttribute('aria-disabled');
                const text = await day.innerText();
                const dateNum = text.trim();

                if (!classAttribute.includes('disabled') && !classAttribute.includes('gray') &&
                    ariaDisabled !== 'true' && dateNum.match(/^\d+$/) && !checkedDates.includes(dateNum)) {
                    
                    console.log(`🔍 Checking date: ${dateNum}...`);
                    checkedDates.push(dateNum);
                    await day.click();
                    clickedDay = true;
                    // המתנה קצרה לטעינת השעות
                    await this.page.waitForTimeout(1500); 
                    break; 
                }
            }

            if (!clickedDay) {
                console.log(`⚠️ No available days left. Checking for 'Next Month'...`);
                const nextMonthBtn = this.page.locator('button[aria-label*="הבא"], [title*="הבא"]').first();
                if (await nextMonthBtn.isVisible({ timeout: 5000 })) {
                    await nextMonthBtn.click();
                    await this.page.waitForTimeout(2000);
                    checkedDates = []; 
                    continue;
                } else {
                    throw new Error('❌ No slots found!');
                }
            }

            const timeSlotLocator = this.page.locator('button, div').filter({ hasText: /^\d{1,2}:\d{2}$/ });
            const timeCount = await timeSlotLocator.count().catch(() => 0);

            if (timeCount > 0) {
                for (let j = 0; j < timeCount; j++) {
                    const slot = timeSlotLocator.nth(j);
                    const slotClass = await slot.getAttribute('class') || '';
                    if (!slotClass.includes('disabled')) {
                        console.log(`🎯 Selecting time: ${await slot.innerText()}`);
                        await slot.click();
                        foundSlot = true;
                        break; 
                    }
                }
            } 
            
            if (!foundSlot) {
                const backBtn = this.page.locator('button:has-text("חזור")').first();
                await backBtn.click();
                await this.page.waitForTimeout(1000);
            }
        }
    }

    /**
     * לחיצה על כפתור הזימון הכתום
     */
    async submitBooking() {
        console.log('🚀 Submitting booking...');
        const submitBtn = this.page.locator('button.MuiButton-root:has-text("זימון פגישה")').last();
        await submitBtn.waitFor({ state: 'visible', timeout: 20000 });
        await submitBtn.click({ force: true });
        console.log('✅ Clicked orange submit button.');
    }

    /**
     * המתנה חכמה להודעת הצלחה וסגירת המודאל
     */
    async verifySuccessAndClose() {
        console.log('⏳ Verifying success message (Smart Wait up to 60s)...');
        const successHeader = this.page.locator('h4:has-text("פגישתך נקבעה בהצלחה")');
        
        // אם ההודעה עולה תוך שנייה, הסקריפט ימשיך מיד הלאה
        await successHeader.waitFor({ state: 'visible', timeout: 60000 });
        console.log('✅ Success message detected!');

        const closeBtn = this.page.locator('button:has-text("סגירה")').first();
        await closeBtn.click();
        
        // מוודאים שהשכבה החוסמת נעלמה לפני שממשיכים
        await successHeader.waitFor({ state: 'hidden', timeout: 15000 });
        console.log('👋 Success modal closed.');
    }
}

module.exports = { AppointmentsPage };