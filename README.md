# i2home · Landing page

Sitio de una sola página para i2home (domótica y automatización inteligente). Es HTML, CSS y JavaScript estático: se puede subir tal cual a Netlify, Vercel, GitHub Pages o cualquier hosting.

En el inicio hay una casa en 3D, de noche, que el visitante puede controlar: luces, clima, cortinas, puerta, alarma y riego, más dos escenas ("Llegué a casa" y "Buenas noches"). Las imágenes de cada servicio salen de la misma escena 3D, así todo el sitio mantiene el mismo estilo.

## Estructura

```
index.html              la página
css/styles.css          estilos (colores y tipografías en las variables de :root)
js/main.js              menú, casa interactiva, formulario y botón de WhatsApp
js/casa3d.js            escena 3D compilada (no editar a mano: se genera desde src/)
src/casa3d.js           código fuente de la escena 3D (three.js)
assets/img/             imágenes del sitio (WebP) e imagen para redes (og.jpg)
tools/                  scripts para volver a renderizar las imágenes
```

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

## Cambiar la escena 3D o las imágenes

1. Editá `src/casa3d.js` (muebles, luces, cámaras de cada imagen en `PRESETS`).
2. `npm run build` para regenerar `js/casa3d.js`.
3. Con `npm run dev` corriendo, `npm run renders` genera los PNG en `assets/render/` (necesita Playwright con Chromium).
4. `python3 tools/optimize-images.py` los convierte a WebP en `assets/img/` (necesita Pillow).
