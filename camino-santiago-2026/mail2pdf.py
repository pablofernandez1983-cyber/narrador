# -*- coding: utf-8 -*-
"""Convierte a PDF los mails de confirmacion que no traen adjunto."""
import email, imaplib, io, json, os, re, subprocess, sys

CONF = r"C:\Users\loren\.claude.json"
DEST = r"C:\claude\camino-docs"
TMP = os.path.dirname(os.path.abspath(__file__))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

OBJETIVOS = [
    ("WGG4YR",   'WGG4YR',            "WGG4YR-tren-Ourense-Sarria"),
    ("XLKJYJ",   'XLKJYJ',            "XLKJYJ-Vueling-SCQ-DUS"),
    ("QNCHBGNH", 'QNCHBGNH',          "QNCHBGNH-ibis-Dusseldorf-Airport"),
    ("PARADOR",  '26WEB10319079940',  "PARADOR-Santiago-26WEB10319079940"),
]

def env_creds():
    d = json.load(io.open(CONF, encoding="utf-8"))
    env = {}
    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == "mcpServers" and isinstance(v, dict) and "gmail-send" in v:
                    env.update(v["gmail-send"].get("env", {}))
                else: walk(v)
        elif isinstance(o, list):
            for x in o: walk(x)
    walk(d)
    return env["GMAIL_USER"], env["GMAIL_APP_PASSWORD"]

def cuerpo_html(msg):
    html = texto = None
    for part in msg.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if part.get_filename():
            continue
        ct = part.get_content_type()
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        cs = part.get_content_charset() or "utf-8"
        try:
            s = payload.decode(cs, "replace")
        except LookupError:
            s = payload.decode("utf-8", "replace")
        if ct == "text/html" and html is None:
            html = s
        elif ct == "text/plain" and texto is None:
            texto = s
    if html:
        return html
    if texto:
        return "<pre style='font:13px/1.5 monospace;white-space:pre-wrap'>%s</pre>" % (
            texto.replace("&", "&amp;").replace("<", "&lt;"))
    return None

def limpiar(html, titulo):
    # fuera imagenes remotas y trackers: no aportan y hacen lento el render
    html = re.sub(r"<img\b[^>]*>", "", html, flags=re.I)
    html = re.sub(r"<script\b.*?</script>", "", html, flags=re.I | re.S)
    cab = ("<!doctype html><meta charset='utf-8'><title>%s</title>"
           "<style>body{font:13px/1.55 Segoe UI,Arial,sans-serif;margin:24px;color:#111}"
           "table{border-collapse:collapse;max-width:100%%}td,th{padding:2px 6px}"
           "a{color:#06c;text-decoration:none}</style>" % titulo)
    return cab + html

def main():
    user, pw = env_creds()
    os.makedirs(DEST, exist_ok=True)
    M = imaplib.IMAP4_SSL("imap.gmail.com")
    M.login(user, pw)
    M.select("[Gmail]/Todos", readonly=True)

    hechos = 0
    for etiqueta, q, salida in OBJETIVOS:
        typ, data = M.search(None, "X-GM-RAW", '"%s"' % q)
        ids = data[0].split() if data and data[0] else []
        if not ids:
            print("  %-9s no encontre el mail" % etiqueta)
            continue
        typ, raw = M.fetch(ids[-1], "(RFC822)")
        msg = email.message_from_bytes(raw[0][1])
        subj = str(email.header.make_header(email.header.decode_header(msg.get("Subject") or "")))
        html = cuerpo_html(msg)
        if not html:
            print("  %-9s el mail no tiene cuerpo utilizable" % etiqueta)
            continue
        src = os.path.join(TMP, salida + ".html")
        io.open(src, "w", encoding="utf-8").write(limpiar(html, salida))
        out = os.path.join(DEST, salida + ".pdf")
        subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        "--print-to-pdf=" + out, "file:///" + src.replace("\\", "/")],
                       capture_output=True, timeout=90)
        if os.path.exists(out) and open(out, "rb").read(5) == b"%PDF-":
            print("  %-9s -> %-42s %7d bytes  (%s)" %
                  (etiqueta, salida + ".pdf", os.path.getsize(out), subj[:40]))
            hechos += 1
        else:
            print("  %-9s FALLO el render" % etiqueta)
        os.remove(src)

    M.logout()
    print("\n%d PDF generados" % hechos)

if __name__ == "__main__":
    sys.exit(main())
