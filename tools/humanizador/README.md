# Humanizador

Dos scripts sin dependencias que puntúan un borrador y le quitan la huella de
texto generado. `detect.py` da una nota de 0 a 100 en cinco ejes; `humanize.py`
limpia lo que se puede limpiar sin criterio humano.

```bash
python3 detect.py borrador.txt           # el panel
python3 detect.py borrador.txt --json    # para scripts
python3 humanize.py borrador.txt --report
python3 detect.py antes.txt despues.txt  # el delta
```

El idioma se detecta solo. `--lang es` o `--lang en` lo fuerza.

## Qué se cambió para el español

El original era monolingüe inglés. Cuatro cosas lo hacían inservible en
español, y las cuatro están corregidas:

**El contador de palabras.** El regex `[A-Za-z']+` partía `automatización` en
`automatizaci` + `n`. Nueve palabras contaban como trece, y toda densidad "por
100 palabras" salía inflada un 44%. Ahora usa letras Unicode.

**El eje VOICE medía pronombres.** En español eso es medir justo lo que el
idioma omite: *"Lo miré y le dije"* es primera persona pura sin un solo
pronombre de sujeto. Ahora mide clíticos y terminaciones verbales, que es donde
el español marca la persona. Sobre un juego de cuatro textos humanos y dos de
jerga, separa 7.7-13.6 frente a 1.4-1.5.

**BURSTINESS y SPECIFICITY premiaban la jerga.** Con los objetivos ingleses, un
texto de relleno sacaba 98.1 en variación de frase, la mejor nota del conjunto.
Están recalibrados contra ese mismo juego. Siguen discriminando poco en
español: sirven para no castigar texto correcto. Los que separan de verdad son
VOICE y SLOP DENSITY.

**Las sustituciones rompían la gramática.** El español concuerda en género y
número, así que cambiar `pilar fundamental` por `base` produce *"un base"*, y
`exponencial` por `rápido` produce *"de forma rápido"*. Las 32 entradas con
concordancia ahora se marcan para reescritura manual en lugar de sustituirse.
En español el humanizador avisa más de lo que arregla, y es deliberado: una
frase agramatical delata más que la palabra que tenía antes.

`slop.es.json` tiene 105 términos y 10 estructuras. Está hecho para editarse:
quita lo que tú sí dices.

## Origen y licencia

Derivado de [linkedin-agent-skill](https://github.com/Jakeschincariol/linkedin-agent-skill),
de Jake Schincariol, bajo licencia MIT. El texto de la licencia original está
en `LICENSE` y se conserva como exige.
