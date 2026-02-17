class MyAppointmentsPage {
    constructor(page) {
        this.page = page;
        
        // סלקטורים
        this.futureAppointmentsTab = page.getByRole('tab', { name: 'פגישות עתידיות' }) 
        this.cancelButton = page.locator('button.MuiButton-outlinedError').filter({ hasText: 'ביטול פגישה' });
        this.confirmCancelButton = page.locator('button').filter({ hasText: 'ביטול פגישה' }).last();
        
        // הסלקטור של השורה הראשונה - נשתמש במשהו יותר יציב
        this.firstAppointmentRow = page.locator('div.MuiAccordionSummary-content').first(); 
        // אופציה ב': נשארים עם הטקסט אם זה עבד לך קודם
        // this.firstAppointmentRow = page.locator('text=נושא:').first();
    }

    async navigateToFutureAppointments() {
        console.log('📂 Navigating to "Future Appointments" tab...');
        
        // 1. לחיצה על הטאב
        await this.futureAppointmentsTab.click();
        
        // 2. המתנה לטעינה ראשונית - ניתן למערכת רגע "לנשום"
        await this.page.waitForTimeout(2000); 

        // 3. בדיקה האם הרשימה נטענה. אם לא - ריענון (Refresh)
        // ננסה למצוא אינדיקציה לפגישה. אם אין תוך 5 שניות, כנראה צריך ריענון.
        try {
            console.log('👀 Checking if appointment list is visible...');
            await this.page.waitForSelector('text=נושא:', { timeout: 5000 });
        } catch (e) {
            console.log('⚠️ List seems empty or stuck. Refreshing page...');
            await this.page.reload();
            await this.page.waitForTimeout(3000); // מחכים שהדף יעלה מחדש
            
            // צריך ללחוץ שוב על הטאב כי הריענון יכול לזרוק אותנו לטאב הראשי
            await this.futureAppointmentsTab.click();
            await this.page.waitForTimeout(2000);
        }
    }

    async expandFirstAppointment() {
        console.log('👇 Clicking first appointment to expand...');
        
        // כאן אנחנו מחכים עד 30 שניות (ברירת מחדל) שהפגישה תופיע
        // הוספתי state: 'attached' כדי לוודא שהאלמנט קיים ב-DOM
        try {
            await this.page.locator('text=נושא:').first().waitFor({ state: 'visible', timeout: 15000 });
            await this.page.locator('text=נושא:').first().click();
        } catch (error) {
            console.error('❌ Failed to find appointment. Maybe the booking failed?');
            // צילום מסך למצב שבו הרשימה ריקה
            await this.page.screenshot({ path: 'logs/empty_list_error.png' });
            throw error; // זורקים את השגיאה כדי שהטסט ייכשל
        }
        
        // המתנה לאנימציית הפתיחה
        await this.page.waitForTimeout(1000);
    }

    async cancelAppointment() {
        console.log('❌ Clicking "Cancel Appointment" button...');
        
        // וידוא שהכפתור נראה לעין וגם לחיץ (enabled)
        const btn = this.cancelButton.first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        
        // לפעמים הכפתור מוסתר, נגלול אליו
        await btn.scrollIntoViewIfNeeded();
        await btn.click();
    }

    async confirmCancellation() {
        console.log('⚠️ Confirming cancellation in popup...');
        
        // המתנה לפופ-אפ
        await this.page.getByText('האם לבטל את הפגישה?').waitFor();
        
        // לחיצה על האישור
        await this.confirmCancelButton.click();
        
        console.log('✅ Cancellation confirmed.');
        await this.page.waitForTimeout(2000); 
    }
}

module.exports = { MyAppointmentsPage };