"""Fill the 11 months before the latest real month with DEMO data (including a demo
reopened-case rate), so the 12-month trend can be shown before real history exists.
The real month itself is never modified.

Every generated file is marked data_status="demo"; the page labels it clearly.
Delete these files (and stop running this script) once real monthly exports accumulate.

Known real anchor: April 2026 city totals from the monthly report (18,711 cases, 91.9% on time).
"""
import copy
import json
import os
import random
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'transparency', 'public_data')
MIN_CELL = 5
UNASSIGNED = 'ללא שיוך לרובע'
HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי',
              'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']


def month_label(ym):
    y, m = ym.split('-')
    return f'{HEB_MONTHS[int(m) - 1]} {y}'


def suppress(rows, total):
    """Same rule as MokedCore.suppress: hide cells under MIN_CELL plus one complementary cell."""
    small = [r for r in rows if r['cases'] < MIN_CELL]
    if len(small) == 1:
        rest = sorted((r for r in rows if r['cases'] >= MIN_CELL and r['name'] != UNASSIGNED),
                      key=lambda r: r['cases'])
        if rest:
            small.append(rest[0])
    hidden = 0
    for r in small:
        hidden += r['cases']
        for k in list(r):
            if k not in ('id', 'name', 'department'):
                r[k] = None
        r['suppressed'] = True
    return {'total': total, 'suppressed_total': hidden, 'rows': rows}


def rebuild_index():
    months = []
    for fn in sorted(os.listdir(OUT_DIR)):
        if fn == 'index.json' or not fn.endswith('.json'):
            continue
        with open(os.path.join(OUT_DIR, fn), encoding='utf-8') as f:
            d = json.load(f)
        months.append({'month': d['month'], 'month_label': d['month_label'], 'data_status': d['data_status'],
                       'total_cases': d['city']['total_cases'], 'on_time_rate': d['city']['on_time_rate']})
    index = {'latest': months[-1]['month'], 'updated_on': date.today().isoformat(), 'months': months}
    with open(os.path.join(OUT_DIR, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

ANCHORS = {'2026-04': (18711, 91.9)}


def prev_month(ym, n):
    y, m = map(int, ym.split('-'))
    m -= n
    while m < 1:
        m += 12
        y -= 1
    return f'{y}-{m:02d}'


def rescale(rows, total):
    """Scale case counts to hit total exactly."""
    base = sum(r['cases'] for r in rows)
    for r in rows:
        r['cases'] = max(1, round(r['cases'] * total / base))
    rows[0]['cases'] += total - sum(r['cases'] for r in rows)


def jitter_rate(rate, rnd, spread):
    return None if rate is None else round(min(100.0, max(30.0, rate + rnd.uniform(-spread, spread))), 1)


def unsuppress(table):
    """Rows to base a demo month on. Suppressed rows get a small placeholder
    (their real values are not in the public file); reconciliation rows are dropped."""
    rows = []
    for r in table['rows']:
        r = dict(r)
        if r.pop('suppressed', False):
            if r['name'].startswith('ללא שיוך'):
                continue
            r.update(cases=10, on_time_rate=88.0)
        rows.append(r)
    return rows


def weighted(rows):
    rated = [r for r in rows if r.get('on_time_rate') is not None]
    return sum(r['cases'] * r['on_time_rate'] for r in rated) / sum(r['cases'] for r in rated)


def reopened(rnd, on_time):
    # Loosely inverse to on-time performance, 2%-12%
    return round(min(12.0, max(2.0, 3 + (100 - on_time) * 0.25 + rnd.uniform(-1.2, 1.2))), 1)


def add_reopened(d, rnd):
    for key in ('neighborhoods', 'topics'):
        for r in d[key]['rows']:
            if r.get('on_time_rate') is not None:
                r['reopened_rate'] = reopened(rnd, r['on_time_rate'])
    d['city']['reopened_rate'] = reopened(rnd, d['city']['on_time_rate'])
    d['provenance']['reopened_rate'] = 'demo'


def main():
    with open(os.path.join(OUT_DIR, 'index.json'), encoding='utf-8') as f:
        latest_ym = [m for m in json.load(f)['months'] if m['data_status'] == 'real'][-1]['month']
    with open(os.path.join(OUT_DIR, f'{latest_ym}.json'), encoding='utf-8') as f:
        latest = json.load(f)

    rnd = random.Random(106)

    for back in range(1, 12):
        ym = prev_month(latest_ym, back)
        d = copy.deepcopy(latest)
        d['city']['reopened_rate'] = 0  # placeholder; demo value set by add_reopened
        total, city_rate = ANCHORS.get(ym, (round(latest['city']['total_cases'] * rnd.uniform(0.82, 1.08)), None))

        depts = unsuppress(latest['departments'])
        rescale(depts, total)
        for r in depts:
            r['on_time_rate'] = jitter_rate(r['on_time_rate'], rnd, 2.5)
        if city_rate is not None:  # shift so the weighted average lands on the anchor
            shift = city_rate - weighted(depts)
            for r in depts:
                r['on_time_rate'] = round(min(100.0, r['on_time_rate'] + shift), 1)
        city_rate = round(weighted(depts), 1)

        hoods = unsuppress(latest['neighborhoods'])
        rescale(hoods, total)
        for r in hoods:
            r['on_time_rate'] = jitter_rate(r['on_time_rate'], rnd, 4)

        topics = unsuppress(latest['topics'])
        named = [t for t in topics if t['id'] != 'other']
        for t in named:
            t['cases'] = max(1, round(t['cases'] * rnd.uniform(0.6, 1.3) * total / latest['city']['total_cases']))
            t['on_time_rate'] = jitter_rate(t['on_time_rate'], rnd, 5)
        topics[-1]['cases'] = total - sum(t['cases'] for t in named)

        d.update({
            'month': ym, 'month_label': month_label(ym), 'data_status': 'demo',
            'provenance': {'cases': 'demo', 'on_time_rate': 'demo', 'reopened_rate': 'demo'},
            'city': {'total_cases': total, 'on_time_rate': city_rate, 'reopened_rate': None},
            'departments': suppress(depts, total),
            'neighborhoods': suppress(hoods, total),
            'topics': suppress(topics, total),
        })
        for r in d['neighborhoods']['rows']:
            r['reopened_rate'] = None
        add_reopened(d, rnd)
        with open(os.path.join(OUT_DIR, f'{ym}.json'), 'w', encoding='utf-8') as f:
            json.dump(d, f, ensure_ascii=False, indent=1)

    rebuild_index()
    print(f'Demo history written for 11 months before {latest_ym}')


if __name__ == '__main__':
    main()
