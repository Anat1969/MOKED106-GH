from flask import Blueprint, jsonify
from services.data_service import (
    get_summary, get_managers, get_departments,
    get_top_issues, get_critical_issues, get_all_issues,
    get_heatmap_data, get_districts, get_district_details
)

api = Blueprint('api', __name__, url_prefix='/api')

@api.route('/summary')
def summary():
    return jsonify(get_summary())

@api.route('/managers')
def managers():
    return jsonify(get_managers())

@api.route('/departments')
def departments():
    return jsonify(get_departments())

@api.route('/issues/top')
def top_issues():
    return jsonify(get_top_issues())

@api.route('/issues/critical')
def critical_issues():
    return jsonify(get_critical_issues())

@api.route('/issues')
def all_issues():
    return jsonify(get_all_issues())

@api.route('/heatmap')
def heatmap():
    return jsonify(get_heatmap_data())

@api.route('/districts')
def districts():
    return jsonify(get_districts())

@api.route('/districts/<int:district_id>')
def district_detail(district_id):
    return jsonify(get_district_details(district_id))

@api.route('/health')
def health():
    return jsonify({'status': 'ok'})
