# -*- coding: utf-8 -*-
"""Baja los PDF adjuntos de los mails del viaje via IMAP a C:\claude\camino-docs."""
import email, imaplib, io, json, os, re, sys

CONF = r"C:\Users\loren\.claude.json"
DEST = r"C:\claude\camino-docs"

def creds():
    d = json.load(io.open(CONF, encoding="utf-8"))
    found = {}
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "mcpServers" and isinstance(v, dict) and "gmail-send" in v:
                    found.update(v["gmail-send"].get("env", {}))
                else:
                    walk(v)
        elif isinstance(o, list):
            for x in o: walk(x)
    walk(d)
    return found["GMAIL_USER"], found["GMAIL_APP_PASSWORD"]

BUSQUEDAS = [
    ("HORYMB",  'subject:HORYMB has:attachment'),
    ("KECBX",   'from:ETServer@iberia.es has:attachment'),
    ("8CUU7V",  'from:ventaOnline@renfe.es has:attachment 8CUU7V'),
    ("WGG4YR",  'from:ventaOnline@renfe.es has:attachment WGG4YR'),
    ("XLKJYJ",  'XLKJYJ has:attachment'),
    ("QNCHBGNH",'QNCHBGNH has:attachment'),
    ("PARADOR", '(parador OR "reis catolicos" OR 26WEB10319079940) has:attachment'),
]

OK_MIME = ("application/pdf", "application/octet-stream", "application/x-pdf")

def main():
    user, pw = creds()
    os.makedirs(DEST, exist_ok=True)
    M = imaplib.IMAP4_SSL("imap.gmail.com")
    M.login(user, pw)
    typ, _ = M.select("[Gmail]/Todos", readonly=True)
    if typ != "OK":
        print("no pude abrir el buzon [Gmail]/Todos"); return 1

    total = 0
    for etiqueta, q in BUSQUEDAS:
        typ, data = M.search(None, "X-GM-RAW", '"%s"' % q)
        ids = data[0].split() if data and data[0] else []
        if not ids:
            print("  %-9s sin resultados" % etiqueta)
            continue
        guardados = 0
        for mid in ids[-3:]:
            typ, raw = M.fetch(mid, "(RFC822)")
            msg = email.message_from_bytes(raw[0][1])
            for part in msg.walk():
                fn = part.get_filename()
                if not fn:
                    continue
                fn = str(email.header.make_header(email.header.decode_header(fn)))
                if not fn.lower().endswith(".pdf") and part.get_content_type() not in OK_MIME:
                    continue
                if not fn.lower().endswith(".pdf"):
                    continue
                payload = part.get_payload(decode=True)
                if not payload or not payload.startswith(b"%PDF"):
                    continue
                safe = re.sub(r"[^A-Za-z0-9._-]+", "_", fn)
                if etiqueta.upper() not in safe.upper():
                    safe = "%s-%s" % (etiqueta, safe)
                out = os.path.join(DEST, safe)
                with open(out, "wb") as f:
                    f.write(payload)
                print("  %-9s -> %-58s %7d bytes" % (etiqueta, safe, len(payload)))
                guardados += 1
                total += 1
        if not guardados:
            print("  %-9s mails encontrados pero sin PDF adjunto" % etiqueta)

    M.logout()
    print("\n%d PDF guardados en %s" % (total, DEST))

if __name__ == "__main__":
    sys.exit(main())
