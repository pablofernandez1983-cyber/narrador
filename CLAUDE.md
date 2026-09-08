# Narrador — Frontend PWA

PWA que convierte texto o prompts en podcasts narrados. El usuario ingresa texto, sube PDF/TXT, o pide a Claude que genere contenido; elige voz y velocidad; el backend sintetiza audio con Google TTS Chirp 3 HD.

## Stack

- Vanilla HTML5 + CSS3 + JS (sin frameworks), todo en `index.html` (~1050 líneas)
- PWA instalable (manifest + sw.js)
- Backend: `https://narrador-api-production.up.railway.app`
- Auth: header `X-API-Key` (contraseña guardada en localStorage)

## Archivos clave

- `index.html` — UI completa con tabs (IA / Texto / PDF), selector de 24 voces, speed control, cola de jobs
- `sw.js` — minimal pass-through (sin cache offline real)
- `camino-santiago-2026/` — subproyecto viaje Camino (index.html + documentos.html cifrados + `sw.js` propio con cache offline, scope de la carpeta)
- `cataratas-2026/` — subproyecto viaje Cataratas (index.html independiente)
- `disney-2027/` — subproyecto viaje Disney (index.html independiente)

## Endpoints que consume

| Método | Ruta | Uso |
|--------|------|-----|
| `POST` | `/jobs` | Crear job de narración |
| `GET` | `/jobs` | Listar cola |
| `GET` | `/jobs/{id}/audio` | Descargar MP3 |
| `POST` | `/synth` | Preview de voz |
| `DELETE` | `/jobs/{id}` | Borrar job |

Polling cada 3s para jobs en progreso.

## Gotchas

**24 voces hardcodeadas** en el HTML — agregar una requiere editar el frontend.

**Jobs no persisten en cliente** — si se recarga la página se pierde la cola visual (los jobs siguen en el backend).

**Contraseña en localStorage en plaintext** — diseño intencional para uso personal.

**Sin fallback offline** — el sw.js de la raíz no cachea contenido, sin conexión no funciona. La excepción es `camino-santiago-2026/`, que tiene su propio service worker: al ser de scope más específico gana sobre el de la raíz y sirve la página, los papeles y las tipografías desde cache. Si se replica en otro viaje, copiar ese sw.js y ajustar `VERSION` y `CORE`.

## Deploy

Frontend estático — se puede servir desde cualquier server HTTP o CDN. No tiene build.
