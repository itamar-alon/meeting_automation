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
    console.log('🔑 Step 1: Checking Main Login Button...');
    
    // התיקון: בדיקה האם מודאל ההתחברות כבר פתוח כדי למנוע לחיצה כפולה
    const isPasswordTabVisible = await this.passwordTab.isVisible().catch(() => false);
    
    if (!isPasswordTabVisible) {
        try {
            await this.topLoginButton.waitFor({ state: 'attached', timeout: 20000 });
            await this.topLoginButton.waitFor({ state: 'visible', timeout: 20000 });
            await this.topLoginButton.click({ force: true });
        } catch (e) {
            await this.page.screenshot({ path: 'logs/screenshots/debug_no_login_btn.png', fullPage: true });
            throw new Error(`Could not find or click "Login" button: ${e.message}`);
        }
    } else {
        console.log('🔑 Step 1: Login modal is already open, skipping top button click...');
    }

    console.log('🔄 Step 2: Switching to Password Tab...');
    await this.passwordTab.waitFor({ state: 'visible', timeout: 15000 });
    // שימוש ב-force כדי למנוע בעיות של אנימציות React שמסתירות את האלמנט
    await this.passwordTab.click({ force: true });

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
    
    // מוודאים שהכפתור באמת enabled לפני שלוחצים עליו
    await this.page.waitForFunction(
        btn => !btn.disabled,
        await this.submitButton.elementHandle()
    ).catch(() => console.log('⚠️ Could not verify button disabled state, proceeding anyway...'));

    await this.submitButton.click({ force: true, delay: 150 });

    console.log('⏳ Waiting for login modal to close and user identity to load...');
    
    // --- התיקון הקריטי מבוסס התמונות! ---
    try {
        // 1. קודם כל מוודאים שהמודאל סוייפ מהמסך (שדה הסיסמה נעלם)
        await this.passwordInput.waitFor({ state: 'hidden', timeout: 20000 });
        
        // 2. במקום לחפש "שלום", מוודאים שכפתור ה"כניסה" הוחלף בשם המשתמש ונעלם מה-DOM
        await this.topLoginButton.waitFor({ state: 'hidden', timeout: 20000 });
    } catch (e) {
        await this.page.screenshot({ path: 'logs/screenshots/FAIL_LOGIN_VERIFICATION.png' });
        throw new Error('Login failed: Modal did not close or "Login" button is still visible.');
    }
    
    console.log('✅ Login Successful! Header updated.');
    
    // וידוא שהרשת נרגעה והדף נטען במלואו אחרי ההתחברות
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(2000); 
  }

  async navigateToAppointments() {
    console.log('📅 Navigating to Appointments Wizard...');
    try {
        // וידוא שהאלמנט קיים בדף (השתמשתי ב-scrollIntoView כדי לוודא שהוא נגיש)
        const link = this.scheduleLink.first();
        await link.waitFor({ state: 'visible', timeout: 20000 });
        await link.scrollIntoViewIfNeeded();
        
        console.log('🖱️ Clicking on Appointments link...');
        await link.click({ force: true }); // מניעת התנגשות עם header דביק
    } catch (e) {
        await this.page.screenshot({ path: `logs/screenshots/debug_nav_fail_${Date.now()}.png` });
        throw new Error(`Failed to navigate to Appointments: ${e.message}`);
    }
  }
}

module.exports = { LoginPage };