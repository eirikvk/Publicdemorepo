# Kommunalt naturregnskap – teknologidemo

En statisk nettside som viser arealet i en kommune delt i bebygd, jordbruk og natur, hva kommuneplanen setter av til
utbygging, og hvordan det treffer verneområder, villrein, verdsatt natur, inngrepsfri natur og grått areal. Alt hentes
direkte fra åpne tjenester i nettleseren. Det finnes ingen egen server og ikke noe byggesteg.

Siden ligger på <https://eirikvk.github.io/Publicdemorepo/>. Legg til `?teknisk` i adressen for å se utgave, måling og
kall-logg.

Dette er en prototype til illustrasjon. Kartet og arealene som regnes ut i nettleseren, er omtrentlige. Grunnkartet fra
NIBIO er lisensiert «Norge digitalt begrenset».

## Filene

| Fil | Innhold |
|---|---|
| `index.html` | Sidens innhold og rekkefølgen skriptene lastes i |
| `stil.css` | All stil, med fargene som variabler øverst |
| `js/felles.js` | Adresser, rutenett, klasser, formatering av tall, kall-logg, henting med minne og små hjelpere |
| `js/farger.js` | Stilen som sendes til NIBIO, tolking av fargene i svaret og fargelegging i nettleseren |
| `js/fliser.js` | Grunnkartet som kartfliser, køen for kall, og hjelpere for lag som tegnes i nettleseren |
| `js/oversikt.js` | Oversiktsbildet zoomet ut: det lagrede, eller det nettleseren setter sammen selv |
| `js/plan.js` | Kommuneplanen fra DiBK som kartlag, rutenettet for hele kommunen og arealtallene |
| `js/naturtema.js` | Verneområder, villrein og verdsatt natur fra Miljødirektoratet, og markering av ett område i kartet |
| `js/inon.js` | Inngrepsfri natur |
| `js/graa.js` | Grått areal |
| `js/egne.js` | Egne områder: tegning i kartet, opplasting av plan og sammenligning med kommuneplanen |
| `js/kart.js` | Selve kartet: bakgrunn, grense, klipping mot kommunen, status, måling og trykk i kartet |
| `js/tall.js` | Tallene fra SSB: arealklasser, land og vann, og anslått utvikling |
| `js/start.js` | Tallpanelet, knappene, valg av kommune og oppstart |
| `kommuner.json` | Fylker og kommuner med omtrentlig utstrekning |
| `oversikt.json`, `oversikt/` | Lagrede oversiktsbilder og registeret over dem |

Skriptene er vanlige skript, ikke moduler. De deler ett navnerom og lastes i den rekkefølgen `index.html` lister dem.
En fil kan bruke alt fra filene over seg når den lastes, og alt fra alle filene når siden kjører. Navn på toppnivå må
derfor være unike på tvers av filene. De må heller ikke være like en `id` i `index.html`: nettleseren lager selv et
globalt navn for hvert element med `id`, og eldre utgaver av Safari nektet å laste et skript som brukte samme navn.

## Legge ut en endring

1. Gjør endringen.
2. `python3 verktoy/utgave.py` setter nytt utgavemerke. Hver fil hentes med utgaven i adressen, så nettleseren ikke
   blander ny `index.html` med gammel kode.
3. Commit og push til `main`. GitHub Pages legger ut siden.

## Verktøy

Verktøyene ligger i `verktoy/` og trengs bare under utvikling.

- `utgave.py` setter utgavemerke, se over.
- `regresjon.js` kjører et fast sett handlinger i en mobilnettleser for Trondheim, Surnadal og Oslo, og lagrer tallene
  siden viser og skjermbilder av kartet. `node verktoy/regresjon.js ut/ny --mot HEAD` sammenligner arbeidskopien med
  siste commit. Tallene kommer fra åpne tjenester og endrer seg over tid, så de to kjøringene må tas samme dag.
  Ett kjent avvik som ikke skyldes koden: arealet for én verdikategori i Oslo veksler med én dekar mellom kjøringer.
- `oversiktsbilde.py` lager de lagrede oversiktsbildene, for eksempel `python3 verktoy/oversiktsbilde.py --fylke 50`.
  Én kommune koster 4 til 16 kall mot NIBIO.
- `testdata/testplan-bygg.geojson` er tolv planflater fra Trondheim, hentet fra DiBK, til test av opplasting.

`npm install` henter Playwright og Prettier. `npm run formater` formaterer koden etter `.prettierrc.json`.

## Kilder

Grunnkart for arealanalyse og kart over grå arealer: NIBIO. Arealtall: SSB, tabell 09594. Kommuneplaner: DiBK.
Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grenser og bakgrunnskart: Kartverket.
