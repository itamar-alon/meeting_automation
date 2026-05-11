# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking.test.js >> meeting - TEST
- Location: tests\booking.test.js:149:5

# Error details

```
Error: Failed to load appointment wizard options after 3 reloads. API might be down.
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation "ניווט ראשי" [ref=e4]:
    - button "תפריט" [ref=e6] [cursor=pointer]:
      - img [ref=e8]
      - text: תפריט
    - generic [ref=e10]:
      - button "תפריט חשבון משתמש מחובר" [ref=e12] [cursor=pointer]:
        - img [ref=e14]
        - text: בדיקות בדיקות
      - separator [ref=e16]
      - button "חזרה לדף הבית" [ref=e17] [cursor=pointer]
  - main [ref=e18]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - img "לוגו עיריית ראשון לציון" [ref=e21]
        - img "לוגו משני עיריית ראשון לציון" [ref=e22]
      - main "מחלקה אין תוצאות חיפוש מתאימות חזור שרות ערוץ הפגישה מועדים פנויים לפגישה בחרו שעה ליום" [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]:
            - heading "זימון פגישות" [level=1] [ref=e26]
            - tablist [ref=e29]:
              - tab "זימון פגישה חדשה" [selected] [ref=e30] [cursor=pointer]
              - tab "פגישות עתידיות (עדכון/ביטול)" [ref=e31] [cursor=pointer]
              - tab "היסטוריית פגישות" [ref=e32] [cursor=pointer]
          - generic "מחלקה אין תוצאות חיפוש מתאימות חזור שרות ערוץ הפגישה מועדים פנויים לפגישה בחרו שעה ליום" [ref=e34]:
            - generic [ref=e38]:
              - generic [ref=e39]:
                - generic [ref=e40]:
                  - img [ref=e42]:
                    - generic [ref=e44]: "1"
                  - heading "מחלקה" [level=6] [ref=e49]
                - generic [ref=e54]:
                  - heading "אין תוצאות חיפוש מתאימות" [level=6] [ref=e55]
                  - generic [ref=e56]:
                    - button "חזור" [disabled]
              - generic [ref=e58]:
                - img [ref=e60]:
                  - generic [ref=e62]: "2"
                - heading "שרות" [level=6] [ref=e67]
              - generic [ref=e71]:
                - img [ref=e73]:
                  - generic [ref=e75]: "3"
                - heading "ערוץ הפגישה" [level=6] [ref=e80]
              - generic [ref=e84]:
                - img [ref=e86]:
                  - generic [ref=e88]: "4"
                - heading "מועדים פנויים לפגישה" [level=6] [ref=e93]
              - generic [ref=e97]:
                - img [ref=e99]:
                  - generic [ref=e101]: "5"
                - heading "בחרו שעה ליום" [level=6] [ref=e106]
```

# Test source

