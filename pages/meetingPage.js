class AppointmentsPage {
    constructor(page) {
        this.page = page;
    }

    // פונקציה לבחירת אופציה לפי טקסט (מחלקה, שירות וכו')
    async selectOption(optionText) {
        const option = this.page.getByText(optionText).last(); 
        await option.waitFor({ state: 'visible' });
        await option.click();
        await this.page.waitForTimeout(1000); // המתנה קצרה לאנימציות
    }

    /**
     * פונקציה משולבת: סורקת תאריכים עד שהיא מוצאת אחד עם שעות פנויות
     */
    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar for available appointments...');
        
        // המתנה לטעינת הלוח
        await this.page.waitForSelector('.day, .cell, [role="gridcell"], td', { timeout: 10000 });

        // זיהוי כל ימי הלוח
        const allDays = this.page.locator('.day, .cell, [role="gridcell"], td'); 
        const dayCount = await allDays.count();
        
        if (dayCount === 0) throw new Error('❌ Calendar days not found!');

        for (let i = 0; i < dayCount; i++) {
            const day = allDays.nth(i);
            const classAttribute = await day.getAttribute('class') || '';
            const ariaDisabled = await day.getAttribute('aria-disabled');
            const text = await day.innerText();

            // סינון ימים רלוונטיים (לא מושבתים, לא אפורים, ומכילים מספר)
            if (
                !classAttribute.includes('disabled') && 
                !classAttribute.includes('gray') &&
                ariaDisabled !== 'true' &&
                text.trim().match(/^\d+$/)
            ) {
                const dateNum = text.trim();
                console.log(`🔍 Checking date: ${dateNum}...`);
                
                // לחיצה על התאריך כדי לראות אם יש שעות
                await day.click();
                
                // המתנה קצרה לטעינת אזור השעות (או הופעת הודעה שאין שעות)
                await this.page.waitForTimeout(1500); 

                // חיפוש סלוטים של שעות (פורמט HH:mm)
                const timeSlotLocator = this.page.locator('button, div').filter({ hasText: /^\d{1,2}:\d{2}$/ });
                const timeCount = await timeSlotLocator.count();

                if (timeCount > 0) {
                    console.log(`✅ Found ${timeCount} time slots on date ${dateNum}.`);
                    
                    // עוברים על השעות ובוחרים את הראשונה שלא מושבתת
                    for (let j = 0; j < timeCount; j++) {
                        const slot = timeSlotLocator.nth(j);
                        const slotClass = await slot.getAttribute('class') || '';
                        const isDisabled = await slot.isDisabled().catch(() => false);

                        if (!isDisabled && !slotClass.includes('disabled')) {
                            const timeText = await slot.innerText();
                            console.log(`🎯 Selecting time: ${timeText} on date: ${dateNum}`);
                            await slot.click();
                            return; // הצלחנו! יוצאים מהפונקציה
                        }
                    }
                } else {
                    console.log(`⚠️ No available times on date ${dateNum}, moving to next...`);
                }
            }
        }
        
        throw new Error('❌ Could not find any available time slots in the entire calendar!');
    }

    // אישור סופי
    async submitBooking() {
        console.log('🚀 Submitting booking...');
        const submitBtn = this.page.getByRole('button', { name: 'זימון פגישה' });
        await submitBtn.waitFor({ state: 'visible' });
        await submitBtn.click();
        console.log('✅ Clicked submit button.');
    }
}

module.exports = { AppointmentsPage };