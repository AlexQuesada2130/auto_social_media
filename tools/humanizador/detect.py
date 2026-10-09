#!/usr/bin/env python3
"""
detect.py - a five-check panel that scores how machine-written a draft looks.

What this is:  five local heuristics modelled on the signals public AI
detectors actually measure - sentence-length variation, concreteness, stock
vocabulary, typographic fingerprint, and voice. Every score is computed on
your machine from the text alone. Nothing is uploaded.

What this is NOT:  GPTZero, Originality, Copyleaks, Winston or Turnitin.
It does not call their APIs and it cannot promise their verdict. It catches
the things they all key on, which is why fixing them tends to move their
numbers too - but the only honest claim is the one on this line.

Each check returns a HUMAN score from 0 to 100. Higher is better.

Usage
  python3 detect.py draft.txt
  pbpaste | python3 detect.py -
  python3 detect.py draft.txt --json
  python3 detect.py before.txt after.txt      # compare two drafts
"""

import argparse
import json
import os
import re
import statistics
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, "slop.json")
LEX_ES = os.path.join(HERE, "slop.es.json")

SENT_RE = re.compile(r"[^.!?\n]+[.!?]*")

# Letras Unicode, para que "automatización" cuente como una palabra y no como
# dos fragmentos. El sufijo con apóstrofo mantiene "don't" entero en inglés.
WORD_RE = re.compile(r"[^\W\d_]+(?:['\u2019][^\W\d_]+)*", re.UNICODE)

NUMBERS = re.compile(r"\b\d[\d,.]*%?\b|[$\u20ac]\s?\d")
PROPER = re.compile(r"(?<![.!?]\s)(?<!^)\b[A-Z\u00c1\u00c9\u00cd\u00d3\u00da\u00d1]"
                    r"[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]{2,}\b", re.MULTILINE)

# --- Lo que cambia de un idioma a otro -------------------------------------
#
# El inglés delata informalidad con contracciones ("don't", "it's"). El español
# no las tiene, y además omite el sujeto: "Lo miré y le dije" es primera persona
# pura sin un solo pronombre. Medir pronombres en español es medir justo lo que
# el idioma calla, y por eso la versión anterior hundía cualquier post correcto.
#
# Donde el español sí marca la persona es en los clíticos (me, te, le, nos) y en
# la conjugación (-é, -í, -amos, -aba). Esa señal combinada, medida sobre cuatro
# posts humanos y cinco del propio autor, separa 3.7-13.6 frente a 1.4-1.5 en
# jerga. El objetivo está en 4.5 y no más arriba porque su registro habitual es
# analítico y en segunda persona, no anecdótico: una calibración hecha solo con
# textos de anécdota en primera persona rechazaba su voz real.
#
# El arranque de frase con "Y" o "Pero" se probó como tercer eje y se descartó:
# los textos humanos también daban cero, así que no discriminaba nada.

NUMEROS_ES = re.compile(
    r"\b(un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|"
    r"quince|veinte|treinta|cuarenta|cincuenta|cien|cientos|mil|miles|"
    r"primer|primera|segundo|tercera|mitad|doble|triple)\b", re.IGNORECASE)

CLITICOS_ES = re.compile(
    r"\b(me|te|nos|os|le|les|mi|mis|tu|tus|m\u00ed|ti|yo|t\u00fa|usted|"
    r"nosotros|vosotros|nuestro|nuestra|nuestros|vuestro)\b", re.IGNORECASE)

VERBOS_ES = re.compile(
    r"\b\w{2,}(?:\u00e9|\u00ed|aba|abas|\u00eda|\u00edas|amos|emos|imos|"
    r"aste|iste|ar\u00e9|ar\u00eda|er\u00e9|ir\u00e9)\b", re.IGNORECASE)

