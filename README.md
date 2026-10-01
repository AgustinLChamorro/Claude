# i2home · Landing page

Sitio de una sola página para i2home (domótica y automatización inteligente). Es HTML, CSS y JavaScript estático: se puede subir tal cual a Netlify, Vercel, GitHub Pages o cualquier hosting.

La misma casa en 3D aparece en tres partes interactivas:

- **Inicio:** el visitante prende y apaga luces, clima, cortinas, puerta, alarma y riego, o activa las escenas "Llegué a casa" y "Buenas noches".
- **Un día con i2home:** una barra de horario (o el botón Reproducir) recorre las 24 horas. Cambian el cielo y la luz del sol, se disparan las automatizaciones (riego, "Me voy de casa", "Llegué a casa", atardecer, "Buenas noches") y quedan anotadas en el registro de la casa.
- **Armá tu casa:** el visitante elige ambientes y dispositivos, la cámara se acerca a cada ambiente y se ve cada equipo encendido. La selección se manda por WhatsApp o pasa al formulario de contacto con los intereses ya marcados.

Los servicios, "Cómo funciona", "¿Por qué elegir i2home?" y la banda final usan fotos.

## Estructura

```
index.html              la página
css/styles.css          estilos (colores y tipografías en las variables de :root)
js/main.js              menú, casa del inicio, simulador del día, configurador, formulario y WhatsApp
js/casa3d.js            escena 3D compilada (no editar a mano: se genera desde src/)
src/casa3d.js           código fuente de la escena 3D (three.js)
assets/img/             imágenes del sitio (WebP) e imagen para redes (og.jpg)
assets/logo/            logo de i2home: horizontal, apilado e isotipo, en color y en blanco, más favicon
tools/                  scripts para volver a renderizar las imágenes
```

## Marca

- Colores del logo: azul marino `#131e3d`, azul `#186ae0` y azul profundo `#10449f`, sobre blanco. Están en las variables de `:root` en `css/styles.css`.
- Tipografía de títulos: Poppins, la más parecida a la del logo. Texto: Instrument Sans.
- Las versiones del logo en `assets/logo/` salen del logo original: las de color van sobre fondos claros y las `-blanco` sobre azul marino.

## Datos pendientes

Antes de publicar, reemplazá los textos entre corchetes en `index.html`:

- Teléfono / WhatsApp, mail, Instagram y zona de trabajo (sección Contacto y pie de página).
- Las tres reseñas de clientes (sección Testimonios), con nombre y barrio reales.

Para que los botones de WhatsApp lleguen a tu número, completá `whatsapp` al principio de `js/main.js` con el código de país y sin espacios, por ejemplo `'5491122334455'`. Mientras esté vacío, WhatsApp se abre para que la persona elija el contacto.

El formulario no necesita servidor: arma el mensaje con los datos que carga la persona y le ofrece enviarlo por WhatsApp o copiarlo.

## Ver el sitio en tu computadora

```
npm install
npm run dev        # abre http://localhost:8080
```

## Fotos

Las fotos están en `assets/img/foto-*.webp`, recortadas al formato de cada lugar y optimizadas. Los originales quedan en `assets/fotos/originales/`.

| Archivo | Dónde aparece |
| --- | --- |
| `foto-iluminacion.webp` | Tarjeta Iluminación |
| `foto-clima.webp` | Tarjeta Climatización |
| `foto-seguridad.webp` | Tarjeta Seguridad |
| `foto-accesos.webp` | Tarjeta Control de accesos |
| `foto-cortinas.webp` | Tarjeta Cortinas y persianas |
| `foto-riego.webp` | Tarjeta Riego automático |
| `foto-hub.webp` | Cómo funciona |
| `foto-familia.webp` | ¿Por qué elegir i2home? |
| `foto-casa.webp` | Banda final antes del contacto |

Para cambiar una, reemplazá el archivo por otro con el mismo nombre y formato parecido (las tarjetas son 4:3) o cambiá la ruta en `index.html`. La casa 3D sigue en el inicio, en "Un día con i2home" y en "Armá tu casa".

## Cambiar la escena 3D o las imágenes

1. Editá `src/casa3d.js` (muebles, luces, cámaras de cada imagen en `PRESETS`).
2. `npm run build` para regenerar `js/casa3d.js`.
3. Con `npm run dev` corriendo, `npm run renders` genera los PNG en `assets/render/` (necesita Playwright con Chromium).
4. `python3 tools/optimize-images.py` los convierte a WebP en `assets/img/` (necesita Pillow).
