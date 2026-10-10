# Biblioteker, tjenester og verktøy

Dette dokumentet lister alt siden er avhengig av utenfor sin egen kode: biblioteker som følger med i bygget, tjenester den henter
data fra, og verktøy som brukes under utvikling. Det følger koden slik den var 8. oktober 2026, etter overgangen til React og
Miljødirektoratets designsystem.

## Rammeverk og bygg

Siden er laget i React og bygges med Vite. Byggesteget samler sidens egen kode og bibliotekene i ett skript og ett stilark, og
legger dem sammen med skriftene og de lagrede dataene i `dist/`. Det finnes ingen egen server og ingen database: det som bygges,
er statiske filer.

Versjonene er låst i `package.json`, og hele treet av pakker i `package-lock.json`.

## Biblioteker som følger med siden

| Bibliotek | Versjon | Lisens | Brukes til |
|---|---|---|---|
| React og React DOM | 19.2.5 | MIT | Sidens komponenter. Versjonen er den designsystemet krever. |
| `@miljodirektoratet/md-react` | 6.35.0 | MIT | Komponentene fra Miljødirektoratets designsystem |
| `@miljodirektoratet/md-css` | 6.32.0 | MIT | Stilene og variablene (farger, skrift, avstander) i designsystemet |
| Ariakit (`@ariakit/react`) | 0.4.41 | MIT | Grunnlaget for designsystemets velgere. Kommer med designsystemet. |
| classnames | 2.5.1 | MIT | Kommer med designsystemet |
| OpenLayers (`ol`) | 10.6.1 | BSD 2-Clause | Kartet (`src/ui/kart/`): lag, fliser, tegning av flater og zoom. Datadelen bruker det ikke. |
| proj4js | 2.11.0 | MIT | Koordinatsystemer: UTM sone 32, 33 og 35 og grader, blant annet for opplastede planer (`src/data/solv/projeksjoner.ts`, og registrert i kartet). Pakken har ingen egne typer, så det siden bruker av den, er beskrevet i `src/data/solv/proj4.d.ts`. |
| polygon-clipping | 0.15.7 | MIT | Klipping av verneområder og villreinområder mot kommunegrensen, og sammenslåing av dekningsflater |
| `@fontsource/open-sans` | 5.2.7 | SIL Open Font License 1.1 | Skriften Open Sans, i to vekter |

Designsystemet tar også med pakken `material-symbols` (Apache 2.0) ved installasjon, men den brukes ikke og kommer ikke med i
bygget. Ikonene i designsystemet er egne komponenter.

Størrelse i bygget, pakket slik nettleseren henter det: skriptet er rundt 330 kB og stilarket rundt 24 kB. Det meste av skriptet
er OpenLayers, React og Ariakit. Skriften er rundt 37 kB for de to vektene med latinske tegn. Andre tegnsett hentes bare hvis
siden viser slike tegn. Til sammenligning var bibliotekene og sidens egen kode rundt 350 kB før overgangen.

## Skrifter

Designsystemet bruker Open Sans og Sofia Pro. Open Sans følger med bygget. Sofia Pro kan bare brukes i Miljødirektoratets egne
løsninger, og ligger derfor ikke i dette repoet, som er åpent. Overskriftene bruker Open Sans i stedet, eller Sofia Pro hvis den
er installert på maskinen. Skal siden brukes av Miljødirektoratet, kan Sofia Pro legges inn som en egen skriftfil.

## Tjenester siden henter data fra

Alle kall går direkte fra nettleseren til tjenesten. Ingen av dem krever innlogging eller nøkkel.

| Eier | Tjeneste | Adresse | Type | Brukes til |
|---|---|---|---|---|
| SSB | Tabell 09594, nytt API | data.ssb.no/api/pxwebapi/v2 | JSON | Arealtall og tidsserie |
| SSB | Tabell 09594, eldre API | data.ssb.no/api/v0 | JSON | Reserve når det nye ikke svarer |
| Kartverket | Kommuneinfo | api.kartverket.no/kommuneinfo/v1 | JSON | Kommunegrense, og kommune i et punkt |
| Kartverket | Bakgrunnskart, gråtone | cache.kartverket.no | Kartfliser (WMTS) | Bakgrunnen i kartet |
| NIBIO | Grunnkart for arealanalyse | wms.nibio.no/cgi-bin/grunnkart_arealanalyse | WMS | Dagens arealklasser |
| NIBIO | Kart over grå arealer | wms.nibio.no/cgi-bin/graastruktur | WMS | Grått areal |
| DiBK | Kommuneplaner | nap.ft.dibk.no/services/wms/kommuneplaner | WMS | Planlagt utbygging, og opplysninger om planen |
| Miljødirektoratet | Naturvernområder, villrein, naturtyper med KU-verdi, dekningskart | kart.miljodirektoratet.no/arcgis/rest/services | ArcGIS REST | Naturtema som flater |
| Miljødirektoratet | Inngrepsfrie naturområder | kart.miljodirektoratet.no/geoserver/inngrepsfrinatur | WMS | Inngrepsfri natur |

