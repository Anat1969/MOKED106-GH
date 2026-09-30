"""Fill the 11 months before the latest real export with DEMO data, and add a demo
reopened-case rate, so the 12-month trend can be shown before real history exists.

Every generated file is marked data_status="demo"; the page labels it clearly.
Delete these files (and stop running this script) once real monthly exports accumulate.

Known real anchor: April 2026 city totals from the monthly report (18,711 cases, 91.9% on time).
"""
import copy
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from export_public_data import OUT_DIR, UNASSIGNED, month_label, rebuild_index, suppress  # noqa: E402

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
    if latest['provenance']['reopened_rate'] != 'real':
        add_reopened(latest, rnd)
        with open(os.path.join(OUT_DIR, f'{latest_ym}.json'), 'w', encoding='utf-8') as f:
            json.dump(latest, f, ensure_ascii=False, indent=1)

    for back in range(1, 12):
        ym = prev_month(latest_ym, back)
        d = copy.deepcopy(latest)
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
