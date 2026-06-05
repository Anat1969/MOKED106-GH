-- Moked 106 Database Schema

CREATE TABLE IF NOT EXISTS managers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_calls INTEGER NOT NULL,
    sla_percent REAL NOT NULL,
    sla_change REAL,
    sla_2025 REAL,
    overdue_open INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    total_calls INTEGER NOT NULL,
    calls_change_percent REAL,
    sla_percent REAL NOT NULL,
    sla_change REAL,
    overdue_open INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department TEXT NOT NULL,
    issue_name TEXT NOT NULL,
    sla_time TEXT,
    total_calls INTEGER NOT NULL,
    sla_percent REAL NOT NULL,
    avg_handling_time TEXT,
    is_top10 INTEGER DEFAULT 0,
    is_below80 INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS streets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS street_issue_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    street_id INTEGER NOT NULL,
    issue_name TEXT NOT NULL,
    call_count INTEGER NOT NULL,
    FOREIGN KEY (street_id) REFERENCES streets(id)
);

CREATE TABLE IF NOT EXISTS districts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    population INTEGER,
    total_calls INTEGER NOT NULL,
    calls_percent REAL,
    calls_per_resident REAL,
    sla_percent REAL,
    overdue_open INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS district_issue_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    district_id INTEGER NOT NULL,
    issue_name TEXT NOT NULL,
    call_count INTEGER NOT NULL,
    FOREIGN KEY (district_id) REFERENCES districts(id)
);

CREATE TABLE IF NOT EXISTS monthly_summary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    year INTEGER NOT NULL,
    total_calls INTEGER NOT NULL,
    sla_percent REAL,
    calls_change_percent REAL,
    sla_change REAL
);

-- Views
CREATE VIEW IF NOT EXISTS top_issues AS
SELECT issue_name, department, total_calls, sla_percent, sla_time
FROM issues WHERE is_top10 = 1 ORDER BY total_calls DESC;

CREATE VIEW IF NOT EXISTS critical_issues AS
SELECT issue_name, department, total_calls, sla_percent, sla_time
FROM issues WHERE is_below80 = 1 ORDER BY total_calls DESC;

CREATE VIEW IF NOT EXISTS district_stats AS
SELECT name, population, total_calls, sla_percent, overdue_open,
       CASE WHEN population > 0 THEN ROUND(total_calls * 100.0 / population, 2) ELSE 0 END as calls_per_100_residents
FROM districts ORDER BY total_calls DESC;
