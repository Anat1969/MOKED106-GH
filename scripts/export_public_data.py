"""Export one month of internal hotline data to a PUBLIC aggregated JSON file.

This is the only bridge between the internal database and the public
transparency site. The output contains neighborhood-, division- and
topic-level aggregates only: no streets, no manager names, no personal data.
Any cell with fewer than MIN_CELL cases is suppressed.

Usage:
    python scripts/export_public_data.py            # exports the month in monthly_summary
    python scripts/export_public_data.py --db path/to/moked106.db
"""
import argparse
import json
import os
import sqlite3
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DB = os.path.join(ROOT, 'app', 'moked106.db')
OUT_DIR = os.path.join(ROOT, 'transparency', 'public_data')

MIN_CELL = 5
UNASSIGNED = 'ללא שיוך לרובע'
HEB_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי',
              'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']


def month_label(ym):
    y, m = ym.split('-')
    return f'{HEB_MONTHS[int(m) - 1]} {y}'


def standard_parts(sla_time):
    """Internal standard is stored as DD:HH:MM (e.g. 00:16:00 = 16 hours, 60:00:00 = 60 days)."""
    d, h, m = (int(x) for x in sla_time.split(':'))
    return d, h, m


def standard_text(d, h, m):
    def days(n):
        return {1: 'יום', 2: 'יומיים'}.get(n, f'{n} ימים')

    def hours(n):
        return {1: 'שעה', 2: 'שעתיים'}.get(n, f'{n} שעות')

    if d and not h and not m:
        return days(d)
    if not d and h and m == 30:
        return f'{hours(h)} וחצי'
    if not d and not h:
        return f'{m} דקות'
    parts = []
    if d:
        parts.append(days(d))
    if h:
        parts.append(hours(h))
    if m:
        parts.append(f'{m} דקות')
    return ' ו-'.join(parts)


def suppress(rows, total):
    """Suppress cells under MIN_CELL, plus one complementary cell when only one
    is small (otherwise it could be recovered as total minus the rest)."""
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


def export(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    summary = conn.execute('SELECT month, year, total_calls, sla_percent FROM monthly_summary').fetchone()
    ym = f"{summary['year']}-{HEB_MONTHS.index(summary['month']) + 1:02d}"
    total = summary['total_calls']

    # Division level (the internal "managers" table is keyed by division name only)
    departments = [
        {'name': r['name'], 'cases': r['total_calls'], 'on_time_rate': round(r['sla_percent'], 1)}
        for r in conn.execute('SELECT name, total_calls, sla_percent FROM managers ORDER BY total_calls DESC')
    ]
    gap = total - sum(d['cases'] for d in departments)
    if gap < 0:
        raise SystemExit(f'Divisions sum to more than the monthly total ({-gap} extra): fix the source report')
    if gap:  # the source report's divisions do not fully add up to its total
        departments.append({'name': 'ללא שיוך לאגף', 'cases': gap, 'on_time_rate': None})

    # Neighborhood level; cases without a neighborhood are reported as one row so totals reconcile
    neighborhoods = [
        {'name': r['name'], 'cases': r['total_calls'], 'on_time_rate': round(r['sla_percent'], 1),
         'reopened_rate': None}
        for r in conn.execute('SELECT name, total_calls, sla_percent FROM districts ORDER BY id')
    ]
    unassigned = total - sum(n['cases'] for n in neighborhoods)
    neighborhoods.append({'name': UNASSIGNED, 'cases': unassigned, 'on_time_rate': None, 'reopened_rate': None})

    # Leading topics (one source only: the monthly top-10 table)
    topics = []
    for r in conn.execute(
            'SELECT department, issue_name, sla_time, total_calls, sla_percent FROM issues '
            'WHERE is_top10 = 1 ORDER BY total_calls DESC'):
        d, h, m = standard_parts(r['sla_time'])
        topics.append({
            'id': r['issue_name'],  # stable across months; content files refer to it
            'name': r['issue_name'],
            'department': r['department'],
            'standard_hours': round(d * 24 + h + m / 60, 2),
            'standard_text': standard_text(d, h, m),
            'cases': r['total_calls'],
            'on_time_rate': round(r['sla_percent'], 1),
            'reopened_rate': None,
        })
    topics.append({'id': 'other', 'name': 'כל שאר הנושאים', 'department': None, 'standard_hours': None,
                   'standard_text': None, 'cases': total - sum(t['cases'] for t in topics),
                   'on_time_rate': None, 'reopened_rate': None})
    conn.close()

    data = {
        'schema_version': 1,
        'month': ym,
        'month_label': month_label(ym),
        'data_status': 'real',
        'provenance': {'cases': 'real', 'on_time_rate': 'real', 'reopened_rate': 'not_collected'},
        'exported_on': date.today().isoformat(),
        'min_cell_size': MIN_CELL,
        'city': {'total_cases': total, 'on_time_rate': round(summary['sla_percent'], 1), 'reopened_rate': None},
        'departments': suppress(departments, total),
        'neighborhoods': suppress(neighborhoods, total),
        'topics': suppress(topics, total),
    }
    write_month(data)
    return ym


def write_month(data):
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, f"{data['month']}.json"), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    rebuild_index()


def rebuild_index():
    """index.json lists the available months with their headline numbers."""
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


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--db', default=DEFAULT_DB)
    ym = export(p.parse_args().db)
    print(f'Exported {ym} -> transparency/public_data/{ym}.json')
