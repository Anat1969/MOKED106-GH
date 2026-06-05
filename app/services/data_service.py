from models.database import query_db

def get_summary():
    return query_db("SELECT * FROM monthly_summary ORDER BY year DESC, month DESC LIMIT 1", one=True)

def get_managers():
    return query_db("SELECT * FROM managers ORDER BY total_calls DESC")

def get_departments():
    return query_db("SELECT * FROM departments ORDER BY total_calls DESC")

def get_top_issues():
    return query_db("SELECT * FROM top_issues")

def get_critical_issues():
    return query_db("SELECT * FROM critical_issues")

def get_all_issues():
    return query_db("SELECT * FROM issues ORDER BY total_calls DESC")

def get_heatmap_data():
    rows = query_db("""
        SELECT s.name as street, sic.issue_name, sic.call_count
        FROM street_issue_calls sic
        JOIN streets s ON s.id = sic.street_id
        ORDER BY s.name
    """)
    streets = {}
    issues = set()
    for row in rows:
        street = row['street']
        issue = row['issue_name']
        issues.add(issue)
        if street not in streets:
            streets[street] = {}
        streets[street][issue] = row['call_count']

    issue_list = sorted(issues)
    heatmap = []
    for street, data in sorted(streets.items(), key=lambda x: sum(x[1].values())):
        entry = {'street': street, 'total': sum(data.values())}
        for issue in issue_list:
            entry[issue] = data.get(issue, 0)
        heatmap.append(entry)

    return {'issues': issue_list, 'data': heatmap}

def get_districts():
    return query_db("SELECT * FROM district_stats")

def get_district_details(district_id):
    district = query_db("SELECT * FROM districts WHERE id = ?", [district_id], one=True)
    issues = query_db("""
        SELECT issue_name, call_count FROM district_issue_calls
        WHERE district_id = ? ORDER BY call_count DESC
    """, [district_id])
    return {'district': district, 'issues': issues}
