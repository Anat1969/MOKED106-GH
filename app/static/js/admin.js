// Monthly report upload: read files in the browser, show every cross-check,
// then send to the moked106-admin function, which re-checks and saves a new version.
const Admin = {
    password: null,     // kept in memory only, never stored
    passwordSet: null,
    files: [],          // { file, kind: 'report' | 'streets' }
    parsed: null,
    month: null,
    checks: null,
};

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function callFunction(body) {
    const res = await fetch(`${STORAGE.url}/functions/v1/${STORAGE.functionName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: STORAGE.key, Authorization: `Bearer ${STORAGE.key}` },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || `שגיאה ${res.status}`), { data, status: res.status });
    return data;
}

// ---------------------------------------------------------------- password
async function initAuth() {
    try {
        const s = await callFunction({ action: 'status' });
        Admin.passwordSet = s.password_set;
    } catch (err) {
        $('storageNotice').hidden = false;
        $('storageNotice').textContent = 'האחסון עדיין לא מחובר, ולכן אי אפשר לשמור כרגע. אפשר להעלות קבצים ולראות את כל בדיקות ההתאמה.';
        $('authCard').hidden = true;
        return;
    }
    if (!Admin.passwordSet) {
        $('authTitle').textContent = 'בחירת סיסמת מנהל (פעם ראשונה)';
        $('authIntro').textContent = 'בחרי סיסמה של 10 תווים לפחות. היא נשמרת רק בצורה מוצפנת, ואף אחד — גם לא Claude — לא יכול לראות אותה. שמרי אותה במקום בטוח.';
        $('pw2Row').hidden = false;
        $('pw2').required = true;
        $('pw1').autocomplete = 'new-password';
        $('authBtn').textContent = 'שמירת הסיסמה';
    }
}

$('authForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('pw1').value;
    const msg = $('authMsg');
    msg.className = 'form-msg';
    try {
        if (!Admin.passwordSet) {
            if (pw !== $('pw2').value) throw new Error('שתי הסיסמאות לא זהות');
            await callFunction({ action: 'set_password', password: pw });
            Admin.passwordSet = true;
        } else {
            await callFunction({ action: 'check', password: pw });
        }
        Admin.password = pw;
        $('authForm').hidden = true;
        $('authTitle').textContent = 'מחוברת כמנהלת';
        $('authIntro').textContent = 'אפשר לשמור דוחות ולהחליף גרסה פעילה.';
        updateSaveButton();
        renderVersions();
    } catch (err) {
        msg.className = 'form-msg err';
        msg.textContent = err.message;
    } finally {
        $('pw1').value = ''; $('pw2').value = '';
    }
});

// ---------------------------------------------------------------- files
const dz = $('dropZone');
dz.addEventListener('click', () => $('fileInput').click());
dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } });
$('fileInput').addEventListener('change', e => addFiles(e.target.files));
dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
dz.addEventListener('dragleave', () => dz.classList.remove('over'));
dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); addFiles(e.dataTransfer.files); });
document.addEventListener('paste', e => { if (e.clipboardData?.files?.length) addFiles(e.clipboardData.files); });

function addFiles(list) {
    for (const file of list) {
        const ext = file.name.split('.').pop().toLowerCase();
        const kind = ext === 'pptx' ? 'report' : (ext === 'xlsx' || ext === 'xls') ? 'streets' : null;
        if (!kind) { alert(`הקובץ ${file.name} אינו pptx או xlsx`); continue; }
        Admin.files = Admin.files.filter(f => f.kind !== kind);   // one of each kind
        Admin.files.push({ file, kind });
    }
    $('fileInput').value = '';
    renderFiles();
    analyze();
}

function renderFiles() {
    $('fileList').innerHTML = Admin.files.map((f, i) => `<li>
        <span>${esc(f.file.name)} <span class="kind">${f.kind === 'report' ? 'דוח מנכ"ל' : 'רחובות'} · ${(f.file.size / 1024).toFixed(0)} KB</span></span>
        <button type="button" data-i="${i}">הסרה</button></li>`).join('');
    $('fileList').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
        Admin.files.splice(+b.dataset.i, 1);
        renderFiles();
        analyze();
    }));
}

async function readSlides(file) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
    return Promise.all(names.map(n => zip.file(n).async('string')));
}

async function readSheet(file) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return { name: file.name, rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) };
}

// ---------------------------------------------------------------- analysis
async function analyze() {
    Admin.parsed = Admin.month = Admin.checks = null;
    $('checkCard').hidden = $('saveCard').hidden = true;
    const report = Admin.files.find(f => f.kind === 'report');
    if (!report) {
        if (Admin.files.length) { $('checkCard').hidden = false; $('detected').innerHTML = '<p class="form-msg err">חסר דוח המנכ"ל (pptx).</p>'; $('keyNumbers').innerHTML = $('checks').innerHTML = ''; }
        return;
    }
    $('checkCard').hidden = false;
    $('detected').textContent = 'קוראת את הקבצים…';
    try {
        const slides = await readSlides(report.file);
        const streetsFile = Admin.files.find(f => f.kind === 'streets');
        const sheet = streetsFile ? await readSheet(streetsFile.file) : null;
        const parsed = MokedCore.parseReport(slides, sheet);
        const m = MokedCore.buildMonth(parsed);
        let prev = null;
        if (m.month && API.index) {
            const prevYm = MokedCore.prevMonthOf(m.month);
            if (API.months().includes(prevYm)) prev = await API.month(prevYm);
        }
        const checks = MokedCore.checkMonth(parsed, m, { prevMonth: prev, exportedOn: new Date().toISOString().slice(0, 10) });
        Admin.parsed = parsed; Admin.month = m; Admin.checks = checks;
        renderAnalysis(m, checks, prev);
    } catch (err) {
        console.error(err);
        $('detected').innerHTML = `<p class="form-msg err">לא הצלחתי לקרוא את הקובץ: ${esc(err.message)}</p>`;
    }
}

function renderAnalysis(m, checks, prev) {
    const existing = m.month && API.index?.months?.[m.month];
    $('detected').innerHTML = m.month
        ? `הדוח הוא של <strong>${esc(m.month_label)}</strong>${m.period ? ` (${esc(m.period)})` : ''}. ` +
          (existing && API.source === 'storage' ? `לחודש זה כבר יש ${existing.versions.length} גרסאות — השמירה תיצור גרסה חדשה ותהפוך אותה לפעילה.` : 'זה חודש חדש במערכת.') +
          (prev ? ` ההשוואה לחודש קודם: ${esc(prev.month_label)}.` : '')
        : '<span class="form-msg err">לא זוהה חודש</span>';
    const s = m.summary || {};
    const n = v => (v == null ? '—' : Number(v).toLocaleString());
    $('keyNumbers').innerHTML = [
        [n(s.total_calls), 'סה"כ פניות'], [s.sla_percent != null ? s.sla_percent + '%' : '—', 'עמידה בתקן'],
        [n(s.overdue_open), 'חורגות ופתוחות'], [m.managers.length, 'מנהלים'], [m.departments.length, 'מחלקות 20/80'],
        [m.issues_top.length, 'נושאים מובילים'], [m.districts.length, 'רובעים'],
        [m.streets ? n(m.streets.rows.length) : '—', m.streets ? `רחובות (${m.streets.kind === 'sheet' ? 'מקובץ הרחובות' : 'מהדוח'})` : 'רחובות'],
    ].map(([v, l]) => `<div><b>${v}</b><span>${l}</span></div>`).join('');
    const group = (cls, title, items) => items.length
        ? `<div class="check-group ${cls}"><h3>${title} (${items.length})</h3><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '';
    $('checks').innerHTML =
        group('err', 'שגיאות — אי אפשר לשמור עד שיתוקנו', checks.errors) +
        group('warn', 'הערות — פערים בדוח המקור (לבדיקה)', checks.warnings) +
        group('ok', 'בדיקות שעברו', checks.ok);
    $('saveCard').hidden = false;
    $('ackRow').hidden = !checks.warnings.length;
    $('ack').checked = false;
    $('saveMsg').textContent = '';
    updateSaveButton();
}

function updateSaveButton() {
    const c = Admin.checks;
    const ready = c && !c.errors.length && (!c.warnings.length || $('ack').checked);
    $('saveBtn').disabled = !(ready && Admin.password);
    $('saveBtn').title = !Admin.password ? 'צריך להיכנס עם סיסמת מנהל' : !ready ? 'יש שגיאות או הערות שלא אושרו' : '';
}
$('ack').addEventListener('change', updateSaveButton);

const toBase64 = async file => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
};

