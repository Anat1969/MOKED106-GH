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

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
