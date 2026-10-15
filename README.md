# Mesa de Redacción

Cola de propuestas de post para LinkedIn. Las propuestas entran por la API, se
revisan desde la web o desde el móvil, y se publican con un toque.

Dos clientes sobre la misma API:

- **`apps/web`** — Next.js, pensada para Vercel. Es la que usas en el ordenador.
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

## Ingesta automática

`POST /api/ingesta` acepta propuestas de un proceso automático y avisa al
móvil cuando entran. Se autentica con `INGEST_TOKEN`, **una llave distinta de
tu contraseña y a propósito**: la usa una rutina en la nube cuyo prompt queda
almacenado, así que si se filtrara, lo peor que puede hacer quien la tenga es
añadirte borradores. No puede leer la cola, ni aprobar, ni borrar.

```bash
curl -X POST https://TU-DOMINIO/api/ingesta \
  -H "Authorization: Bearer $INGEST_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"propuestas":[{"texto":"...","origen":"rutina · noticias"}]}'
```

Hasta 10 por envío, y un solo aviso por lote en vez de uno por propuesta.

## Face ID en la PWA

Se apoya en WebAuthn, que es lo que Safari usa para las claves de acceso. Se
ofrece después del primer acierto con la contraseña, que es cuando se entiende
para qué sirve, y se enciende o apaga con el botón **Face ID** de la cabecera.

**Qué es y qué no es.** Es un cerrojo local, no un segundo factor contra el
servidor: quien te autentica sigue siendo la cookie de sesión, y Face ID solo
decide si la app se abre. El mismo modelo que tenía la versión de Expo. Si
alguien te roba la cookie del dispositivo, Face ID no lo detiene; lo que
detiene es a quien coja tu teléfono desbloqueado.

iOS nunca entrega la cara ni la huella: solo responde sí o no. Aquí no se
guarda ningún dato biométrico, porque no se recibe ninguno.

En la pantalla de bloqueo siempre queda la salida por contraseña, para cuando
Face ID falle o cambies de teléfono.

## Resultados: medir para afinar

La pestaña **Resultados** es donde apuntas a mano las cifras que te da
LinkedIn de cada post publicado: impresiones, reacciones, comentarios y
compartidos.

Con eso la app calcula la **tasa de interacción**, que es la métrica honesta:
qué porcentaje de quien lo vio hizo algo. Las impresiones solas dicen a cuánta
gente se lo enseñó el algoritmo, no si el texto funcionó.

A partir de tres posts con datos empieza a decirte qué tienen en común los que
mejor van: longitud, si acaban en pregunta, si llevan lista numerada. **Avisa
de cuántos posts hay detrás de cada observación**, porque con menos de diez
eso son pistas y no conclusiones, y presentarlas como otra cosa sería
engañarte.

También mide los comentarios por cada cien reacciones. Un comentario cuesta
mucho más que un "me gusta", así que esa proporción dice si generaste
conversación o solo aprobación.

## Navegación

Barra inferior con cuatro iconos: Cola, Resultados, Chat y Estado. Abajo
porque es donde llega el pulgar — en un iPhone grande la parte alta de la
pantalla no se alcanza con una mano. Los iconos van dibujados en SVG en vez de
cargar una librería por cuatro siluetas, y heredan el color del tema.

Por debajo de 360px de ancho las etiquetas desaparecen y quedan solo los
iconos.

## Comentar en posts de otros

La pestaña **Comentar** es para la parte de LinkedIn que más rinde y menos
gente trabaja: entrar bien en los posts ajenos.

Pegas el post de otro y se queda en cola. La rutina, en su siguiente pasada,
redacta el comentario y lo devuelve a la app. Por eso funciona con el Mac
apagado y sin coste: lo escribe la misma rutina que ya escribe tus posts.

Cuando lo uses, márcalo. Así no se te acumulan comentarios ya puestos.

## Aprobados que no salen

Lo aprobado que no se publica no cuenta. Por eso el botón **Ya publicada**:
sin esa señal la app no puede distinguir lo que decidiste publicar de lo que
de verdad salió, y sin esa distinción no hay nada que medir.

A los tres días sin publicar, un aprobado se marca en su tarjeta y aparece un
aviso arriba de la cola. Tres días porque un post de actualidad a la semana ya
no es actualidad.

## Gráficos

Dos formas, elegidas por el trabajo de cada dato y no por gusto.

**Interacción por post**: comparar magnitudes. Barras ordenadas de mayor a
menor, **todas del mismo violeta**. Los posts son categorías nominales —
cambiar su orden no cambia el significado— así que colorearlas por su valor
gastaría el canal de identidad para no decir nada que la longitud no diga ya.
Solo el extremo va en negrita.

**De qué está hecha esa interacción**: parte y todo. Barra apilada con tres
categorías reales, cada una con su color, leyenda siempre presente y 2px de
separación entre segmentos.

Las paletas están **validadas con el comprobador**, no elegidas a ojo, y cada
modo tiene sus propios pasos en vez de un volteo automático:

| | Claro (fondo `#f5f3f8`) | Oscuro (fondo `#0a0810`) |
| --- | --- | --- |
| Reacciones | `#6d28d9` | `#9333ea` |
| Comentarios | `#0891b2` | `#0891b2` |
| Compartidos | `#b45309` | `#ea580c` |

Ambas pasan las cinco comprobaciones: banda de luminosidad, mínimo de croma,
separación bajo daltonismo (ΔE 16.7 en el peor par adyacente), suelo de visión
normal y contraste sobre el fondo. El primer verde azulado que probé falló el
mínimo de croma — a ese tono se lee como gris — y hubo que subirlo.

Con menos de cuatro posts medidos, el gráfico lo dice: es una foto, no una
tendencia.
