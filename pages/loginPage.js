class LoginPage {
  constructor(page) {
    this.page = page;

    // --- דף הבית ---
    this.topLoginButton = page.locator('text=כניסה').first();
    this.scheduleLink = page.getByText('זימון פגישות'); 

    // --- מודאל התחברות ---
    this.passwordTab = page.getByText('באמצעות סיסמה');
    
    this.idInput = page.getByLabel('תעודת זהות'); 
    
    // --- התיקון הגדול כאן: ---
    // במקום לחפש לפי טקסט, אנחנו מחפשים את השדה היחיד שהוא מסוג password
    // זה עובד ב-100% מהמקרים כי אין עוד שדה כזה
    this.passwordInput = page.locator('input[type="password"]'); 
    
    this.submitButton = page.locator('button, input[type="submit"]').filter({ hasText: 'כניסה' }).last(); 
  }

  async performMainLogin(userId, password) {
    console.log('🔑 Step 1: Clicking Main Login Button...');
    
    try {
        await this.topLoginButton.waitFor({ state: 'visible', timeout: 15000 });
        await this.topLoginButton.click();
    } catch (e) {
        await this.page.screenshot({ path: 'logs/debug_no_login_btn.png' });
        throw new Error('Could not find "Login" button.');
    }

    console.log('🔄 Step 2: Switching to Password Tab...');
    await this.passwordTab.waitFor();
    await this.passwordTab.click();

    console.log('✍️ Step 3: Filling credentials...');
    // מילוי תעודת זהות
    await this.idInput.fill(userId);
    
    // המתנה קטנה כדי שהאתר לא "ייחנק" מהמהירות
    await this.page.waitForTimeout(500);

    // לחיצה על שדה הסיסמה כדי לוודא שהוא בפוקוס ואז מילוי
    await this.passwordInput.click(); 
    await this.passwordInput.fill(password);

    console.log('🚀 Step 4: Submitting login...');
    await this.submitButton.click();

    console.log('⏳ Waiting for login to finish...');
    // מחכים שכפתור הכניסה שלמעלה ייעלם - סימן שהפכנו למשתמש רשום
    await this.topLoginButton.waitFor({ state: 'detached', timeout: 30000 });
    
    console.log('✅ Login Successful!');
    await this.page.waitForTimeout(2000);
  }

  async navigateToAppointments() {
    console.log('📅 Navigating to Appointments Wizard...');
    await this.scheduleLink.first().waitFor({ state: 'visible' });
    await this.scheduleLink.first().click();
  }
}

module.exports = { LoginPage };