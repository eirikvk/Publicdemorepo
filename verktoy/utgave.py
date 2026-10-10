#!/usr/bin/env python3
"""Setter nytt utgavemerke før en endring legges ut.

Teksten vises under «Vis teknisk informasjon» (VERSJON i src/utgave.js), så man ser hvilken utgave en fane kjører.
Skriptet setter klokkeslettet nå, norsk tid. Filene i bygget får selv nye navn når innholdet endres, så nettleseren
blander ikke ny og gammel kode.

Kjør fra roten av repoet:  python3 verktoy/utgave.py
"""
import os, re
from datetime import datetime
from zoneinfo import ZoneInfo

ROT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MND = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
na = datetime.now(ZoneInfo('Europe/Oslo'))
tekst = f'{na.day}. {MND[na.month - 1]} kl. {na:%H.%M}'

sti = os.path.join(ROT, 'src', 'utgave.js')
s = open(sti, encoding='utf8').read()
s, n = re.subn(r"const VERSJON =\s*'[^']*'", f"const VERSJON = '{tekst}'", s)
if not n:
    raise SystemExit('Fant ikke utgavemerket i src/utgave.js')
open(sti, 'w', encoding='utf8').write(s)
print(f'Utgave: {tekst}')