CONTRACCIONES_EN = re.compile(r"\b\w+['\u2019](?:s|t|re|ve|ll|d|m)\b", re.IGNORECASE)
PRONOMBRES_EN = re.compile(r"\b(i|me|my|mine|we|us|our|you|your)\b", re.IGNORECASE)


def _voz_en(text, per100):
    """Inglés: contracciones y persona, cada una un tercio del eje."""
    contracciones = len(CONTRACCIONES_EN.findall(text)) * per100
    persona = len(PRONOMBRES_EN.findall(text)) * per100
    parcial = (scale(contracciones, human=3.0, machine=0.0) * 0.35
               + scale(persona, human=8.0, machine=1.0) * 0.35)
    detalle = (f"{contracciones:.1f} contractions, {persona:.1f} personal pronouns "
               f"per 100 words")
    return parcial, 0.70, detalle


def _voz_es(text, per100):
    """Español: una sola señal de persona, porque es la que separa."""
    marcas = len(CLITICOS_ES.findall(text)) + len(VERBOS_ES.findall(text))
    persona = marcas * per100
    parcial = scale(persona, human=4.5, machine=1.3) * 0.70
    detalle = f"{persona:.1f} marcas de persona por 100 palabras (quieres 4+)"
    return parcial, 0.70, detalle


# Medidos sobre el juego de calibración, no heredados del inglés. En español
# estos dos ejes discriminan poco: sirven para no castigar texto correcto, no
# para detectar jerga. Lo que de verdad separa es VOICE y SLOP DENSITY.
IDIOMAS = {
    "en": {
        "lexicon": LEX,
        "voz": _voz_en,
        "cv_humano": 0.70,
        "cv_maquina": 0.22,
        "concrecion_humana": 6.0,
        "concrecion_maquina": 0.5,
        "numeros_extra": None,
        "marcadores": re.compile(r"\b(the|and|of|to|that|with|for|is|was|this)\b",
                                 re.IGNORECASE),
    },
    "es": {
        "lexicon": LEX_ES,
        "voz": _voz_es,
        "cv_humano": 0.55,
        "cv_maquina": 0.25,
        "concrecion_humana": 4.5,
        "concrecion_maquina": 0.3,
        "numeros_extra": NUMEROS_ES,
        "marcadores": re.compile(r"\b(el|la|los|las|de|que|y|en|un|una|por|con|"
                                 r"para|es|se|no)\b", re.IGNORECASE),
    },
}


def detectar_idioma(texto):
    """Cuenta palabras funcionales de cada idioma. Gana la que más aparece."""
    puntos = {k: len(v["marcadores"].findall(texto)) for k, v in IDIOMAS.items()}
    return "en" if puntos["es"] == puntos["en"] else max(puntos, key=puntos.get)


def clamp(n):
    return max(0.0, min(100.0, n))


def scale(value, human, machine):
    """Map value onto 0-100 where `human` -> 100 and `machine` -> 0."""
    if human == machine:
        return 50.0
    return clamp((value - machine) / (human - machine) * 100)


def sentences(text):
    return [s.strip() for s in SENT_RE.findall(text) if len(s.split()) > 2]


def words(text):
    return WORD_RE.findall(text)


def check_burstiness(text, idioma="en"):
    """Humans vary sentence length hard. Models write even."""
    cfg = IDIOMAS[idioma]
    lens = [len(s.split()) for s in sentences(text)]
    if len(lens) < 4:
        return 50.0, "too short to judge"
    mean = statistics.mean(lens)
    cv = statistics.pstdev(lens) / mean if mean else 0
    score = scale(cv, human=cfg["cv_humano"], machine=cfg["cv_maquina"])
    return score, f"variation {cv:.2f} across {len(lens)} sentences (want 0.55+)"


