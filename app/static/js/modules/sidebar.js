const Sidebar = {
    el: null,

    init() {
        this.el = document.getElementById('sidebarRef');
    },

    update(tab) {
        if (!this.el) return;
        const content = this.content[tab] || this.content['overview'];
        this.el.innerHTML = content;
    },

    colorLegend: `
        <div class="sb-section">
            <div class="sb-title">מקרא צבעים — תקן</div>
            <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> 90% ומעלה</div>
            <div class="sb-row"><span class="sb-dot" style="background:#558B2F"></span> 80%–90%</div>
            <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> 70%–80%</div>
            <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> מתחת ל-70%</div>
            <div class="sb-row"><span class="sb-line"></span> קו יעד 80%</div>
        </div>`,

    content: {
        overview: `
            <div class="sb-section">
                <div class="sb-title">מקרא צבעים — תקן</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> 90% ומעלה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#558B2F"></span> 80%–90%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> 70%–80%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> מתחת ל-70%</div>
                <div class="sb-row"><span class="sb-line"></span> קו יעד 80%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">תקנים וקבועים</div>
                <div class="sb-item"><span class="sb-val">80%</span> — יעד עמידה בתקן לכל מנהל</div>
                <div class="sb-item"><span class="sb-val">21,084</span> — סה"כ פניות מאי 2026</div>
                <div class="sb-item"><span class="sb-val">7</span> — מנהלים</div>
                <div class="sb-item"><span class="sb-val">8</span> — מחלקות מובילות (53%)</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">הנחות יסוד</div>
                <div class="sb-item">תקופת דיווח: 1.5–31.5.2026</div>
                <div class="sb-item">חודש קודם לצורך השוואה: אפריל 2026</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מוקד עירוני 106</div>
                <div class="sb-item">מערכת CW</div>
            </div>`,

        managers: `
            <div class="sb-section">
                <div class="sb-title">מקרא צבעים — תקן</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> 90% ומעלה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#558B2F"></span> 80%–90%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> 70%–80%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> מתחת ל-70%</div>
                <div class="sb-row"><span class="sb-line"></span> קו יעד 80%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">תקנים</div>
                <div class="sb-item"><span class="sb-val">80%</span> — יעד עמידה בזמן תקן לכל מנהל</div>
                <div class="sb-item">מנהל שמתחת ל-80% — נכנס לרשימת חריגים</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">קבועים</div>
                <div class="sb-item"><span class="sb-val">7</span> מנהלים בסה"כ</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">סוגי קווים בגרף</div>
                <div class="sb-row"><span class="sb-line-solid"></span> מאי 2026</div>
                <div class="sb-row"><span class="sb-line-dashed-gray"></span> ממוצע 2025</div>
                <div class="sb-row"><span class="sb-line-dashed-red"></span> יעד תקן 80%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מנכ"ל מוקד עירוני, מאי 2026</div>
            </div>`,

        departments: `
            <div class="sb-section">
                <div class="sb-title">מקרא צבעים — תקן</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> 90% ומעלה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#558B2F"></span> 80%–90%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> 70%–80%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> מתחת ל-70%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">תקנים</div>
                <div class="sb-item"><span class="sb-val">80%</span> — יעד עמידה בתקן לכל מחלקה</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">עקרון 20/80</div>
                <div class="sb-item">20% מהמחלקות מטפלות ב-80% מהפניות</div>
                <div class="sb-item">8 מחלקות מובילות = <span class="sb-val">53%</span> מכלל הפניות</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">שינוי חיובי / שלילי</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> שיפור מחודש קודם</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> ירידה מחודש קודם</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח 20/80 מוקד עירוני, מאי 2026</div>
            </div>`,

        issues: `
            <div class="sb-section">
                <div class="sb-title">מקרא צבעים — תקן</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> 90% ומעלה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#558B2F"></span> 80%–90%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> 70%–80%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> מתחת ל-70%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">תקנים</div>
                <div class="sb-item"><span class="sb-val">80%</span> — סף עמידה בתקן</div>
                <div class="sb-item">לכל נושא זמן תקן ייעודי (עמודת "זמן תקן")</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">קבועים</div>
                <div class="sb-item">10 נושאים מובילים = <span class="sb-val">24.7%</span> מכלל הפניות</div>
                <div class="sb-item">10 נושאים מתחת ל-80% = <span class="sb-val">6%</span> מכלל הפניות</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">דוגמאות זמן תקן</div>
                <div class="sb-item">פינוי אשפה ביתית: <span class="sb-val">16 דק'</span></div>
                <div class="sb-item">רכב נטוש: <span class="sb-val">60 שעות</span></div>
                <div class="sb-item">חיות פצועות: <span class="sb-val">1 שעה</span></div>
                <div class="sb-item">טפטפת קרועה: <span class="sb-val">6 שעות</span></div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מוקד עירוני 106, מאי 2026</div>
            </div>`,

        heatmap: `
            <div class="sb-section">
                <div class="sb-title">מקרא טבלת חום</div>
                <div class="sb-row"><span class="sb-dot" style="background:#FFD600"></span> 70%+ מהמקסימום בעמודה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#FFF9C4"></span> 40%–70% מהמקסימום</div>
                <div class="sb-row"><span class="sb-dot" style="background:#fff;border:1px solid #ccc"></span> ללא דגש</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">קבועים</div>
                <div class="sb-item"><span class="sb-val">19</span> רחובות מובילים</div>
                <div class="sb-item"><span class="sb-val">10</span> נושאים מובילים</div>
                <div class="sb-item"><span class="sb-val">4,621</span> פניות בטבלה</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">הנחות</div>
                <div class="sb-item">הטבלה מציגה רק רחובות עם ריבוי פניות (38+)</div>
                <div class="sb-item">צהוב מסמן מוקד בעיה גיאוגרפי</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">שקופית מפת חום — 10 נושאים מובילים, מאי 2026</div>
            </div>`,

        map: `
            <div class="sb-section">
                <div class="sb-title">מקרא מפה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> מעט פניות</div>
                <div class="sb-row"><span class="sb-dot" style="background:#FFD600"></span> כמות בינונית</div>
                <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> כמות גבוהה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> כמות גבוהה מאוד</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">קנה מידה</div>
                <div class="sb-item">גודל העיגול = כמות פניות</div>
                <div class="sb-item">לחיצה על עיגול = פרטים</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">רמות זום</div>
                <div class="sb-item"><span class="sb-val">עיר</span> — כל אשדוד</div>
                <div class="sb-item"><span class="sb-val">רובע</span> — התמקדות ברובע</div>
                <div class="sb-item"><span class="sb-val">רחוב</span> — רמת רחוב</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מצבי תצוגה</div>
                <div class="sb-item">לפי כמות פניות — ירוק→אדום</div>
                <div class="sb-item">לפי עמידה בתקן — ירוק→אדום</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">מיקומים: OpenStreetMap</div>
                <div class="sb-item">נתונים: דוח מוקד 106, מאי 2026</div>
            </div>`,

        districts: `
            <div class="sb-section">
                <div class="sb-title">מקרא צבעים — תקן</div>
                <div class="sb-row"><span class="sb-dot" style="background:#2E7D32"></span> 90% ומעלה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#558B2F"></span> 80%–90%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#EF6C00"></span> 70%–80%</div>
                <div class="sb-row"><span class="sb-dot" style="background:#C62828"></span> מתחת ל-70%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">תקנים</div>
                <div class="sb-item"><span class="sb-val">80%</span> — יעד עמידה בתקן לכל רובע</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">קבועים</div>
                <div class="sb-item"><span class="sb-val">29</span> רובעים ואזורים</div>
                <div class="sb-item"><span class="sb-val">18,710</span> סה"כ פניות (כולל כפולות)</div>
                <div class="sb-item">פניות ל-100 תושבים = מדד עומס יחסי</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">הנחות</div>
                <div class="sb-item">כמות תושבים — נתוני עירייה</div>
                <div class="sb-item">אזורי תעשייה/חוף — ללא נתוני תושבים</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מוקד 106 — פילוח רובעים, מאי 2026</div>
            </div>`
    }
};
