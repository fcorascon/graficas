import os
import re
import io
import json
import ssl
import datetime
import urllib.request
import urllib.error
import pandas as pd
from flask import Flask, render_template, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static', template_folder='templates')

DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/1jYoM_flncgvt0bEwm88FGwNUUVcMBVYmGBhsGxPNUAE/edit?gid=1473468940#gid=1473468940"
LOCAL_CSV_PATH = os.path.join(os.path.dirname(__file__), 'google_data.csv')

def extract_sheet_id_and_gid(url):
    """Extrae el spreadsheet ID y gid de cualquier URL de Google Sheets."""
    sheet_id_match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    gid_match = re.search(r'[#&?]gid=([0-9]+)', url)
    
    sheet_id = sheet_id_match.group(1) if sheet_id_match else None
    gid = gid_match.group(1) if gid_match else '0'
    return sheet_id, gid

def build_export_url(sheet_id, gid='0'):
    return f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"

def process_dataframe(df):
    """Limpia el dataframe y devuelve columnas, tipos, datos y estadísticas básicas."""
    df.columns = [str(c).strip() if str(c).strip() else f"Columna_{i+1}" for i, c in enumerate(df.columns)]
    
    # Limpieza de tipos de columnas
    for col in df.columns:
        if df[col].dtype == object:
            try:
                cleaned = df[col].astype(str).str.replace(r'[\$,]', '', regex=True).str.strip()
                converted = pd.to_numeric(cleaned, errors='ignore')
                if pd.api.types.is_numeric_dtype(converted):
                    df[col] = converted
            except Exception:
                pass

    column_info = []
    for col in df.columns:
        is_numeric = pd.api.types.is_numeric_dtype(df[col])
        is_datetime = pd.api.types.is_datetime64_any_dtype(df[col])
        
        column_info.append({
            "name": col,
            "type": "numeric" if is_numeric else ("datetime" if is_datetime else "text"),
            "non_null_count": int(df[col].count()),
            "sample": str(df[col].dropna().iloc[0]) if not df[col].dropna().empty else None
        })
    
    df_clean = df.fillna(0)
    records = df_clean.to_dict(orient="records")
    
    cols_upper = [c.upper() for c in df.columns]
    is_electoral = all(k in cols_upper for k in ['GOB_21', 'AYUNT_21', 'DIP_21', 'AYUNT_24', 'DIP_24'])
    
    return {
        "columns": column_info,
        "rows": records,
        "total_rows": len(df),
        "is_electoral": is_electoral
    }

def fetch_live_sheet_data(url=DEFAULT_SHEET_URL):
    """Descarga directamente la hoja de Google Sheets en tiempo real."""
    sheet_id, gid = extract_sheet_id_and_gid(url)
    if not sheet_id:
        raise ValueError("URL de Google Sheets inválida.")
        
    export_url = build_export_url(sheet_id, gid)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    req = urllib.request.Request(export_url, headers=headers)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
        data_bytes = response.read()
        
        # Verificar si Google devolvió pantalla de login HTML
        text_preview = data_bytes[:1000].decode('utf-8', errors='ignore')
        if "<html" in text_preview.lower() or "<!doctype html" in text_preview.lower():
            raise PermissionError("La hoja requiere acceso público o permisos.")
        
        df = pd.read_csv(io.BytesIO(data_bytes), encoding='utf-8')
        
        # Guardar copia local de respaldo
        try:
            df.to_csv(LOCAL_CSV_PATH, index=False, encoding='utf-8')
        except Exception:
            pass
            
        return df

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/get-live-data', methods=['GET', 'POST'])
def get_live_data():
    """Obtiene los datos en vivo desde Google Sheets o respaldo local."""
    data = request.get_json(silent=True) or {}
    url = data.get('url', '').strip() or DEFAULT_SHEET_URL
    now_str = datetime.datetime.now().strftime("%H:%M:%S")

    try:
        df = fetch_live_sheet_data(url)
        processed = process_dataframe(df)
        return jsonify({
            "success": True,
            "source": "google_sheets_live",
            "source_label": "En vivo desde Google Sheets",
            "updated_at": now_str,
            "total_rows": len(df),
            "data": processed
        })
    except Exception as e:
        # Fallback a la copia local si no hay conexión
        if os.path.exists(LOCAL_CSV_PATH):
            try:
                df = pd.read_csv(LOCAL_CSV_PATH, encoding='utf-8')
                processed = process_dataframe(df)
                return jsonify({
                    "success": True,
                    "source": "local_cache",
                    "source_label": "Copia Local de Respaldo",
                    "updated_at": now_str,
                    "total_rows": len(df),
                    "warning": f"No se pudo conectar en vivo ({str(e)}). Se utilizó la copia local.",
                    "data": processed
                })
            except Exception:
                pass
        return jsonify({"success": False, "error": f"Error al obtener datos: {str(e)}"}), 500

@app.route('/api/fetch-google-sheet', methods=['POST'])
def fetch_google_sheet():
    return get_live_data()

@app.route('/api/sample-data', methods=['GET'])
def sample_data():
    return get_live_data()

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No se subió ningún archivo."}), 400
    
    file = request.files['file']
    filename = file.filename.lower()
    
    try:
        if filename.endswith('.csv') or filename.endswith('.tsv') or filename.endswith('.txt'):
            file_bytes = file.read()
            first_line = file_bytes[:1024].decode('utf-8', errors='ignore')
            delimiter = '\t' if '\t' in first_line and first_line.count('\t') > first_line.count(',') else ','
            df = pd.read_csv(io.BytesIO(file_bytes), delimiter=delimiter)
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(file.stream)
        elif filename.endswith('.json'):
            df = pd.read_json(file.stream)
        else:
            return jsonify({"success": False, "error": "Formato no soportado."}), 400
        
        processed = process_dataframe(df)
        return jsonify({"success": True, "filename": file.filename, "data": processed})
    except Exception as e:
        return jsonify({"success": False, "error": f"Error al leer el archivo: {str(e)}"}), 500

if __name__ == '__main__':
    port = 5000
    print(f"Iniciando Consulta de Resultados en http://127.0.0.1:{port}")
    app.run(host='127.0.0.1', port=port, debug=True)
