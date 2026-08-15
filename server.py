from flask import Flask, request, jsonify, send_from_directory
import sqlite3
import os
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='.', static_url_path='')
app.config['UPLOAD_FOLDER'] = 'uploads'

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect('database.db')
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/scans', methods=['GET'])
def get_scans():
    conn = get_db_connection()
    scans = conn.execute('SELECT * FROM scans ORDER BY timestamp DESC LIMIT 10').fetchall()
    conn.close()
    return jsonify([dict(ix) for ix in scans])

@app.route('/api/scans', methods=['POST'])
def add_scan():
    crop_type = request.form.get('crop_type', 'New Sample')
    sector = request.form.get('sector', 'A')
    status = request.form.get('status', 'Healthy')
    confidence = int(request.form.get('confidence', 95))
    
    image_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file.filename != '':
            ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else 'jpg'
            filename = f"{uuid.uuid4().hex}.{ext}"
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(file_path)
            image_path = f"/uploads/{filename}"

    conn = get_db_connection()
    conn.execute('INSERT INTO scans (crop_type, sector, status, confidence, image_path) VALUES (?, ?, ?, ?, ?)',
                 (crop_type, sector, status, confidence, image_path))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Scan saved successfully', 'image_path': image_path}), 201

if __name__ == '__main__':
    app.run(port=8080, debug=True)
