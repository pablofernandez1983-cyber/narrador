# -*- coding: utf-8 -*-
"""
Cifra todos los documentos del viaje (tickets, reservas) con AES-256-GCM y una
clave derivada con PBKDF2, para poder publicarlos en el repo publico. Se
descifran en el browser con WebCrypto, en documentos.html.

Uso:
    python cifrar_documentos.py <clave> [carpeta_origen]

Por defecto lee de C:\\claude\\camino-docs. Cada archivo se cifra por separado
con su propio IV, pero todos comparten sal, asi el browser deriva la clave una
sola vez.
"""
import base64
import json
import os
import sys

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DEFAULT = r"C:\claude\camino-docs"
OUT = os.path.join(HERE, "documentos.enc.json")
ITERATIONS = 310_000

# (orden, patrones en el nombre del archivo, icono, titulo, subtitulo)
CATALOGO = [
    (1,  ("horymb", "bcd", "recibo de viaje"), "\u2708\ufe0f",
     "Iberia \u00b7 Buenos Aires \u2194 D\u00fcsseldorf",
     "IB108/IB755 + IB756/IB103 \u00b7 HORYMB \u00b7 localizador B5R735"),
    (2,  ("kecbx", "billete", "ticket"), "\u2708\ufe0f",
     "Iberia \u00b7 D\u00fcsseldorf \u2192 Madrid",
     "IB1326 \u00b7 s\u00e1b 12/9 06:20 \u2192 09:00 \u00b7 reserva KECBX"),
    (3,  ("8cuu7v",), "\U0001F684",
     "AVE Madrid Chamart\u00edn \u2192 Ourense",
     "s\u00e1b 12/9 10:04 \u2192 12:18 \u00b7 localizador 8CUU7V"),
    (4,  ("wgg4yr",), "\U0001F689",
     "Tren MD Ourense \u2192 Sarria",
     "s\u00e1b 12/9 12:32 \u2192 13:47 \u00b7 localizador WGG4YR"),
    (5,  ("xlkjyj", "vueling"), "\u2708\ufe0f",
     "Vueling \u00b7 Santiago \u2192 D\u00fcsseldorf",
     "VY1681 + VY1894 v\u00eda Barcelona \u00b7 mi\u00e9 16/9 09:15 \u00b7 XLKJYJ"),
    (6,  ("qnchbgnh", "ibis"), "\U0001F3E8",
     "ibis D\u00fcsseldorf Airport",
     "noche del vie 11/9 \u00b7 reserva QNCHBGNH"),
    (7,  ("parador", "26web", "reis"), "\U0001F3DB\ufe0f",
     "Parador de Santiago \u00b7 Hostal dos Reis Cat\u00f3licos",
     "noche del mar 15/9 \u00b7 26WEB10319079940 \u00b7 llevar la credencial sellada"),
    (8,  ("seguro", "asisten", "cobertura"), "\U0001F6E1\ufe0f",
     "Seguro de viaje", "cobertura m\u00e9dica \u00b7 tel\u00e9fono de asistencia"),
    (9,  ("pasaporte", "dni"), "\U0001FAAA",
     "Documentos personales", "copia de respaldo"),
    (10, ("embarque", "boarding"), "\U0001F3AB",
     "Tarjetas de embarque", "se emiten 24h antes de cada vuelo"),
]

MIMES = {
    ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp",
}


def metadata(nombre):
    bajo = nombre.lower()
    for orden, patrones, icono, titulo, sub in CATALOGO:
        if any(p in bajo for p in patrones):
            return orden, icono, titulo, sub
    return 99, "\U0001F4C4", os.path.splitext(nombre)[0], "documento del viaje"


def main():
    if len(sys.argv) < 2:
        print("uso: python cifrar_documentos.py <clave> [carpeta]")
        return 1

    password = sys.argv[1].encode()
    src = sys.argv[2] if len(sys.argv) > 2 else SRC_DEFAULT

    if not os.path.isdir(src):
        print("no existe la carpeta: %s" % src)
        return 1

    archivos = sorted(
        f for f in os.listdir(src)
        if os.path.isfile(os.path.join(src, f)) and not f.startswith(".")
    )
    if not archivos:
        print("la carpeta %s esta vacia" % src)
        return 1

    salt = os.urandom(16)
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32,
                     salt=salt, iterations=ITERATIONS)
    key = kdf.derive(password)
    aes = AESGCM(key)

    docs = []
    for nombre in archivos:
        ruta = os.path.join(src, nombre)
        with open(ruta, "rb") as f:
            data = f.read()
        iv = os.urandom(12)
        ct = aes.encrypt(iv, data, None)
        orden, icono, titulo, sub = metadata(nombre)
        ext = os.path.splitext(nombre)[1].lower()
        docs.append({
            "orden": orden,
            "icono": icono,
            "titulo": titulo,
            "sub": sub,
            "filename": nombre,
            "mime": MIMES.get(ext, "application/octet-stream"),
            "bytes": len(data),
            "iv": base64.b64encode(iv).decode(),
            "data": base64.b64encode(ct).decode(),
        })
        print("  cifrado  %-52s %8d bytes  [%d]" % (nombre, len(data), orden))

    docs.sort(key=lambda d: (d["orden"], d["filename"]))
    for d in docs:
        d.pop("orden")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({
            "v": 1,
            "kdf": "PBKDF2-SHA256",
            "iter": ITERATIONS,
            "salt": base64.b64encode(salt).decode(),
            "docs": docs,
        }, f)

    print("\nOK -> %s (%d documentos, %.1f KB)" %
          (OUT, len(docs), os.path.getsize(OUT) / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
