# Cifra el PDF de las tarjetas de embarque con AES-256-GCM (clave derivada con PBKDF2)
# para poder publicarlo en el repo público. Se descifra en el browser con WebCrypto.
import base64
import json
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

PDF = r"C:\Users\loren\Downloads\JA3156_tarjetas_embarque_20jul.pdf"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tarjetas.enc.json")
ITERATIONS = 310_000

password = sys.argv[1].encode()
salt = os.urandom(16)
iv = os.urandom(12)

kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS)
key = kdf.derive(password)

with open(PDF, "rb") as f:
    data = f.read()

ct = AESGCM(key).encrypt(iv, data, None)

with open(OUT, "w") as f:
    json.dump({
        "v": 1,
        "kdf": "PBKDF2-SHA256",
        "iter": ITERATIONS,
        "salt": base64.b64encode(salt).decode(),
        "iv": base64.b64encode(iv).decode(),
        "data": base64.b64encode(ct).decode(),
        "filename": "JA3156_tarjetas_embarque_20jul.pdf",
    }, f)

print(f"OK -> {OUT} ({os.path.getsize(OUT)} bytes)")