```ts
  8   |     async setupAppointmentMock() {
  9   |         await this.page.route('**/SetAppointment*', async route => {
  10  |             console.log("🛡️ INITIATING MOCK: Intercepted real appointment request!");
  11  |             await route.fulfill({
  12  |                 status: 200,
  13  |                 contentType: 'application/json',
  14  |                 body: JSON.stringify({
  15  |                     SetAppointmentData: { ServiceId: 262, DateAndTime: "2026-04-01T08:30:00" },
  16  |                     ScriptResults: { Messages: [], ReturnCode: 0 },
  17  |                     CaseId: 1813505,
  18  |                     ProcessId: 1813214,
  19  |                     AppointmentId: 204169,
  20  |                     CalendarId: 91583,
  21  |                     QNumber: 0,
  22  |                     QCode: "",
  23  |                     CustomerTreatmentPlanId: 0
  24  |                 })
  25  |             });
  26  |             console.log("✅ MOCK SUCCESS: Injected fake confirmation response.");
  27  |         });
  28  |     }
  29  | 
  30  |     async dismissCookieBanner() {
  31  |         const cookieBtn = this.page.getByRole('button', { name: 'מאשר הכל' });
  32  |         if (await cookieBtn.isVisible({ timeout: 5000 })) {
  33  |             await cookieBtn.click();
  34  |             await cookieBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  35  |             console.log("✅ Cookie banner cleared.");
  36  |         }
  37  |     }
  38  | 
  39  |     async dismissInitialPopup() {
  40  |         const globalContinueBtn = this.page.getByRole('button', { name: 'המשך' }).first();
  41  |         if (await globalContinueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
  42  |             await globalContinueBtn.click({ force: true });
  43  |             console.log("✅ Initial informational popup cleared.");
  44  |         }
  45  |     }
  46  | 
  47  |     async completeInitialWizardSteps() {
  48  |         let wizardReady = false;
  49  | 
  50  |         for (let wizardAttempt = 1; wizardAttempt <= 3; wizardAttempt++) {
  51  |             console.log(`Navigating to Appointments wizard (Attempt ${wizardAttempt}/3)...`);
  52  |             
  53  |             await this.page.goto('/'); 
  54  |             await this.page.waitForLoadState('domcontentloaded');
  55  |             await this.dismissCookieBanner();
  56  |             await this.dismissInitialPopup();
  57  |             
  58  |             const appointmentsTile = this.page.getByText(/פגישות|זימון תורים/).first();
  59  |             await appointmentsTile.click();
  60  |             await this.page.waitForLoadState('networkidle').catch(() => {});
  61  | 
  62  |             let errorInSteps = false;
  63  | 
  64  |             for (let step = 1; step <= 3; step++) {
  65  |                 console.log(`Selecting option for Step ${step}...`);
  66  |                 await this.page.waitForTimeout(2000); 
  67  |                 
  68  |                 const noResultsMsg = this.page.getByText('אין תוצאות חיפוש מתאימות').first();
  69  |                 if (await noResultsMsg.isVisible()) {
  70  |                     console.log(`⚠️ 'No matching results' found at Step ${step}. Refreshing the flow...`);
  71  |                     errorInSteps = true;
  72  |                     break; 
  73  |                 }
  74  | 
  75  |                 try {
  76  |                     const activeStepContent = this.page.locator('.MuiStepContent-root:visible').last();
  77  |                     const optionToClick = activeStepContent.locator('div[role="button"], li.MuiListItem-root, input[type="radio"] + *').first();
  78  |                     
  79  |                     await expect(optionToClick).toBeVisible({ timeout: 10000 });
  80  |                     await optionToClick.click({ force: true });
  81  |                     await this.page.waitForLoadState('networkidle').catch(() => {});
  82  |                 } catch (err) {
  83  |                     console.log(`⚠️ Step ${step} failed to load options properly. Refreshing the flow...`);
  84  |                     errorInSteps = true;
  85  |                     break;
  86  |                 }
  87  |             }
  88  | 
  89  |             if (!errorInSteps) {
  90  |                 wizardReady = true;
  91  |                 break; 
  92  |             }
  93  |         }
  94  | 
  95  |         if (!wizardReady) {
  96  |             throw new Error("Failed to load appointment wizard options after 3 reloads. API might be down.");
  97  |         }
  98  |     }
  99  | 
  100 |     async findAndPickAvailableAppointment() {
  101 |         console.log("Handling dynamic dates and times...");
  102 |         let appointmentFound = false;
  103 |         let monthsChecked = 0;
  104 | 
  105 |         while (!appointmentFound && monthsChecked < 3) {
  106 |             await this.page.waitForSelector('.MuiSkeleton-root', { state: 'hidden', timeout: 15000 }).catch(() => {});
  107 |             await this.page.waitForTimeout(3000); 
> 108 |         
      |             ^ Error: Failed to load appointment wizard options after 3 reloads. API might be down.
  109 |         const daysLocator = this.page.locator('button.MuiPickersDay-root:visible:not(.Mui-disabled):not(.MuiPickersDay-hiddenDaySpacingFiller)');
  110 |         const datesCount = await daysLocator.count();
  111 |             console.log(`🔍 Found ${datesCount} available dates in current month.`);
  112 | 
  113 |             for (let i = 0; i < datesCount; i++) {
  114 |                 await this.page.waitForTimeout(1000); 
  115 |                 
  116 |                 const dateBtn = daysLocator.nth(i);
  117 |                 
  118 |                 try {
  119 |                     await expect(dateBtn).toBeVisible({ timeout: 10000 });
  120 |                     await dateBtn.evaluate(el => el.style.border = '3px solid yellow');
  121 |                     console.log(`🗓️ Clicking date #${i + 1} of ${datesCount}...`);
  122 |                     await dateBtn.click({ force: true });
  123 |                 } catch (e) {
  124 |                     console.log(`⚠️ Could not interact with date #${i + 1}. Moving to the next date...`);
  125 |                     continue; 
  126 |                 }
  127 | 
  128 |                 await this.page.waitForTimeout(2500); 
  129 | 
  130 |                 const timeSlots = this.page.locator('button:visible, div[role="button"]:visible, span.MuiChip-root:visible')
  131 |                     .filter({ hasText: /^\d{1,2}:\d{2}$/ })
  132 |                     .filter({ hasNot: this.page.locator('[disabled], .Mui-disabled') });
  133 |                 
  134 |                 const slotsCount = await timeSlots.count();
  135 |                 if (slotsCount > 0) {
  136 |                     console.log(`✅ Found ${slotsCount} visible time slots! Selecting the first one...`);
  137 |                     await timeSlots.first().click({ force: true });
  138 |                     appointmentFound = true;
  139 |                     break; 
  140 |                 } else {
  141 |                     console.log(`ℹ️ Date #${i + 1} has no times available.`);
  142 |                     
  143 |                     const backBtn = this.page.getByText('חזור').first();
  144 |                     if (await backBtn.isVisible({ timeout: 3000 })) {
  145 |                         console.log("🔙 Clicking 'Back' to return to the calendar view...");
  146 |                         await backBtn.click({ force: true });
  147 |                         await this.page.waitForTimeout(2000); 
  148 |                     } else {
  149 |                         const step4Header = this.page.getByText('מועדים פנויים לפגישה').first();
  150 |                         if (await step4Header.isVisible()) {
  151 |                             console.log("🔙 Clicking Step 4 Header to reopen calendar...");
  152 |                             await step4Header.click({ force: true });
  153 |                             await this.page.waitForTimeout(2000);
  154 |                         }
  155 |                     }
  156 |                     console.log("Moving to the next available date...");
  157 |                     continue; 
  158 |                 }
  159 |             }
  160 | 
  161 |             if (!appointmentFound) {
  162 |                 console.log("⏩ Month finished without results. Moving to Next Month...");
  163 |                 const nextMonthBtn = this.page.locator('svg[data-testid="ChevronLeftIcon"]:visible').first().locator('..');
  164 |                 try {
  165 |                     if (await nextMonthBtn.isVisible({ timeout: 5000 })) {
  166 |                         await nextMonthBtn.click({ force: true });
  167 |                         monthsChecked++;
  168 |                         await this.page.waitForTimeout(2000); 
  169 |                     } else {
  170 |                         console.log("❌ No Next Month button available.");
  171 |                         break; 
  172 |                     }
  173 |                 } catch (err) {
  174 |                     console.log("❌ Failed to click Next Month.");
  175 |                     break;
  176 |                 }
  177 |             }
  178 |         }
  179 | 
  180 |         if (!appointmentFound) {
  181 |             throw new Error("Could not find any available appointments in the next 3 months.");
  182 |         }
  183 |     }
  184 | 
  185 | async submitBooking() {
  186 |     console.log("Submitting appointment request...");
  187 | 
  188 |     const submitBtn = this.page.locator('button.MuiButton-containedWarning')
  189 |         .filter({ hasText: 'זימון פגישה' })
  190 |         .first();
  191 |     
  192 |     await expect(submitBtn).toBeVisible({ timeout: 20000 });
  193 |     await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  194 |     
  195 |     const responsePromise = this.page.waitForResponse(response => 
  196 |         response.url().includes('SetAppointment') && response.status() === 200,
  197 |         { timeout: 90000 } 
  198 |     ).catch(() => null);
  199 | 
  200 |     await submitBtn.evaluate(el => el.style.outline = '5px solid blue');
  201 |     
  202 |     console.log("🖱️ Clicking the confirmed orange button...");
  203 |     await this.page.waitForTimeout(1000);
  204 |     await submitBtn.click({ force: true, delay: 100 });
  205 |     
  206 |     const response = await responsePromise;
  207 |     if (!response) {
  208 |         console.log("⚠️ Server did not respond to SetAppointment call in time.");
```