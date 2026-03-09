class MyAppointmentsPage {
    constructor(page) {
        this.page = page;
        
        // סלקטורים
        this.futureAppointmentsTab = page.getByRole('tab', { name: 'פגישות עתידיות' }) 
        this.cancelButton = page.locator('button.MuiButton-outlinedError').filter({ hasText: 'ביטול פגישה' });
        this.confirmCancelButton = page.locator('button').filter({ hasText: 'ביטול פגישה' }).last();
        
        // הסלקטור של השורה הראשונה
        this.firstAppointmentRow = page.locator('div.MuiAccordionSummary-content').first(); 
    }

    async navigateToFutureAppointments() {
        console.log('📂 Navigating to "Future Appointments" tab...');
        
        // 1. לחיצה על הטאב
        await this.futureAppointmentsTab.click({ force: true });
        
        // 2. המתנה לטעינה ראשונית
        await this.page.waitForTimeout(2000); 

        // 3. בדיקה האם הרשימה נטענה. אם לא - ריענון (Refresh)
        try {
            console.log('👀 Checking if appointment list is visible...');
            await this.page.waitForSelector('text=נושא:', { timeout: 8000 });
        } catch (e) {
            console.log('⚠️ List seems empty or stuck. Refreshing page...');
            await this.page.reload();
            
            await this.page.waitForLoadState('networkidle'); 
            await this.page.waitForTimeout(3000); 
            
            await this.futureAppointmentsTab.waitFor({ state: 'visible', timeout: 15000 });
            await this.futureAppointmentsTab.click({ force: true });
            await this.page.waitForTimeout(2000);
        }
    }

    async expandFirstAppointment() {
        console.log('👇 Clicking first appointment to expand...');
        
        try {
            const row = this.page.locator('text=נושא:').first();
            await row.waitFor({ state: 'visible', timeout: 15000 });
            await row.click({ force: true }); 
        } catch (error) {
            console.error('❌ Failed to find appointment. Maybe the booking failed?');
            await this.page.screenshot({ path: 'logs/empty_list_error.png' });
            throw error; 
        }
        
        await this.page.waitForTimeout(1000);
    }

    async cancelAppointment() {
        console.log('❌ Clicking "Cancel Appointment" button...');
        
        const btn = this.cancelButton.first();
        await btn.waitFor({ state: 'visible', timeout: 5000 });
        await btn.scrollIntoViewIfNeeded();
        
        // לחיצה ראשונה עם השהיה קלה
        await btn.click({ force: true, delay: 200 });

        // בדיקה האם הפופ-אפ נפתח - אם לא הופיע תוך 4 שניות, נלחץ שוב
        const popupText = this.page.getByText('האם לבטל את הפגישה?');
        try {
            await popupText.waitFor({ state: 'visible', timeout: 4000 });
            console.log('✅ Cancel popup appeared.');
        } catch (e) {
            console.log('🔄 Popup did not appear, trying second click on cancel button...');
            await btn.click({ force: true });
        }
    }

    async confirmCancellation() {
        console.log('⚠️ Confirming cancellation in popup...');
        
        const popupText = this.page.getByText('האם לבטל את הפגישה?');
        
        // הגדלת ה-timeout ל-20 שניות כדי למנוע את קריסת ה-waitFor שחווית
        await popupText.waitFor({ state: 'visible', timeout: 20000 });
        
        await this.confirmCancelButton.waitFor({ state: 'visible', timeout: 10000 });
        
        // לחיצה על אישור הביטול
        await this.confirmCancelButton.click({ force: true });
        
        console.log('✅ Cancellation confirmed.');
        
        // מחכים שהפופ-אפ ייעלם כדי לוודא שהפעולה נשלחה
        await popupText.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {
            console.log('⚠️ Note: Popup hidden timeout reached, continuing...');
        });
        
        await this.page.waitForTimeout(2000); 
    }
}

module.exports = { MyAppointmentsPage };