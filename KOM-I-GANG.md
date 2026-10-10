# Kom i gang lokalt

Slik får du siden til å kjøre på din egen maskin etter å ha klonet repoet. Det fungerer likt på macOS, Linux og Windows.

## Det du trenger

- **Git**, for å hente koden.
- **Node.js 22.18 eller nyere**. Sjekk med `node --version`. Verktøyene er skrevet i TypeScript, og fra 22.18 kjører Node dem direkte. Har du ikke Node, er den enkleste veien å laste ned
  LTS-utgaven fra <https://nodejs.org>. Bruker du nvm, velger `nvm use` riktig versjon fra filen `.nvmrc`.
- **Nettilgang** til SSB, Kartverket, NIBIO, DiBK og Miljødirektoratet. Siden henter alle data direkte fra dem mens den kjører. Er
  noen av dem stengt i nettet du sitter på, mangler de delene av siden.

## Hent koden og start siden

```
git clone https://github.com/eirikvk/Publicdemorepo.git
cd Publicdemorepo
npm ci
npm run dev
```

Åpne <http://localhost:5173> i nettleseren. Siden lastes på nytt når du lagrer en endring i `src/`. Stopp med Ctrl+C.

- `npm ci` installerer nøyaktig de versjonene som står i `package-lock.json`. Bruk den i stedet for `npm install`, som kan
  oppdatere versjonene. Kjør `npm ci` på nytt etter `git pull` hvis `package-lock.json` er endret.
- Kommunenummer i adressen velger kommune, for eksempel <http://localhost:5173/#1566> for Surnadal.
- `?teknisk` i adressen viser utgave, måling og kall-logg: <http://localhost:5173/?teknisk#5001>.

### Prøve på mobilen

```
npm run dev -- --host
```

Da skriver Vite også ut en adresse på nettverket (`Network: http://192.168.…:5173`). Åpne den på en telefon som er på samme
nett. Brannmuren på maskinen kan spørre om lov første gang.

## Bygge og se det ferdige bygget

```
npm run bygg
npm run forhandsvis
```

`npm run bygg` legger hele siden i `dist/`. `npm run forhandsvis` viser bygget på <http://localhost:4173>, slik det blir på
GitHub Pages. `dist/` kan legges på en hvilken som helst webserver, også i en undermappe. Den virker ikke åpnet rett fra disken
(`file://`), fordi nettleseren da ikke henter skript og data på samme måte.

## Sjekker og tester

| Kommando | Hva den gjør | Tid |
|---|---|---|
| `npm run sjekk` | Typesjekken (`tsc`) av all koden, og sjekken av at sølv og gull holder seg for seg selv og at lagene bruker hverandre i riktig retning | Sekunder |
| `npm run sjekk-format` | Sjekker formateringen. `npm run formater` retter den. | Sekunder |
| `npm test` | Testene av regnefunksjonene i generelt, sølv og gull, uten nett og nettleser | Under ett sekund |
| `npm run regresjon` | Regresjonstesten: bygger siden og kjører Trondheim, Surnadal og Oslo i Chromium | Noen minutter |

Regresjonstesten trenger en Chromium til Playwright. Hent den én gang med `npx playwright install chromium`. For å sammenligne
endringene dine med siste commit:

```
node verktoy/regresjon.ts ut/ny --mot HEAD
```

Tallene kommer fra de åpne tjenestene og endrer seg over tid, så sammenligningen kjører begge utgavene samme dag. To kjøringer av
samme kode gir nøyaktig like tall.

## Utgavemerke og oversiktsbilder

```
npm run utgave
```

setter utgavemerket som vises med `?teknisk`. Oversiktsbildene lages med

```
npm run oversiktsbilde -- --fylke 50
```

eller med kommunenumre i stedet for `--fylke`. Verktøyet kjører koden i `src` i Chromium, som regresjonstesten, så bildene lages på
samme måte som siden henter og leser kartet. Én kommune koster 4 til 16 kall mot NIBIO.

## Legge ut

Push til `main` bygger siden og legger den ut på GitHub Pages med arbeidsflyten «Bygg og legg ut»
(`.github/workflows/legg-ut.yml`). Kjøringene står under Actions i repoet, og der kan den også startes for hånd med
«Run workflow». GitHub Pages må ha «GitHub Actions» som kilde: Settings → Pages → Build and deployment → Source.

## Når noe ikke virker

- **Feil om Node-versjon** fra npm eller Vite, eller `SyntaxError` når et verktøy kjøres: oppgrader Node til 22.18 eller nyere.
- **Porten er opptatt:** Vite velger neste ledige port og skriver den ut i terminalen.
- **Blank side:** åpne utviklerverktøyene i nettleseren og se i konsollen. Et ferdig bygg må åpnes via en webserver, se over.
- **Kartet eller tallene mangler:** en av tjenestene svarer ikke. Kall-loggen med `?teknisk` viser hvilken.
- **npm får ikke kontakt bak en bedriftsproxy:** sett `npm config set proxy http://…` og `npm config set https-proxy http://…`.
