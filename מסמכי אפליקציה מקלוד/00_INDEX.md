# 📚 Documentation Index — תוכן עניינים

---

## 🎯 סדר קריאה מומלץ

### 👉 התחל כאן
1. **[README.md](./docs_1_README.md)** — הסבר כללי על הפרויקט
   - מטרה של האפליקציה
   - ארכיטקטורה כללית (תמצית)
   - מבנה הפרויקט (תיאור קצר)

### 🔧 התקנה
2. **[SETUP.md](./docs_2_SETUP.md)** — התקנה וביצוע ראשוני
   - דרישות מחשב
   - צעדי התקנה
   - ביצוע ראשוני
   - Troubleshooting

### 🏗️ מבנה
3. **[PROJECT_STRUCTURE.md](./docs_3_PROJECT_STRUCTURE.md)** — מבנה מלא
   - תיקיות וקבצים
   - מי עושה מה
   - צעדי הרחבה

### 💾 פיתוח
4. בחר לפי המשימה שלך:

   **אם בונה Backend:**
   - [BACKEND_GUIDE.md](./docs_4_BACKEND_GUIDE.md) — ארכיטקטורה Flask
   - [DATABASE_GUIDE.md](./docs_6_DATABASE_GUIDE.md) — סכמה וקשרים
   - [API_REFERENCE.md](./docs_7_API_REFERENCE.md) — כל ה-endpoints

   **אם בונה Frontend:**
   - [FRONTEND_GUIDE.md](./docs_5_FRONTEND_GUIDE.md) — ארכיטקטורה JS
   - [API_REFERENCE.md](./docs_7_API_REFERENCE.md) — איך לקרוא API

   **אם מוסיף פיצ'ר:**
   - [DEVELOPMENT.md](./docs_8_DEVELOPMENT.md) — דוגמה מלאה

### ⚙️ הגדרות
5. **[CONFIG.md](./docs_9_CONFIG.md)** — משתנים סביבה ו-settings
   - Environment variables
   - Feature flags
   - Security settings

### 🚀 ייצור
6. **[DEPLOYMENT.md](./docs_10_DEPLOYMENT.md)** — הריצה בפרודקשן
   - Server setup
   - Database migration
   - HTTPS + Nginx
   - Backups

---

## 📋 ערוך המסמכים (בקצרה)

| # | שם | מטרה | קהל | גדול |
|---|-----|--------|------|------|
| 1 | README.md | הסבר כללי | כל אחד | קטן |
| 2 | SETUP.md | התקנה | DevOps | קטן |
| 3 | PROJECT_STRUCTURE.md | מבנה | ארכיטקט | בינוני |
| 4 | BACKEND_GUIDE.md | Flask + Python | Backend dev | בינוני |
| 5 | FRONTEND_GUIDE.md | JS + HTML + CSS | Frontend dev | גדול |
| 6 | DATABASE_GUIDE.md | SQL + סכמה | DBA / Backend | גדול |
| 7 | API_REFERENCE.md | כל ה-endpoints | All | בינוני |
| 8 | DEVELOPMENT.md | הוספת פיצ'רים | Backend dev | גדול |
| 9 | CONFIG.md | Env + Settings | DevOps | בינוני |
| 10 | DEPLOYMENT.md | Linux + Production | DevOps | גדול |

---

## 🎯 קצרים לפי תפקיד

### 👨‍💼 מנהל פרויקט
1. README.md
2. PROJECT_STRUCTURE.md
3. DEPLOYMENT.md (סקירה כללית)

### 💻 Backend Developer
1. README.md
2. SETUP.md
3. BACKEND_GUIDE.md
4. DATABASE_GUIDE.md
5. API_REFERENCE.md
6. DEVELOPMENT.md
7. CONFIG.md (Env variables)

### 🎨 Frontend Developer
1. README.md
2. SETUP.md
3. FRONTEND_GUIDE.md
4. API_REFERENCE.md
5. CONFIG.md (Frontend constants)

