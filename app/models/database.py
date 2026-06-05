import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'moked106.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    schema_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'schema.sql')
    conn = get_db()
    with open(schema_path, 'r', encoding='utf-8') as f:
        conn.executescript(f.read())
    conn.close()

def query_db(query, args=(), one=False):
    conn = get_db()
    cur = conn.execute(query, args)
    rv = [dict(row) for row in cur.fetchall()]
    conn.close()
    return (rv[0] if rv else None) if one else rv
