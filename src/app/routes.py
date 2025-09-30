# src/app/routes.py
import os
import subprocess
import json
import hashlib
import binascii
import base64
import io
from pathlib import Path
from typing import Tuple
from flask import Flask, request, jsonify, send_file, make_response

app = Flask(__name__)

# ===== CONFIGURAÇÃO =====
BASE_DIR = Path(__file__).resolve().parents[2]  # Evay-Neura/src/app -> Evay-Neura/
PRIVATE_DIR = BASE_DIR / "src" / "files" / "private"
PRIVATE_DIR.mkdir(parents=True, exist_ok=True)

# Ajuste se necessário
CRYPTO_TOOL = r"C:\Users\CLIENTE\Desktop\Evay-Neura\native_crypto\crypto_tool.exe"
print(f"[DEBUG] CRYPTO_TOOL path: {CRYPTO_TOOL}")
print(f"[DEBUG] PRIVATE_DIR: {PRIVATE_DIR}")

# ===== AUX =====
def derive_key_from_password(password: str, salt: bytes = None) -> Tuple[str, bytes]:
    if salt is None:
        salt = os.urandom(16)
    # parâmetros scrypt para demo; em produção ajuste conforme recomendado
    key = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return binascii.hexlify(key).decode(), salt

# ===== ROTAS =====
@app.route('/register', methods=['POST'])
def register():
    """
    Registra usuário e retorna um arquivo de credencial (.cred) contendo:
    { "username": "...", "salt": "<hex>", "blob": "<base64 of encrypted file bytes>" }
    """
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"error":"username and password required"}), 400

    userfile = PRIVATE_DIR / f"{username}.enc"
    meta_file = PRIVATE_DIR / f"{username}.meta.json"
    if userfile.exists():
        return jsonify({"error":"user exists"}), 400

    # derive key + salt
    hex_key, salt = derive_key_from_password(password)
    salt_hex = binascii.hexlify(salt).decode()

    # generate seed
    try:
        seed = subprocess.check_output([CRYPTO_TOOL, "gen-seed"], text=True, shell=True).strip()
    except Exception as e:
        return jsonify({"error":"crypto tool failed", "detail": str(e)}), 500

    # write seed to tmp and encrypt to file (file for local storage)
    tmp_in = PRIVATE_DIR / f"{username}.seed.tmp"
    tmp_out = userfile
    tmp_in.write_text(seed, encoding='utf-8')

    try:
        subprocess.check_call([CRYPTO_TOOL, "encrypt", hex_key, str(tmp_in.resolve()), str(tmp_out.resolve())], shell=True)
    except subprocess.CalledProcessError as e:
        if tmp_in.exists(): tmp_in.unlink()
        return jsonify({"error":"encryption failed", "detail": str(e)}), 500
    finally:
        if tmp_in.exists():
            tmp_in.unlink()

    # Save metadata for local instance (still good to have)
    meta_file.write_text(json.dumps({"salt": salt_hex}), encoding='utf-8')

    # Create credential package: read encrypted file bytes and embed salt (base64)
    enc_bytes = tmp_out.read_bytes()
    enc_b64 = base64.b64encode(enc_bytes).decode()
    credential = {"username": username, "salt": salt_hex, "blob": enc_b64}

    # Return credential as downloadable file (.cred) attachment
    cred_bytes = json.dumps(credential).encode('utf-8')
    bio = io.BytesIO(cred_bytes)
    response = make_response(send_file(
        bio,
        as_attachment=True,
        download_name=f"{username}.cred",
        mimetype="application/octet-stream"
    ))
    # For convenience, also include a small JSON body when not downloading via browser (API)
    response.headers['X-Info'] = 'credential-generated'
    return response

@app.route('/login-file', methods=['POST'])
def login_file():
    """
    Recebe upload multipart/form-data:
      - credential: the .cred file (JSON with salt + blob)
      - password: form field
    Tenta derivar a chave com the salt and decrypt the embedded blob.
    """
    if 'credential' not in request.files:
        return jsonify({"error":"credential file required"}), 400
    password = request.form.get('password')
    if not password:
        return jsonify({"error":"password required"}), 400

    credential_file = request.files['credential']
    # read json from uploaded file
    try:
        cred_json = json.load(credential_file)
        username = cred_json.get("username")
        salt_hex = cred_json.get("salt")
        blob_b64 = cred_json.get("blob")
        if not (salt_hex and blob_b64):
            return jsonify({"error":"invalid credential format"}), 400
    except Exception as e:
        return jsonify({"error":"invalid credential file", "detail": str(e)}), 400

    # prepare temp encrypted file from blob
    tmp_enc = PRIVATE_DIR / f"{username}.upload.tmp.enc"
    tmp_decrypted = PRIVATE_DIR / f"{username}.upload.tmp.dec"
    try:
        enc_bytes = base64.b64decode(blob_b64)
        tmp_enc.write_bytes(enc_bytes)
    except Exception as e:
        return jsonify({"error":"failed to write temp encrypted", "detail": str(e)}), 500

    # derive key from supplied password + salt from credential
    try:
        salt = binascii.unhexlify(salt_hex)
    except Exception as e:
        tmp_enc.unlink(missing_ok=True)
        return jsonify({"error":"invalid salt format", "detail": str(e)}), 400

    hex_key, _ = derive_key_from_password(password, salt=salt)

    # try decrypt
    try:
        subprocess.check_call([CRYPTO_TOOL, "decrypt", hex_key, str(tmp_enc.resolve()), str(tmp_decrypted.resolve())], shell=True)
    except subprocess.CalledProcessError:
        tmp_enc.unlink(missing_ok=True)
        tmp_decrypted.unlink(missing_ok=True)
        return jsonify({"error":"invalid credentials or decryption failed"}), 401

    # read seed and clean temps
    try:
        seed = tmp_decrypted.read_text(encoding='utf-8')
    except Exception as e:
        tmp_enc.unlink(missing_ok=True)
        tmp_decrypted.unlink(missing_ok=True)
        return jsonify({"error":"failed to read decrypted file", "detail": str(e)}), 500

    tmp_enc.unlink(missing_ok=True)
    tmp_decrypted.unlink(missing_ok=True)

    # successful login
    return jsonify({"ok": True, "message": "authenticated", "seed_preview": seed[:64]})

@app.route('/users', methods=['GET'])
def users():
    files = [f.stem for f in PRIVATE_DIR.glob("*.enc")]
    return jsonify({"users": files})

if __name__ == "__main__":
    app.run(port=5001)
