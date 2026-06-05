import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, send_from_directory
from routes.data_routes import api
from models.database import init_db

app = Flask(__name__, static_folder='static', template_folder='templates')

app.register_blueprint(api)

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

# Always run on import (needed for gunicorn)
init_db()

from models.database import get_db
conn = get_db()
count = conn.execute("SELECT COUNT(*) FROM monthly_summary").fetchone()[0]
conn.close()
if count == 0:
    from seed_data import seed
    seed()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