Lagret sammen med siden ligger listen over fylker og kommuner (`public/kommuner.json`, fra Kartverket) og oversiktsbildene for
39 kommuner (`public/oversikt/`, laget fra NIBIOs grunnkart).

## Drift

Siden ligger på GitHub Pages fra repoet `eirikvk/Publicdemorepo`. Arbeidsflyten «Bygg og legg ut»
(`.github/workflows/legg-ut.yml`) bygger og legger ut siden ved hver push til `main`, på GitHubs egne maskiner. Den bruker disse
actions fra GitHub, alle med MIT-lisens og låst til en bestemt commit:

| Action | Versjon | Brukes til |
|---|---|---|
| `actions/checkout` | 7.0.1 | Henter koden |
| `actions/setup-node` | 7.0.0 | Node i versjonen fra `.nvmrc`, med minne for npm-pakkene |
| `actions/configure-pages` | 6.0.0 | Leser oppsettet for GitHub Pages |
| `actions/upload-pages-artifact` | 5.0.0 | Pakker `dist/` |
| `actions/deploy-pages` | 5.0.1 | Legger ut pakken |

GitHub Pages må ha «GitHub Actions» som kilde, se README.

## Vilkår for dataene

- NIBIOs grunnkart for arealanalyse er lisensiert «Norge digitalt begrenset». Det gjelder både kartflisene og de lagrede
  oversiktsbildene. Dette må avklares før siden brukes utenfor en prototype.
- Kart over grå arealer er en testversjon.
- Vilkårene for de andre tjenestene er ikke kontrollert i dette arbeidet. Siden krediterer Kartverket, NIBIO og DiBK i kartet
  og alle kildene i teksten.
- Siden belaster tjenestene direkte fra hver brukers nettleser. Kall mot NIBIO og DiBK går i kø med høyst fire om gangen per
  kilde, og svar huskes i cachen så lenge siden er åpen.

## Sikkerhet og personvern

- Siden setter ingen informasjonskapsler og lagrer ingenting i nettleseren. Valg som teknisk visning og kommune står i adressen.
- Det er ingen måling av bruk og ingen sporing i sidens kode.
- Filer brukeren laster opp, og områder brukeren tegner, leses og regnes i nettleseren og sendes ingen steder.
- Bibliotekene og skriften følger med siden og hentes fra samme sted som den. Nettleseren kontakter seks verter utenfor siden,
  alle hos dataeierne. Hver av dem ser brukerens IP-adresse og hvilken side kallet kommer fra, og kallene viser hvilken kommune
  og hvilket kartutsnitt brukeren ser på.
- Før overgangen ble bibliotekene og skriftene hentet fra fire andre verter uten integritetssjekk. Det problemet er borte, fordi
  alt nå bygges inn i siden fra pakker med låste versjoner.
- Pakkene hentes fra npm når siden bygges. `npm audit` viste ingen kjente sårbarheter 8. oktober 2026.

## Verktøy under utvikling

Ingen av disse følger med siden til brukeren.

| Verktøy | Versjon | Lisens | Brukes til |
|---|---|---|---|
| Vite | 8.3.0 | MIT | Utviklingsserver og bygg, og koden til verktøyet for oversiktsbilder |
| `@vitejs/plugin-react` | 6.1.1 | MIT | JSX og oppdatering av komponenter under utvikling |
| TypeScript | 7.0.2 | Apache 2.0 | Typesjekken (`tsc`) |
| `@types/node`, `@types/react`, `@types/react-dom` | 22.20.4, 19.3.0, 19.3.0 | MIT | Typene for Node og React |
| oxc-parser | 0.151.0 | MIT | Sjekken av lagene: leser koden og finner importene |
| Playwright | 1.56.0 | Apache 2.0 | Regresjonstesten og verktøyet for oversiktsbilder, som kjører i Chromium |
| Prettier | 3.9.9 | MIT | Formatering av koden |

Node-versjonen står i `.nvmrc` (22), og kravet i `package.json` (22.18 eller nyere): fra den versjonen kjører Node verktøyene i TypeScript direkte.
