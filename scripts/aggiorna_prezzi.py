#!/usr/bin/env python3
"""Aggiorna prezzi.json con dati reali italiani, gratuiti.

- Gasolio: MIMIT, "Prezzo alle 8 di mattina" + anagrafica impianti (licenza IODL 2.0).
  Media del gasolio self service in Friuli-Venezia Giulia (province UD, PN, GO, TS).
- Elettricita': GME, report settimanale MGP -> PUN Index GME baseload (EUR/MWh), convertito in EUR/kWh.

Se una fonte non risponde, resta il valore della settimana prima (il gioco non si rompe).
Uso:  python scripts/aggiorna_prezzi.py [--out prezzi.json]
"""
import argparse
import csv
import datetime as dt
import io
import json
import re
import statistics
import sys
import time
import urllib.request

URL_PREZZI = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv"
URL_ANAGRAFICA = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv"
# Esempio: .../it-IT/%5C20260907MGPreportsettimanale36.pdf (report della settimana 36, pubblicato il lunedi dopo)
URL_GME = "https://www.mercatoelettrico.org/Portals/0/Documents/it-IT/{sep}{data}MGPreportsettimanale{sett:02d}.pdf"
PROVINCE_FVG = {"UD", "PN", "GO", "TS"}
UA = {"User-Agent": "Mozilla/5.0 (tycoon-logistica; aggiornamento prezzi settimanale)"}


def scarica(url, timeout=300, tentativi=3):
    """Scarica con piu' tentativi: il sito MIMIT a volte risponde lentamente."""
    ultimo = None
    for i in range(tentativi):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            ultimo = e
            print(f"  tentativo {i + 1}/{tentativi} fallito per {url}: {e}", file=sys.stderr)
            time.sleep(10 * (i + 1))
    raise ultimo


def leggi_csv_mimit(testo):
    """I file MIMIT hanno una prima riga 'Estrazione del ...', poi l'intestazione.
    Dal 10/02/2026 il separatore e' '|'; prima era ';'. Li gestiamo entrambi."""
    righe = testo.splitlines()
    inizio = next(i for i, r in enumerate(righe) if "idImpianto" in r)
    intest = righe[inizio]
    sep = "|" if intest.count("|") >= intest.count(";") else ";"
    return list(csv.DictReader(io.StringIO("\n".join(righe[inizio:])), delimiter=sep))


def decodifica(b):
    for enc in ("utf-8-sig", "latin-1"):
        try:
            return b.decode(enc)
        except UnicodeDecodeError:
            continue
    return b.decode("utf-8", errors="replace")


def media_gasolio_fvg(testo_prezzi, testo_anagrafica):
    anag = leggi_csv_mimit(testo_anagrafica)
    impianti_fvg = {r["idImpianto"].strip() for r in anag if (r.get("Provincia") or "").strip().upper() in PROVINCE_FVG}
    valori = []
    for r in leggi_csv_mimit(testo_prezzi):
        if r["idImpianto"].strip() not in impianti_fvg:
            continue
        if (r.get("descCarburante") or "").strip().lower() != "gasolio":
            continue
        if (r.get("isSelf") or "").strip() != "1":
            continue
        try:
            p = float(r["prezzo"].replace(",", "."))
        except (ValueError, AttributeError):
            continue
        if 0.8 < p < 3.5:  # scarta valori assurdi
            valori.append(p)
    if len(valori) < 20:
        raise ValueError(f"troppo pochi prezzi del gasolio in FVG ({len(valori)})")
    return round(statistics.mean(valori), 3), len(valori)


def pun_da_testo_pdf(testo):
    m = re.search(r"PUN Index GME\s+([\d\.]+,\d+)", testo)
    if not m:
        raise ValueError("PUN Index GME non trovato nel report")
    return float(m.group(1).replace(".", "").replace(",", "."))


def pun_settimanale(oggi):
    """Cerca il report GME piu' recente: prova gli ultimi lunedi."""
    from pypdf import PdfReader
    lunedi = oggi - dt.timedelta(days=oggi.weekday())
    for k in range(4):
        pubblicato = lunedi - dt.timedelta(weeks=k)
        settimana = (pubblicato - dt.timedelta(days=7)).isocalendar()[1]
        for sep in ("%5C", ""):
            url = URL_GME.format(sep=sep, data=pubblicato.strftime("%Y%m%d"), sett=settimana)
            try:
                pdf = PdfReader(io.BytesIO(scarica(url, timeout=60, tentativi=1)))
                testo = "\n".join(p.extract_text() or "" for p in pdf.pages[:2])
                return pun_da_testo_pdf(testo), settimana, pubblicato.year
            except Exception as e:  # noqa: BLE001 - proviamo la variante successiva
                print(f"  GME {url}: {e}", file=sys.stderr)
    raise RuntimeError("nessun report GME trovato nelle ultime 4 settimane")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="prezzi.json")
    args = ap.parse_args()

    try:
        with open(args.out, encoding="utf-8") as f:
            vecchi = json.load(f)
    except (OSError, ValueError):
        vecchi = {"diesel_eur_litro": 1.68, "pun_eur_kwh": 0.12}

    oggi = dt.date.today()
    nuovi = dict(vecchi)
    note = []

    try:
        diesel, n = media_gasolio_fvg(decodifica(scarica(URL_PREZZI)), decodifica(scarica(URL_ANAGRAFICA)))
        nuovi["diesel_eur_litro"] = diesel
        nuovi["diesel_impianti"] = n
        print(f"Gasolio FVG: {diesel} EUR/l su {n} impianti")
    except Exception as e:  # noqa: BLE001
        note.append(f"gasolio non aggiornato ({e})")
        print("ERRORE gasolio:", e, file=sys.stderr)

    try:
        pun_mwh, sett, anno = pun_settimanale(oggi)
        nuovi["pun_eur_mwh"] = round(pun_mwh, 2)
        nuovi["pun_eur_kwh"] = round(pun_mwh / 1000, 4)
        nuovi["pun_settimana"] = f"settimana {sett}/{anno}"
        print(f"PUN Index GME: {pun_mwh} EUR/MWh (settimana {sett})")
    except Exception as e:  # noqa: BLE001
        note.append(f"PUN non aggiornato ({e})")
        print("ERRORE PUN:", e, file=sys.stderr)

    nuovi["aggiornato"] = oggi.isoformat()
    nuovi["settimana"] = "settimana del " + oggi.strftime("%d/%m/%Y")
    nuovi["fonte"] = "MIMIT – prezzi carburanti (IODL 2.0), media self service FVG · GME – PUN Index GME"
    nuovi["note"] = note

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(nuovi, f, ensure_ascii=False, indent=2)
        f.write("\n")
    # esce con errore solo se non si e' aggiornato niente
    return 1 if len(note) == 2 else 0


if __name__ == "__main__":
    sys.exit(main())
