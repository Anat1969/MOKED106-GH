const Sidebar = {
    el: null,

    init() {
        this.el = document.getElementById('sidebarRef');
    },

    stats: null,     // per displayed month, set by app.js
    tab: 'overview',

    update(tab) {
        if (tab) this.tab = tab;
        if (!this.el || !this.stats) return;
        const content = this.content[this.tab] || this.content['overview'];
        this.el.innerHTML = content(this.stats);
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
        overview: s => `
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
                <div class="sb-item"><span class="sb-val">${s.total}</span> — סה"כ פניות ${s.monthLabel}</div>
                <div class="sb-item"><span class="sb-val">${s.managersCount}</span> — מנהלים</div>
                <div class="sb-item"><span class="sb-val">${s.deptCount}</span> — מחלקות מובילות (${s.deptShare})</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">הנחות יסוד</div>
                <div class="sb-item">תקופת דיווח: ${s.period}</div>
                <div class="sb-item">השוואה לחודש קודם: ${s.prevNote}</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מוקד עירוני 106, ${s.monthLabel}</div>
                <div class="sb-item">${s.versionNote}</div>
            </div>`,

        managers: s => `
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
                <div class="sb-item"><span class="sb-val">${s.managersCount}</span> מנהלים בסה"כ</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">סוגי קווים בגרף</div>
                <div class="sb-row"><span class="sb-line-solid"></span> ${s.monthLabel}</div>
                <div class="sb-row"><span class="sb-line-dashed-gray"></span> ממוצע ${s.prevYear}</div>
                <div class="sb-row"><span class="sb-line-dashed-red"></span> יעד תקן 80%</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מנכ"ל מוקד עירוני, ${s.monthLabel}</div>
            </div>`,

        departments: s => `
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
                <div class="sb-item">${s.deptCount} מחלקות מובילות = <span class="sb-val">${s.deptShare}</span> מכלל הפניות</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">שינוי חיובי / שלילי</div>
                <div class="sb-row"><span class="trend good">▲</span> עלייה בעמידה בתקן = שיפור</div>
                <div class="sb-row"><span class="trend bad">▲</span> עלייה בכמות פניות = החמרה</div>
                <div class="sb-row"><span class="trend good">▼</span> ירידה בכמות פניות = שיפור</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח 20/80 מוקד עירוני, ${s.monthLabel}</div>
            </div>`,

        issues: s => `
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
                <div class="sb-item">${s.topCount} נושאים מובילים = <span class="sb-val">${s.topShare}</span> מכלל הפניות</div>
                <div class="sb-item">${s.belowCount} נושאים מתחת ל-80% = <span class="sb-val">${s.belowShare}</span> מכלל הפניות</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">דוגמאות זמן תקן</div>
                ${s.slaExamples}
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מוקד עירוני 106, ${s.monthLabel}</div>
            </div>`,

        heatmap: s => `
            <div class="sb-section">
                <div class="sb-title">מקרא טבלת חום</div>
                <div class="sb-row"><span class="sb-dot" style="background:#FFD600"></span> 70%+ מהמקסימום בעמודה</div>
                <div class="sb-row"><span class="sb-dot" style="background:#FFF9C4"></span> 40%–70% מהמקסימום</div>
                <div class="sb-row"><span class="sb-dot" style="background:#fff;border:1px solid #ccc"></span> ללא דגש</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">קבועים</div>
                <div class="sb-item"><span class="sb-val">${s.heatStreets}</span> רחובות מובילים</div>
                <div class="sb-item"><span class="sb-val">${s.heatTopics}</span> נושאים</div>
                <div class="sb-item"><span class="sb-val">${s.heatTotal}</span> פניות בטבלה</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">הנחות</div>
                <div class="sb-item">הטבלה מציגה רק רחובות עם ריבוי פניות (${s.heatMin}+)</div>
                <div class="sb-item">צהוב מסמן מוקד בעיה גיאוגרפי</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">${s.heatSource}, ${s.monthLabel}</div>
            </div>`,

        map: s => `
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
                <div class="sb-item">נתונים: דוח מוקד 106, ${s.monthLabel}</div>
            </div>`,

        districts: s => `
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
                <div class="sb-item"><span class="sb-val">${s.districtsCount}</span> רובעים ואזורים</div>
                <div class="sb-item"><span class="sb-val">${s.districtsTotal}</span> פניות משויכות לרובע (מתוך ${s.total})</div>
                <div class="sb-item">פניות ל-100 תושבים = מדד עומס יחסי</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">הנחות</div>
                <div class="sb-item">כמות תושבים — נתוני עירייה</div>
                <div class="sb-item">אזורי תעשייה/חוף — ללא נתוני תושבים</div>
            </div>
            <div class="sb-section">
                <div class="sb-title">מקור</div>
                <div class="sb-item">דוח מוקד 106 — פילוח רובעים, ${s.monthLabel}</div>
            </div>`
    }
};