def check_specificity(text, idioma="en"):
    """Numbers, names and concrete nouns. Slop is abstract."""
    cfg = IDIOMAS[idioma]
    w = words(text)
    if len(w) < 25:
        return 50.0, "too short to judge"
    per100 = 100 / len(w)
    hits = len(NUMBERS.findall(text)) + len(set(PROPER.findall(text)))
    # El español escribe con letra las cifras pequeñas: "tres servidores".
    if cfg["numeros_extra"] is not None:
        hits += len(cfg["numeros_extra"].findall(text))
    density = hits * per100
    score = scale(density, human=cfg["concrecion_humana"],
                  machine=cfg["concrecion_maquina"])
    return score, f"{hits} concrete markers, {density:.1f} per 100 words (want 4+)"


def check_slop(text, lex):
    """Stock vocabulary density against the lexicon."""
    w = words(text)
    if not w:
        return 50.0, "empty"
    hits, found = 0, []
    for entry in lex["words"] + lex["phrases"]:
        pattern = re.compile(r"\b" + re.escape(entry["find"]).replace(r"\ ", r"\s+") + r"\b",
                             re.IGNORECASE)
        n = len(pattern.findall(text))
        if n:
            hits += n
            found.append(entry["find"])
    density = hits * 100 / len(w)
    score = scale(density, human=0.0, machine=4.0)
    detail = f"{hits} stock terms, {density:.1f} per 100 words"
    if found:
        detail += " (" + ", ".join(sorted(found)[:4]) + (", ..." if len(found) > 4 else "") + ")"
    return score, detail


def check_fingerprint(text):
    """Characters a phone keyboard does not produce."""
    invisible = sum(1 for c in text if unicodedata.category(c) == "Cf")
    em = text.count("—")
    curly = sum(text.count(c) for c in "‘’“”")
    ellip = text.count("…")
    nbsp = sum(text.count(c) for c in "   ")
    total = invisible * 4 + em * 2 + curly + ellip + nbsp
    per1k = total * 1000 / max(len(text), 1)
    score = scale(per1k, human=0.0, machine=12.0)
    detail = (f"{invisible} invisible, {em} em dash, {curly} curly quote, "
              f"{ellip} ellipsis, {nbsp} hard space")
    return score, detail


def check_voice(text, lex, idioma="en"):
    """Persona, registro, y las formas a las que tira un generador."""
    cfg = IDIOMAS[idioma]
    w = words(text)
    if len(w) < 25:
        return 50.0, "too short to judge"
    per100 = 100 / len(w)

    parcial, peso_usado, detalle = cfg["voz"](text, per100)

    tics = 0
    nombres = []
    for s in lex["structures"]:
        try:
            n = len(re.compile(s["regex"], re.MULTILINE).findall(text))
        except re.error:
            continue
        if n:
            tics += n
            nombres.append(s["id"])

    vinetas = [len(b.split()) for b in re.findall(r"(?m)^\s*[-*\u2022]\s+(.+)$", text)]
    uniformes = len(vinetas) >= 3 and statistics.pstdev(vinetas) < 1.6

    score = parcial + clamp(100 - tics * 22) * (1 - peso_usado)
    if uniformes:
        score -= 12
        nombres.append("vinetas-uniformes")

    detalle += f", {tics} tic(s) de estructura"
    if nombres:
        detalle += " [" + ", ".join(nombres[:4]) + "]"
    return clamp(score), detalle


CHECKS = ["BURSTINESS", "SPECIFICITY", "SLOP DENSITY", "FINGERPRINT", "VOICE"]

# Qué ejes deciden el veredicto en cada idioma. Los demás se calculan y se
# muestran, pero no condenan.
#
# En español, BURSTINESS resultó estar anticorrelacionado: medido sobre cinco
# posts reales del autor y dos de relleno, daba 25-36 a los textos auténticos y
# 100 al peor de los generados. La variación de longitud de frase no distingue
# en un idioma que subordina tanto. SPECIFICITY tampoco separa (82-100 frente a
# 92-100), pero al menos no produce falsos negativos, así que se queda como
# información. Lo que sí separa limpiamente es SLOP DENSITY y VOICE.
DECIDEN = {
    "en": CHECKS,
    "es": ["SLOP DENSITY", "FINGERPRINT", "VOICE"],
}


