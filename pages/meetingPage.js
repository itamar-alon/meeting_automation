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
     * פונקציה משולבת: סורקת תאריכים עד שהיא מוצאת אחד עם שעות פנויות, 
     * כולל מעבר לחודש הבא אם צריך.
     */
    async findAndPickAvailableAppointment() {
        console.log('📅 Scanning calendar for available appointments...');
        
        // עוטפים את הכל בלולאה שרצה כל עוד לא מצאנו תור
        let foundSlot = false;
        let checkedDates = []; // שומר אילו תאריכים כבר בדקנו כדי לא להיכנס ללולאה אינסופית

        while (!foundSlot) {
            // ממתינים ללוח השנה שייוצר / יחזור מרינדור
            await this.page.waitForSelector('.day, .cell, [role="gridcell"], td', { state: 'attached', timeout: 30000 });
            await this.page.waitForTimeout(1000); // נותן ל-DOM להתייצב

            // מביאים את כל האלמנטים של הימים בכל איטרציה כדי למנוע Stale Element
            const allDays = this.page.locator('.day, .cell, [role="gridcell"], td');
            const dayCount = await allDays.count();
            
            if (dayCount === 0) throw new Error('❌ Calendar days not found!');

            let clickedDay = false;

            for (let i = 0; i < dayCount; i++) {
                const day = allDays.nth(i);
                
                // בודק אם האלמנט עדיין קיים ב-DOM (למקרה שהלוח התרפרש)
                if (!(await day.isVisible().catch(() => false))) continue;

                const classAttribute = await day.getAttribute('class') || '';
                const ariaDisabled = await day.getAttribute('aria-disabled');
                const text = await day.innerText();
                const dateNum = text.trim();

                // סינון: מוודא שהיום פעיל, לא נבדק כבר, ומכיל רק מספרים
                if (
                    !classAttribute.includes('disabled') && 
                    !classAttribute.includes('gray') &&
                    ariaDisabled !== 'true' &&
                    dateNum.match(/^\d+$/) &&
                    !checkedDates.includes(dateNum) // הוספנו בדיקה כדי לא ללחוץ שוב על ימים ריקים שכבר בדקנו
                ) {
                    console.log(`🔍 Checking date: ${dateNum}...`);
                    checkedDates.push(dateNum); // מסמן את התאריך כ"נבדק"
                    
                    await day.click();
                    clickedDay = true;
                    
                    // מחכים לראות אם מופיעות שעות או טקסט "אין שעות פנויות"
                    await this.page.waitForTimeout(2000); 
                    break; // יוצאים מלולאת הסריקה כדי לבדוק את המסך החדש שעלה
                }
            }

            // --- טיפול במצב שבו כל הימים בחודש נבדקו / אין ימים פנויים ---
            if (!clickedDay) {
                console.log(`⚠️ No available days left in current month. Checking for 'Next Month' button...`);
                
                // חיפוש כפתור הניווט קדימה. השתמשתי בסלקטורים נפוצים ליומנים (aria-label או title)
                const nextMonthBtn = this.page.locator('button[aria-label*="הבא"], button[aria-label*="next" i], button[aria-label*="Next"], [title*="הבא"]').first();
                
                if (await nextMonthBtn.isVisible({ timeout: 5000 })) {
                    const isDisabled = await nextMonthBtn.isDisabled().catch(() => false);
                    
                    if (isDisabled) {
                        throw new Error('❌ "Next Month" button is disabled. Completely out of appointments!');
                    }
                    
                    await nextMonthBtn.click();
                    console.log('➡️ Clicked next month. Scanning...');
                    await this.page.waitForTimeout(2500); // המתנה לרינדור החודש החדש
                    
                    // איפוס מוחלט של היסטוריית התאריכים (כי עברנו חודש ולתאריכים 1-31 יש עכשיו משמעות חדשה)
                    checkedDates = []; 
                    continue; // חוזר להתחלת לולאת ה-while כדי לסרוק את החודש החדש מאפס
                } else {
                    throw new Error('❌ Could not find any available time slots, and no "Next Month" button exists!');
                }
            }

            // --- אנחנו במסך השעות ---
            
            // חיפוש כפתורי שעות פנויות
            const timeSlotLocator = this.page.locator('button, div').filter({ hasText: /^\d{1,2}:\d{2}$/ });
            const timeCount = await timeSlotLocator.count().catch(() => 0);

            if (timeCount > 0) {
                console.log(`✅ Found ${timeCount} time slots.`);
                
                // עוברים על השעות ובוחרים את הראשונה שלא מושבתת
                for (let j = 0; j < timeCount; j++) {
                    const slot = timeSlotLocator.nth(j);
                    const slotClass = await slot.getAttribute('class').catch(() => '') || '';
                    const isDisabled = await slot.isDisabled().catch(() => false);

                    if (!isDisabled && !slotClass.includes('disabled')) {
                        const timeText = await slot.innerText();
                        console.log(`🎯 Selecting time: ${timeText}`);
                        await slot.click();
                        foundSlot = true; // הצלחנו! הלולאה הראשית תסתיים
                        break; 
                    }
                }
            } 
            
            // אם לא מצאנו שעות (או שמצאנו רק שעות מושבתות), צריך לחזור אחורה ללוח השנה
            if (!foundSlot) {
                console.log(`⚠️ No available times for this date, clicking 'Back' to calendar...`);
                
                // מחפש את כפתור ה"חזור"
                const backBtn = this.page.locator('button:has-text("חזור"), a:has-text("חזור")').first();
                
                if (await backBtn.isVisible({ timeout: 5000 })) {
                    await backBtn.click();
                    console.log('🔙 Clicked back to calendar.');
                    await this.page.waitForTimeout(1500); // מחכה ללוח השנה שיחזור למסך
                } else {
                    throw new Error('❌ "Back" button not found! Stuck on empty hours page.');
                }
            }
        }
    }

    // אישור סופי
    async submitBooking() {
        console.log('🚀 Submitting booking...');
        const submitBtn = this.page.locator('button:has-text("זימון פגישה"), button:has-text("המשך")').first();
        await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
        await submitBtn.click();
        console.log('✅ Clicked submit button.');
    }
}

module.exports = { AppointmentsPage };