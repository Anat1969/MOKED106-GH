// Small dependency-free SVG charts. Time runs left (oldest) to right (latest).
// A point is { label, value, demo }; value may be null (gap). Demo points are hollow.
const Charts = (() => {
    const NS = 'http://www.w3.org/2000/svg';

    function el(name, attrs = {}, text) {
        const n = document.createElementNS(NS, name);
        for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
        if (text != null) n.textContent = text;
        return n;
    }

    function svg(w, h, label) {
        const s = el('svg', { viewBox: `0 0 ${w} ${h}`, role: 'img', 'aria-label': label, direction: 'ltr' });
        s.style.direction = 'ltr';
        return s;
    }

    // Split into runs so real and demo stretches get their own line style
    function segments(pts, x, y) {
        const segs = [];
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            if (a.value == null || b.value == null) continue;
            segs.push({ d: `M${x(i - 1)},${y(a.value)}L${x(i)},${y(b.value)}`, demo: a.demo || b.demo });
        }
        return segs;
    }

    // Round step (1, 2, 5 x 10^k) giving about `n` intervals
    function niceStep(range, n = 4) {
        const raw = range / n, mag = 10 ** Math.floor(Math.log10(raw));
        return [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw);
    }

    function line(container, pts, opts = {}) {
        const W = 340, H = 170, P = { t: 14, r: 12, b: 26, l: 34 };
        const vals = pts.map(p => p.value).filter(v => v != null);
        const fmt = opts.fmt || (v => v);
        let lo = Math.min(...vals, opts.goal ?? Infinity) - 1;
        let hi = Math.max(...vals) + 1;
        if (opts.min != null) lo = opts.min;
        if (opts.max != null) hi = Math.min(opts.max, hi);
        const step = niceStep(hi - lo);
        const min = Math.floor(lo / step) * step;
        const max = Math.ceil(hi / step) * step;
        const x = i => P.l + (pts.length === 1 ? (W - P.l - P.r) / 2 : i * (W - P.l - P.r) / (pts.length - 1));
        const y = v => P.t + (max - v) * (H - P.t - P.b) / (max - min);
        const cls = opts.gold ? ' gold' : '';

        const s = svg(W, H, opts.label || '');
        const grid = el('g', { class: 'grid' });
        const axis = el('g', { class: 'axis' });
        for (let v = min; v <= max + 1e-9; v += step) {
            grid.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v) }));
            axis.appendChild(el('text', { x: P.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmt(Math.round(v * 10) / 10)));
        }
        const every = pts.length > 8 ? 2 : 1;
        pts.forEach((p, i) => {
            if ((pts.length - 1 - i) % every === 0) {
                axis.appendChild(el('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, p.label));
            }
        });
        s.append(grid, axis);

        if (opts.goal != null) {
            s.appendChild(el('line', { class: 'goal', x1: P.l, x2: W - P.r, y1: y(opts.goal), y2: y(opts.goal) }));
        }
        for (const seg of segments(pts, x, y)) {
            s.appendChild(el('path', { d: seg.d, class: `series${cls}${seg.demo ? ' demo' : ''}` }));
        }
        pts.forEach((p, i) => {
            if (p.value == null) return;
            const c = el('circle', { cx: x(i), cy: y(p.value), r: 4, class: `pt${cls}${p.demo ? ' demo' : ''}` });
            c.appendChild(el('title', {}, `${p.full || p.label}: ${fmt(p.value)}${p.demo ? ' (הדגמה)' : ''}`));
            s.appendChild(c);
        });
        container.replaceChildren(s);
        container.classList.add('chart');
    }

    function bars(container, pts, opts = {}) {
        const W = 340, H = 150, P = { t: 18, r: 12, b: 26, l: 40 };
        const top = Math.max(...pts.map(p => p.value || 0)) || 1;
        const tick = niceStep(top, 3);
        const max = Math.ceil(top / tick) * tick;
        const bw = (W - P.l - P.r) / pts.length;
        const y = v => P.t + (max - v) * (H - P.t - P.b) / max;
        const fmt = opts.fmt || (v => v.toLocaleString('he-IL'));
        const s = svg(W, H, opts.label || '');
        const axis = el('g', { class: 'axis' });
        const grid = el('g', { class: 'grid' });
        for (let v = 0; v <= max + 1e-9; v += tick) {
            grid.appendChild(el('line', { x1: P.l, x2: W - P.r, y1: y(v), y2: y(v) }));
            axis.appendChild(el('text', { x: P.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, fmt(Math.round(v))));
        }
        s.append(grid, axis);
        const every = pts.length > 8 ? 2 : 1;
        pts.forEach((p, i) => {
            const cx = P.l + i * bw + bw / 2;
            if (p.value != null) {
                const r = el('rect', { class: `bar${p.demo ? ' demo' : ''}`, x: cx - bw * 0.32, width: bw * 0.64,
                    y: y(p.value), height: Math.max(1, H - P.b - y(p.value)), rx: 2 });
                r.appendChild(el('title', {}, `${p.full || p.label}: ${fmt(p.value)}${p.demo ? ' (הדגמה)' : ''}`));
                s.appendChild(r);
            }
            if ((pts.length - 1 - i) % every === 0) {
                axis.appendChild(el('text', { x: cx, y: H - 6, 'text-anchor': 'middle' }, p.label));
            }
        });
        container.replaceChildren(s);
        container.classList.add('chart');
    }

    function spark(container, pts, opts = {}) {
        const W = 100, H = 30, P = 4;
        const vals = pts.map(p => p.value).filter(v => v != null);
        if (vals.length < 2) { container.textContent = ''; return; }
        const min = Math.min(...vals) - 1, max = Math.max(...vals) + 1;
        const x = i => P + i * (W - 2 * P) / (pts.length - 1);
        const y = v => P + (max - v) * (H - 2 * P) / (max - min);
        const s = svg(W, H, opts.label || '');
        for (const seg of segments(pts, x, y)) {
            s.appendChild(el('path', { d: seg.d, class: `series${seg.demo ? ' demo' : ''}` }));
        }
        const i = pts.length - 1;
        if (pts[i].value != null) s.appendChild(el('circle', { cx: x(i), cy: y(pts[i].value), r: 3, class: `pt${pts[i].demo ? ' demo' : ''}` }));
        container.replaceChildren(s);
        container.classList.add('chart');
    }

    return { line, bars, spark };
})();