### 🔧 DevOps / System Admin
1. SETUP.md
2. CONFIG.md
3. DEPLOYMENT.md
4. DATABASE_GUIDE.md (backups)

### 🚀 Full Stack (כולם)
קרא בסדר: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

---

## 🔍 מציאת דברים ספציפיים

### "איך מתקינים את האפליקציה?"
→ [SETUP.md](./docs_2_SETUP.md)

### "מה המבנה של הפרויקט?"
→ [PROJECT_STRUCTURE.md](./docs_3_PROJECT_STRUCTURE.md)

### "איך כותבים endpoint חדש?"
→ [BACKEND_GUIDE.md](./docs_4_BACKEND_GUIDE.md) + [DEVELOPMENT.md](./docs_8_DEVELOPMENT.md)

### "איך כותבים module חדש בフrontend?"
→ [FRONTEND_GUIDE.md](./docs_5_FRONTEND_GUIDE.md)

### "מה טבלאות המסד?"
→ [DATABASE_GUIDE.md](./docs_6_DATABASE_GUIDE.md)

### "מה כל ה-API endpoints?"
→ [API_REFERENCE.md](./docs_7_API_REFERENCE.md)

### "איך מוסיפים פיצ'ר חדש (מלא)?"
→ [DEVELOPMENT.md](./docs_8_DEVELOPMENT.md)

### "איך משדרגים לפרודקשן?"
→ [DEPLOYMENT.md](./docs_10_DEPLOYMENT.md)

---

## 💡 Key Concepts

### Architecture
```
Frontend (Vanilla JS) ←→ Backend (Flask) ←→ Database (SQLite/PostgreSQL)
  |                           |                       |
  modules/                  routes/                schema.sql
  app.js                    services/              models/
  api.js                    models/
```

### Modules
- **Backend:** Routes → Services → Models → DB
- **Frontend:** Modules → AppState → DOM

### Data Flow
User interacts → Module → AppState → Re-render → New state

---

## 🔄 Update Cycle

**When you modify:**
- Database schema → Update DATABASE_GUIDE.md
- API endpoint → Update API_REFERENCE.md
- New feature → Add to DEVELOPMENT.md
- New module → Add to PROJECT_STRUCTURE.md, FRONTEND_GUIDE.md
- New service → Add to BACKEND_GUIDE.md

---

## ✅ Checklist (Starting Fresh)

- [ ] Read README.md (הבנת הרעיון)
- [ ] Run SETUP.md (התקנה)
- [ ] Read PROJECT_STRUCTURE.md (ממשק המבנה)
- [ ] Choose your path (Backend / Frontend / Both)
- [ ] Read relevant guides (Backend / Frontend)
- [ ] Read API_REFERENCE.md
- [ ] Try to run the app
- [ ] Read DEVELOPMENT.md (להוסיף דברים)
- [ ] Bookmark this INDEX

---

## 📞 Support

**תיקייה בעיות?**
1. תחפש ב[Troubleshooting](./docs_2_SETUP.md#troubleshooting)
2. תצפה בלוגים: `tail -f logs/app.log`
3. תבדוק את `.env` שלך

**שאלה מדעית?**
1. דוג ב-INDEX ימינה
2. קרא את הקובץ הרלוואנטי
3. אם זה לא שם, תשאל

---

## 📈 Document Metrics

- **Total lines:** ~2500
- **Code examples:** 150+
- **Endpoints documented:** 20+
- **Tables documented:** 8
- **Modules documented:** 10
- **Guides covered:** 10 areas

---

## 🔐 Version

**Documentation Version:** 1.0
**Last Updated:** June 5, 2026
**Status:** Production Ready

---

**הכל מיושר, מסודר, ומוכן ללעקוב בצעדים.**

**📌 דע לא לדלג על SETUP.md - ההתקנה חשובה.**