def run(text, lex, idioma=None):
    idioma = idioma or detectar_idioma(text)
    results = {}
    results["BURSTINESS"] = check_burstiness(text, idioma)
    results["SPECIFICITY"] = check_specificity(text, idioma)
    results["SLOP DENSITY"] = check_slop(text, lex)
    results["FINGERPRINT"] = check_fingerprint(text)
    results["VOICE"] = check_voice(text, lex, idioma)
    scores = [results[c][0] for c in DECIDEN.get(idioma, CHECKS)]
    # The weakest check drags the verdict: a detector only needs one signal.
    overall = statistics.mean(scores) * 0.6 + min(scores) * 0.4
    verdict = "PASS" if overall >= 70 and min(scores) >= 55 else (
        "REVIEW" if overall >= 50 else "FLAGGED")
    return results, overall, verdict


def bar(score, width=24):
    filled = round(score / 100 * width)
    return "#" * filled + "." * (width - filled)


def render(results, overall, verdict, label=None, out=sys.stdout, idioma="en"):
    title = "AI DETECTION PANEL" + (f"  -  {label}" if label else "")
    print("\n" + title, file=out)
    print("=" * max(len(title), 62), file=out)
    for name in CHECKS:
        score, detail = results[name]
        print(f"  {name:<13} {bar(score)} {score:5.1f}", file=out)
        print(f"  {'':<13} {detail}", file=out)
    print("-" * 62, file=out)
    print(f"  {'HUMAN SCORE':<13} {bar(overall)} {overall:5.1f}   {verdict}", file=out)
    if verdict != "PASS":
        weakest = min(CHECKS, key=lambda c: results[c][0])
        print(f"\n  Weakest signal: {weakest}. Fix that first.", file=out)
    print("", file=out)


def main():
    ap = argparse.ArgumentParser(description="Score how machine-written a draft looks.")
    ap.add_argument("input", nargs="?", default="-", help="file, or - for stdin")
    ap.add_argument("compare", nargs="?", help="second file, to show before/after")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--lexicon", default=None,
                    help="lexicon file; by default the one for the detected language")
    ap.add_argument("--lang", choices=["auto", "en", "es"], default="auto")
    args = ap.parse_args()

    read = lambda p: sys.stdin.read() if p == "-" else open(p, encoding="utf-8").read()

    targets = [(args.input, read(args.input))]
    if args.compare:
        targets.append((args.compare, read(args.compare)))

    def lexicon_de(texto):
        idioma = args.lang if args.lang != "auto" else detectar_idioma(texto)
        ruta = args.lexicon or IDIOMAS[idioma]["lexicon"]
        return idioma, json.load(open(ruta, encoding="utf-8"))

    payload = []
    for name, text in targets:
        idioma, lex = lexicon_de(text)
        results, overall, verdict = run(text, lex, idioma)
        payload.append({
            "source": name,
            "checks": {k: {"score": round(v[0], 1), "detail": v[1]} for k, v in results.items()},
            "human_score": round(overall, 1),
            "verdict": verdict,
            "lang": idioma,
        })

    if args.json:
        print(json.dumps(payload if args.compare else payload[0], indent=2))
        return

    for (name, text), p in zip(targets, payload):
        idioma, lex = lexicon_de(text)
        results, overall, verdict = run(text, lex, idioma)
        render(results, overall, verdict, label=os.path.basename(name) if args.compare else None)
    if args.compare:
        a, b = payload
        delta = b["human_score"] - a["human_score"]
        print(f"  {a['human_score']:.1f} {a['verdict']}  ->  "
              f"{b['human_score']:.1f} {b['verdict']}   ({delta:+.1f})\n")

    sys.exit(0 if payload[-1]["verdict"] == "PASS" else 1)


if __name__ == "__main__":
    main()