$('saveBtn').addEventListener('click', async () => {
    const msg = $('saveMsg');
    msg.className = 'form-msg';
    msg.textContent = 'שומרת…';
    $('saveBtn').disabled = true;
    try {
        const files = await Promise.all(Admin.files.map(async f => ({ name: f.file.name, kind: f.kind, base64: await toBase64(f.file) })));
        const res = await callFunction({
            // The function re-reads the original files itself; the browser analysis is only a preview
            action: 'upload', password: Admin.password, files,
            note: $('note').value.trim(), acknowledged_warnings: $('ack').checked,
        });
        msg.className = 'form-msg ok';
        msg.innerHTML = `נשמר ופורסם: ${esc(res.month_label)}, גרסה ${esc(res.version)}. <a href="/?month=${res.month}">לדשבורד של החודש</a> · <a href="/shkifut/" target="_blank" rel="noopener">לדף השקיפות</a>`;
        await API.loadIndex();
        renderVersions();
        geocodeMissing(Admin.month);
    } catch (err) {
        msg.className = 'form-msg err';
        const errs = err.data?.checks?.errors;
        msg.innerHTML = esc(err.message) + (errs?.length ? `<ul>${errs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '');
        updateSaveButton();
    }
});

// ---------------------------------------------------------------- map coordinates for new streets
async function geocodeMissing(m) {
    if (!m.heatmap) return;
    const known = { ...MapView.STREET_COORDS, ...(await API.streetCoords()) };
    const missing = m.heatmap.rows.map(r => r.name).filter(n => !known[n]);
    if (!missing.length) return;
    const msg = $('saveMsg');
    const found = {};
    for (const [i, name] of missing.entries()) {
        msg.insertAdjacentHTML('beforeend', i ? '' : `<br><span id="geoMsg"></span>`);
        $('geoMsg').textContent = `מאתרת על המפה רחובות חדשים: ${i + 1}/${missing.length}`;
        try {
            const q = new URLSearchParams({ street: name, city: 'אשדוד', country: 'ישראל', format: 'json', limit: '1' });
            const r = await (await fetch(`https://nominatim.openstreetmap.org/search?${q}`)).json();
            if (r[0]) found[name] = [+(+r[0].lat).toFixed(7), +(+r[0].lon).toFixed(7)];
        } catch { /* skip this street */ }
        await new Promise(res => setTimeout(res, 1100));   // Nominatim: max 1 request per second
    }
    if (Object.keys(found).length) await callFunction({ action: 'geo', password: Admin.password, coords: found });
    const notFound = missing.filter(n => !found[n]);
    $('geoMsg').textContent = `נוספו למפה ${Object.keys(found).length} רחובות.` + (notFound.length ? ` לא אותרו: ${notFound.join(', ')}.` : '');
}

// ---------------------------------------------------------------- versions
async function renderVersions() {
    const box = $('versions');
    if (API.source !== 'storage') {
        box.innerHTML = '<p class="muted">עדיין לא הועלו דוחות לאחסון. כרגע הדשבורד מציג את מאי 2026 מהגרסה המובנית באפליקציה.</p>';
        return;
    }
    const months = API.months().reverse();
    box.innerHTML = `<table class="versions-table"><thead><tr><th>גרסה</th><th>הועלתה</th><th>קבצים</th><th>הערה</th><th>סה"כ / תקן</th><th></th></tr></thead><tbody>${
        months.map(ym => {
            const e = API.index.months[ym];
            return `<tr class="month-row"><th colspan="6">${MokedCore.monthLabel(ym)}</th></tr>` + [...e.versions].reverse().map(v => `<tr>
                <td>${esc(v.id)}</td>
                <td>${v.uploaded_at ? new Date(v.uploaded_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                <td>${(v.files || []).map(esc).join('<br>')}</td>
                <td>${esc(v.note || '')}${v.warnings ? `<br><small class="muted">${v.warnings} הערות אושרו</small>` : ''}</td>
                <td>${v.summary ? `${Number(v.summary.total_calls).toLocaleString()} / ${v.summary.sla_percent}%` : ''}</td>
                <td>${v.id === e.active ? '<span class="active-badge">פעילה</span>'
                    : Admin.password ? `<button type="button" class="btn" data-month="${ym}" data-v="${esc(v.id)}">הפיכה לפעילה</button>` : ''}</td>
            </tr>`).join('');
        }).join('')}</tbody></table>`;
    box.querySelectorAll('button[data-v]').forEach(b => b.addEventListener('click', async () => {
        if (!confirm(`להפוך את גרסה ${b.dataset.v} של ${MokedCore.monthLabel(b.dataset.month)} לפעילה? הדשבורד ודף השקיפות יתעדכנו.`)) return;
        b.disabled = true;
        try {
            await callFunction({ action: 'activate', password: Admin.password, month: b.dataset.month, version: b.dataset.v });
            await API.loadIndex();
            renderVersions();
        } catch (err) { alert(err.message); b.disabled = false; }
    }));
}

(async () => {
    await API.loadIndex().catch(() => null);
    renderVersions();
    initAuth();
})();
