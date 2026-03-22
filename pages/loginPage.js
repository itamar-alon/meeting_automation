class LoginPage {

  constructor(page) {
    this.page = page;

    this.topLoginButton = page.locator('text=כניסה').first();
    this.scheduleLink = page.locator('text=זימון פגישות').first();
    this.passwordTab = page.locator('text=באמצעות סיסמה');
    this.idInput = page.getByLabel('תעודת זהות');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton = page.locator('button, input[type="submit"]')
                         .filter({ hasText: 'כניסה' })
                         .last();
    this.userDisplayName = page.locator('.user-name, .profile-name, text=שלום');
  }

  // --- פונקציה חדשה שהוספנו לבדיקת מצב התחברות ---
  async checkIfLoggedIn() {
    console.log('🔍 Checking if user is already logged in...');
    try {
        // נחכה עד 5 שניות שכפתור הכניסה יופיע
        await this.topLoginButton.waitFor({ state: 'visible', timeout: 5000 });
        // אם לא נזרקה שגיאה, משמע הכפתור הופיע = אנחנו לא מחוברים
        return false; 
    } catch (error) {
        // אם עברו 5 שניות והכפתור לא הופיע (נזרק Timeout), אנחנו כנראה מחוברים
        console.log('✅ Login button not found. Assuming session is valid.');
        return true;
    }
  }
  // ------------------------------------------------

  async performMainLogin(userId, password) {
    console.log('🔑 Step 1: Checking Main Login Button...');

    const isPasswordTabVisible = await this.passwordTab.isVisible().catch(() => false);

    if (!isPasswordTabVisible) {
      try {
        await this.topLoginButton.waitFor({ state: 'visible', timeout: 20000 });
        await this.topLoginButton.scrollIntoViewIfNeeded();
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
    await this.passwordTab.scrollIntoViewIfNeeded();
    await this.passwordTab.click({ force: true });

    console.log('✍️ Step 3: Filling credentials...');
    await this.idInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.idInput.scrollIntoViewIfNeeded();
    await this.idInput.fill(userId);

    await this.passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.passwordInput.scrollIntoViewIfNeeded();
    await this.passwordInput.fill(password);

    console.log('🚀 Step 4: Submitting login...');
    await this.submitButton.waitFor({ state: 'visible', timeout: 10000 });

    try {
      await this.submitButton.waitFor({ state: 'enabled', timeout: 10000 });
    } catch {
      console.log('⚠️ Could not verify button enabled state, proceeding anyway...');
    }

    await this.submitButton.click({ force: true, delay: 150 });

    console.log('⏳ Waiting for login modal to close or for error message...');
    try {
      // חיפוש הודעת שגיאה כללית או את ההודעה הספציפית
      const errorLocator = this.page.locator('text=אחד מהפרטים שהוזנו אינו מזוהה, text=שגיאה, text=שגוי, text=לא נמצא').first();
      
      // נמתין במקביל: או שהמודאל ייסגר (הצלחה), או שתקפוץ שגיאה (כישלון)
      await Promise.race([
        this.passwordInput.waitFor({ state: 'hidden', timeout: 25000 }),
        errorLocator.waitFor({ state: 'visible', timeout: 25000 }).then(() => { 
            throw new Error('System displayed a login error message (check credentials).'); 
        })
      ]);
      
    } catch (e) {
      await this.page.screenshot({ path: 'logs/screenshots/FAIL_LOGIN_VERIFICATION.png', fullPage: true });
      throw new Error(`Login failed: Modal did not close or error detected. Details: ${e.message}`);
    }

    console.log('✅ Login Successful!');
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(2000);
  }

  async navigateToAppointments() {
    console.log('📅 Navigating to Appointments Wizard...');
    try {
      const link = this.scheduleLink;
      await link.waitFor({ state: 'visible', timeout: 20000 });
      await link.scrollIntoViewIfNeeded();
      console.log('🖱️ Clicking on Appointments link...');
      await link.click({ force: true });
    } catch (e) {
      await this.page.screenshot({ path: `logs/screenshots/debug_nav_fail_${Date.now()}.png`, fullPage: true });
      throw new Error(`Failed to navigate to Appointments: ${e.message}`);
    }
  }
}

module.exports = { LoginPage };