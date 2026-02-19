class LoginPage {
  constructor(page) {
    this.page = page;

    // --- דף הבית ---
    this.topLoginButton = page.locator('text=כניסה').first();
    this.scheduleLink = page.getByText('זימון פגישות'); 

    // --- מודאל התחברות ---
    this.passwordTab = page.getByText('באמצעות סיסמה');
    
    this.idInput = page.getByLabel('תעודת זהות'); 
    
    // שדה סיסמה
    this.passwordInput = page.locator('input[type="password"]'); 
    
    this.submitButton = page.locator('button, input[type="submit"]').filter({ hasText: 'כניסה' }).last(); 
    
    // סלקטור חדש לאימות לוגין: שם המשתמש שמופיע למעלה (למשל "שלום, ישראל ישראלי")
    this.userDisplayName = page.locator('.user-name, .profile-name, text=שלום');
  }

  async performMainLogin(userId, password) {
    console.log('🔑 Step 1: Clicking Main Login Button...');
    
    try {
        await this.topLoginButton.waitFor({ state: 'attached', timeout: 20000 });
        await this.topLoginButton.waitFor({ state: 'visible', timeout: 20000 });
        await this.topLoginButton.click({ force: true });
    } catch (e) {
        await this.page.screenshot({ path: 'logs/screenshots/debug_no_login_btn.png', fullPage: true });
        throw new Error(`Could not find or click "Login" button: ${e.message}`);
    }

    console.log('🔄 Step 2: Switching to Password Tab...');
    await this.passwordTab.waitFor({ state: 'visible', timeout: 15000 });
    await this.passwordTab.click();

    console.log('✍️ Step 3: Filling credentials...');
    await this.idInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.idInput.click();
    await this.idInput.fill(userId);
    
    await this.page.waitForTimeout(800);

    await this.passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.passwordInput.click(); 
    await this.passwordInput.fill(password);

    console.log('🚀 Step 4: Submitting login...');
    await this.submitButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.submitButton.click();

    console.log('⏳ Waiting for login to finish...');
    
    // התיקון הקריטי: במקום לחכות ל-URL (שלא תמיד משתנה), מחכים לסגירת המודאל
    try {
        // מחכים שהמודאל או כפתור הכניסה ייעלמו מהמסך
        await this.topLoginButton.waitFor({ state: 'detached', timeout: 30000 });
    } catch (e) {
        console.warn('⚠️ Warning: Login modal did not detach, checking for user identity...');
        // בדיקת גיבוי: האם מופיע שם משתמש או כפתור התנתקות
        const isLoggedIn = await this.page.isVisible('text=יציאה, text=שלום');
        if (!isLoggedIn) {
            throw new Error('Login failed: Modal stayed open and no user identity found.');
        }
    }
    
    console.log('✅ Login Successful!');
    // השהייה קצרה כדי לוודא שכל ה-Scripts של הדף רצו אחרי סגירת המודאל
    await this.page.waitForTimeout(3000); 
  }

  async navigateToAppointments() {
    console.log('📅 Navigating to Appointments Wizard...');
    try {
        // וידוא שהאלמנט קיים בדף (השתמשתי ב-scrollIntoView כדי לוודא שהוא נגיש)
        const link = this.scheduleLink.first();
        await link.waitFor({ state: 'visible', timeout: 20000 });
        await link.scrollIntoViewIfNeeded();
        
        console.log('🖱️ Clicking on Appointments link...');
        await link.click();
    } catch (e) {
        await this.page.screenshot({ path: `logs/screenshots/debug_nav_fail_${Date.now()}.png` });
        throw new Error(`Failed to navigate to Appointments: ${e.message}`);
    }
  }
}

module.exports = { LoginPage };