# Mesa de Redacción

Cola de propuestas de post para LinkedIn. Las propuestas entran por la API, se
revisan desde la web o desde el móvil, y se publican con un toque.

Dos clientes sobre la misma API:

- **`apps/web`** — Next.js, pensada para Vercel. Es la que usas en el ordenador.
- **`apps/mobile`** — Expo / React Native, para el iPhone a través de Expo Go.
- **`packages/shared`** — lo que comparten: el límite de 3000 caracteres, el
  pliegue del *"ver más"* a los 210, y las señales de texto generado.

## Arrancar en local

```bash
npm install

cd apps/web
cp ../../.env.example .env.local     # y rellena MESA_PASSWORD y MESA_SECRET
npm run dev
```

Queda en `http://localhost:3000`. Sin variables de Upstash los borradores se
guardan en `data/local.json`, que está fuera del control de versiones.

Para generar el secreto de firma:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

## Meter una propuesta

```bash
MESA_PASSWORD=tu-clave node scripts/proponer.mjs borrador.txt \
  --origen "repesca de marzo" --visual "captura del panel de Grafana"
```

Contra producción, añade `MESA_URL=https://tu-dominio.vercel.app`.

## El móvil

```bash
cd apps/mobile
npx expo start
```

Escanea el QR con Expo Go. La app apunta a `extra.apiUrl` de `app.json`: en
desarrollo, la IP del Mac en la red local; en producción, el dominio de Vercel.
Cambia ese valor cuando despliegues.

Con Expo Go y sin cuenta de Expo, la app solo funciona mientras el Mac tenga
`expo start` corriendo y ambos estén en la misma red. Es el precio de no
registrarse.

## Desplegar

1. Sube el repositorio a GitHub.
2. En Vercel, importa el proyecto y pon el *root directory* en `apps/web`.
3. Añade `MESA_PASSWORD` y `MESA_SECRET` como variables de entorno.
4. Conecta Upstash Redis desde el panel de Vercel. Las dos variables
   `UPSTASH_*` aparecen solas y el almacén pasa de archivo a base de datos.

Sin Upstash el despliegue funciona, pero el sistema de archivos de Vercel es
efímero: los borradores se perderían entre peticiones.

## La API

Todo exige `Authorization: Bearer <token>` o la cookie de sesión.

| Método | Ruta | Qué hace |
| --- | --- | --- |
| `POST` | `/api/auth` | Cambia la contraseña por un token de 30 días |
| `GET` | `/api/auth` | Dice si la cookie actual sigue viva |
| `DELETE` | `/api/auth` | Cierra la sesión |
| `GET` | `/api/drafts` | Lista los borradores, del más nuevo al más viejo |
| `POST` | `/api/drafts` | Crea uno |
| `PATCH` | `/api/drafts/:id` | Cambia `estado`, `texto` o `notaVisual` |
| `DELETE` | `/api/drafts/:id` | Lo borra |

Estados: `pendiente`, `aprobado`, `descartado`, `publicado`.

## Sobre la seguridad

Una contraseña y un token firmado con HMAC. Protege borradores de posts, que no
son secretos de estado, y es proporcionado a eso. Si esto llegara a guardar algo
sensible, haría falta autenticación de verdad.

## Notificaciones

La app pide permiso de notificaciones la primera vez que entras, no en la
pantalla de contraseña: pedirlo antes de que veas para qué sirve se lleva un
"no" casi seguro. El token se registra en `/api/push/register` y se guarda
junto a los borradores.

Cuando entra un borrador cuyo origen **no** eres tú, el servidor avisa por la
API de Expo. Las ideas que escribes tú no notifican nada, que sería avisarte de
lo que acabas de teclear.

En iOS esto funciona dentro de Expo Go usando las credenciales de Expo. En
Android dejó de funcionar en el SDK 53 y haría falta un development build; la
app lo detecta y te lo dice en pantalla en vez de fallar en silencio.

El proyecto de Expo está declarado en `apps/mobile/app.json`, en
`extra.eas.projectId`. Sin ese identificador no hay token de push.

## El chat, sin clave de API

El chat de la app no habla con la API de Anthropic. Habla con el Claude que ya
tienes instalado en el Mac, a través de un puente local:

```bash
MESA_SECRET=el-mismo-de-tu-.env.local python3 scripts/puente.py
```

Imprime la dirección que hay que poner en la app (el engranaje de la pantalla
de chat). Mientras esa ventana siga abierta, el chat funciona y no cuesta nada:
va contra tu propia suscripción, no contra una clave facturada por uso.

El puente valida el mismo token firmado que emite la web, así que en el
teléfono no queda guardada ninguna contraseña. Un token de otro `MESA_SECRET`
no sirve.

**Lo que esto no es.** Solo funciona con el Mac encendido, el puente corriendo
y el teléfono en la misma red. Es la misma condición que ya impone Expo Go, así
que no añade ninguna atadura nueva: lo que no funcionará es el chat desde la
web desplegada en Vercel, porque esa vive en la nube y no alcanza tu Mac. La
cola sí funciona desde cualquier sitio.

## La PWA: la app sin ordenador y sin Apple

La web de Vercel es instalable. En el iPhone: Safari → Compartir → **Añadir a
pantalla de inicio**. Queda con icono propio y a pantalla completa, y desde ahí
**sí admite notificaciones push** (iOS 16.4 en adelante).

Esto es lo que funciona con el Mac apagado, sin pagar los 99 €/año de Apple y
sin pasar por la App Store. Lo único que se queda fuera es el chat, que vive en
el Mac.

Las notificaciones se activan desde **Estado → Activar notificaciones**, y hay
que hacerlo con la app ya instalada: Safari no las admite desde una pestaña.

Claves necesarias en el entorno:

```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:tu@correo
```

Se generan una vez con:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

## Panel de estado

El botón **Estado** de la cabecera abre un semáforo de cuatro luces: el
almacén, las notificaciones, el generador de propuestas y el chat. Más la
versión desplegada y el recuento de la cola.

El generador se considera parado si lleva más de 72 horas sin traer nada: con
un ritmo de 2-3 posts por semana, más silencio que eso significa que algo
falla. El chat lo comprueba el navegador, no el servidor, porque el puente vive
en el Mac y Vercel no lo alcanza.
