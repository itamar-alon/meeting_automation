# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: booking.test.js >> meeting - PROD
- Location: tests\booking.test.js:149:5

# Error details

```
Test timeout of 120000ms exceeded.
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
        - text: ישראל ישראלי
      - separator [ref=e16]
      - button "חזרה לדף הבית" [ref=e17] [cursor=pointer]
  - main [ref=e18]:
    - generic [ref=e19]:
      - generic [ref=e20]:
        - img "לוגו עיריית ראשון לציון" [ref=e21]
        - img "לוגו משני עיריית ראשון לציון" [ref=e22]
      - main "מחלקה מנהל החינוך רחוב הכרמל 20 ראשון לציון שרות גני ילדים - רישום/ביטול רישום ערוץ הפגישה טלפוני מועדים פנויים לפגישה מאי 2026 calendar view is open, switch to year view Previous month Next month ראשון שני שלישי רביעי חמישי שישי שבת 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 חזור בחרו שעה ליום" [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]:
            - heading "זימון פגישות" [level=1] [ref=e26]
            - tablist [ref=e29]:
              - tab "זימון פגישה חדשה" [selected] [ref=e30] [cursor=pointer]
              - tab "פגישות עתידיות (עדכון/ביטול)" [ref=e31] [cursor=pointer]
              - tab "היסטוריית פגישות" [ref=e32] [cursor=pointer]
          - generic "מחלקה מנהל החינוך רחוב הכרמל 20 ראשון לציון שרות גני ילדים - רישום/ביטול רישום ערוץ הפגישה טלפוני מועדים פנויים לפגישה מאי 2026 calendar view is open, switch to year view Previous month Next month ראשון שני שלישי רביעי חמישי שישי שבת 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 חזור בחרו שעה ליום" [ref=e34]:
            - generic [ref=e38]:
              - generic [ref=e40]:
                - img [ref=e42]
                - generic [ref=e46]:
                  - heading "מחלקה" [level=6] [ref=e48]
                  - generic [ref=e50]:
                    - heading "מנהל החינוך" [level=6] [ref=e51]
                    - generic [ref=e52]: רחוב הכרמל 20 ראשון לציון
              - generic [ref=e56]:
                - img [ref=e58]
                - generic [ref=e62]:
                  - heading "שרות" [level=6] [ref=e64]
                  - heading "גני ילדים - רישום/ביטול רישום" [level=6] [ref=e66]
              - generic [ref=e70]:
                - img [ref=e72]
                - generic [ref=e76]:
                  - heading "ערוץ הפגישה" [level=6] [ref=e78]
                  - heading "טלפוני" [level=6] [ref=e80]
              - generic [ref=e83]:
                - generic [ref=e84] [cursor=pointer]:
                  - img [ref=e86]:
                    - generic [ref=e88]: "4"
                  - heading "מועדים פנויים לפגישה" [level=6] [ref=e93]
                - generic [ref=e98]:
                  - generic [ref=e100]:
                    - generic [ref=e101]:
                      - generic [ref=e102] [cursor=pointer]:
                        - generic [ref=e104]: מאי 2026
                        - button "calendar view is open, switch to year view" [ref=e105]:
                          - img [ref=e106]
                      - generic [ref=e108]:
                        - button "Previous month" [disabled]:
                          - img
                        - button "Next month" [ref=e110] [cursor=pointer]:
                          - img [ref=e111]
                    - grid "מאי 2026" [ref=e115]:
                      - row "ראשון שני שלישי רביעי חמישי שישי שבת" [ref=e116]:
                        - columnheader "ראשון" [ref=e117]: א
                        - columnheader "שני" [ref=e118]: ב
                        - columnheader "שלישי" [ref=e119]: ג
                        - columnheader "רביעי" [ref=e120]: ד
                        - columnheader "חמישי" [ref=e121]: ה
                        - columnheader "שישי" [ref=e122]: ו
                        - columnheader "שבת" [ref=e123]: ש
                      - rowgroup [ref=e124]:
                        - row "1 2" [ref=e125]:
                          - gridcell
                          - gridcell
                          - gridcell
                          - gridcell
                          - gridcell
                          - gridcell "1" [disabled]
                          - gridcell "2" [disabled]
                        - row "3 4 5 6 7 8 9" [ref=e126]:
                          - gridcell "3" [disabled]
                          - gridcell "4" [disabled]
                          - gridcell "5" [disabled]
                          - gridcell "6" [disabled]
                          - gridcell "7" [disabled]
                          - gridcell "8" [disabled]
                          - gridcell "9" [disabled]
                        - row "10 11 12 13 14 15 16" [ref=e127]:
                          - gridcell "10" [disabled]
                          - gridcell "11" [ref=e128] [cursor=pointer]
                          - gridcell "12" [disabled]
                          - gridcell "13" [ref=e129] [cursor=pointer]
                          - gridcell "14" [ref=e130] [cursor=pointer]
                          - gridcell "15" [disabled]
                          - gridcell "16" [disabled]
                        - row "17 18 19 20 21 22 23" [ref=e131]:
                          - gridcell "17" [ref=e132] [cursor=pointer]
                          - gridcell "18" [ref=e133] [cursor=pointer]
                          - gridcell "19" [disabled]
                          - gridcell "20" [ref=e134] [cursor=pointer]
                          - gridcell "21" [ref=e135] [cursor=pointer]
                          - gridcell "22" [disabled]
                          - gridcell "23" [disabled]
                        - row "24 25 26 27 28 29 30" [ref=e136]:
                          - gridcell "24" [ref=e137] [cursor=pointer]
                          - gridcell "25" [ref=e138] [cursor=pointer]
                          - gridcell "26" [disabled]
                          - gridcell "27" [ref=e139] [cursor=pointer]
                          - gridcell "28" [ref=e140] [cursor=pointer]
                          - gridcell "29" [disabled]
                          - gridcell "30" [disabled]
                        - row "31" [ref=e141]:
                          - gridcell "31" [ref=e142] [cursor=pointer]
                          - gridcell
                          - gridcell
                          - gridcell
                          - gridcell
                          - gridcell
                          - gridcell
                  - button "חזור" [ref=e144] [cursor=pointer]
              - generic [ref=e146]:
                - img [ref=e148]:
                  - generic [ref=e150]: "5"
                - heading "בחרו שעה ליום" [level=6] [ref=e155]
  - dialog "הסכמת עוגיות" [ref=e156]:
    - paragraph [ref=e158]:
      - text: אנו משתמשים בעוגיות באתר שלנו כדי לשפר את חוויית השימוש שלך, להציע תוכן מוצאם אישית ולנתח את תנועת המשתמשים באתר. לקריאת
      - link "מדיניות עוגיות" [ref=e159] [cursor=pointer]:
        - /url: https://www.rishonlezion.muni.il/Pages/privacy.aspx
      - text: הפרטיות המלאה שלנו.
    - button "מאשר הכל" [ref=e161] [cursor=pointer]
```