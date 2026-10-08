# Kommunalt naturregnskap – teknologidemo

En nettside som viser arealet i en kommune delt i bebygd, jordbruk og natur, hva kommuneplanen setter av til utbygging, og hvordan
det treffer verneområder, villrein, verdsatt natur, inngrepsfri natur og grått areal. Alt hentes direkte fra åpne tjenester i
nettleseren. Det finnes ingen egen server.

Siden er laget i React med Miljødirektoratets designsystem (<https://design.miljodirektoratet.no>) og bygges med Vite. Legg til
`?teknisk` i adressen for å se utgave, måling og kall-logg.

Dette er en prototype til illustrasjon. Kartet og arealene som regnes ut i nettleseren, er omtrentlige. Grunnkartet fra
NIBIO er lisensiert «Norge digitalt begrenset».

## Kjøre siden

Krever Git og Node 22 (20.19 eller nyere går også).

```
git clone https://github.com/eirikvk/Publicdemorepo.git
cd Publicdemorepo
npm ci
npm run dev        siden på http://localhost:5173, som lastes på nytt ved endringer
npm run bygg       bygger siden til dist/
```

[KOM-I-GANG.md](KOM-I-GANG.md) har hele veien: krav, prøving på mobil, bygg, tester, Python-verktøyene og feilsøking.

Innholdet i `dist/` er hele siden: én HTML-fil, ett skript, ett stilark, skriftfilene og de lagrede dataene. Det kan legges på en
hvilken som helst webserver, også i en undermappe, fordi alle adresser er relative.

## Filene

| Fil | Innhold |
|---|---|
| `index.html` | Inngangen. Bare et tomt element som React fyller. |
| `src/main.jsx` | Stilene fra designsystemet, skriften og kartets stil, og oppstarten av React |
| `src/stil.css` | Sidens egen stil: oppsett, kart, tabeller, stolper og fargeruter. Bruker designsystemets variabler. |
| `src/motor/` | Motoren: henting, utregning og kartet. Vanlig JavaScript uten React. |
| `src/visning/` | Sidens komponenter i React |
| `public/` | Filer som legges ut som de er: listen over kommuner og de lagrede oversiktsbildene |
| `.github/workflows/legg-ut.yml` | Bygger og legger ut siden på GitHub Pages ved push til `main` |
| `.nvmrc` | Node-versjonen, for nvm og for arbeidsflyten |

Motoren:

| Fil | Innhold |
|---|---|
| `ol.js` | Delene av OpenLayers som brukes, samlet som `ol` |
| `felles.js` | Adresser, rutenett, klasser og farger, tilstanden (`app`) og lageret, formatering av tall, kall-logg og henting med minne |
| `grunnlag.js` | Det de andre filene trenger når de lastes: rutenettene for flisene, køen for kall og hjelpere for lag som tegnes i nettleseren |
| `farger.js` | Stilen som sendes til NIBIO, tolking av fargene i svaret og fargelegging i nettleseren |
| `fliser.js` | Grunnkartet som kartfliser, og dagens klasser i en flis |
| `oversikt.js` | Oversiktsbildet zoomet ut: det lagrede, eller det nettleseren setter sammen selv |
| `plan.js` | Kommuneplanen fra DiBK som kartlag, rutenettet for hele kommunen og arealtallene |
| `naturtema.js` | Verneområder, villrein og verdsatt natur fra Miljødirektoratet, og markering av ett område i kartet |
| `inon.js` | Inngrepsfri natur |
| `graa.js` | Grått areal |
| `egne.js` | Egne områder: tegning i kartet, opplasting av plan og sammenligning med kommuneplanen |
| `kart.js` | Selve kartet: bakgrunn, grense, klipping mot kommunen, status, måling og trykk i kartet |
| `tall.js` | Tallene fra SSB: arealklasser, land og vann, og anslått utvikling |
| `handlinger.js` | Det brukeren kan gjøre: velge kommune, slå kartlag av og på, og oppstarten |

Komponentene:

| Fil | Innhold |
|---|---|
| `App.jsx` | Hele siden, og valget av teknisk visning |
| `Topp.jsx` | Valg av fylke og kommune, og overskriften |
| `Kartpanel.jsx` | Kartet med merkelappene oppå, linjen under kartet og knappene for kartlagene |
| `Egne.jsx` | Egne områder og opplastet plan, med tabellene som sammenligner med kommuneplanen |
| `Tallpanel.jsx` | Arealet fra SSB, planlagt utbygging, anslått utvikling og land og vann |
| `Temaer.jsx` | Temaene som rader som kan åpnes, med detaljer og lister over områder |
| `Notater.jsx` | Kall-loggen, hvordan klassene er satt sammen, om siden og tekniske valg |
| `deler.jsx` | Det designsystemet ikke har: fargeruter, stolper, tegnforklaringer og tabellceller |
| `md.js` | Komponentene fra designsystemet som siden bruker |
| `lager.js` | Kroken som kobler komponentene til tilstanden i motoren |

## Dokumentasjon

- [KOM-I-GANG.md](KOM-I-GANG.md) viser hvordan man kjører, bygger og tester siden lokalt.
- [METODE.md](METODE.md) beskriver hvert tall siden viser: hva som hentes, hva som regnes ut, og hvor sikkert det er.
- [AVHENGIGHETER.md](AVHENGIGHETER.md) lister biblioteker, tjenester og verktøy, med lisenser og det som gjelder sikkerhet og
  personvern.

Begge må oppdateres når en metode, en kilde eller et bibliotek endres.

## Motoren og siden

Motoren henter, regner og tegner kartet. Siden viser tallene og tar imot det brukeren gjør. De er skilt slik:

- All delt tilstand ligger i ett objekt, `app`, i `src/motor/felles.js`: valgt kommune, grensen, tallene fra SSB, rutenettet for
  planlagt utbygging, egne områder, hva som er slått på i kartet, og det som vises over og under kartet. Temaene fra
  Miljødirektoratet har dataene sine i `NATURLAG`, ett objekt per tema.
- Den som endrer noe i `app` som vises på siden, kaller `endret()`. Varslene samles, så mange endringer etter hverandre gir én ny
  tegning av siden.
- `App.jsx` abonnerer med kroken `useApp` og tegnes på nytt ved hvert varsel. Komponentene leser tilstanden direkte fra `app` og
  temaene, og gjør tallene om til tekst, tabeller og stolper.
- Komponentene endrer ikke tilstanden selv. De kaller funksjoner i motoren, for eksempel `velg`, `byttKlasse` og `lastOppPlan`.
- Kartet lages av motoren (`lagKart`) og settes inn på siden av `Kartpanel.jsx`. Knappen for å bytte kommune er en del av siden,
  men motoren plasserer den over punktet man trykket på.

De store rutenettene og bildene ligger i `app` sammen med tallene. Det går fordi siden aldri sammenligner eller kopierer tilstanden,
bare leser den.

### Lasting av motoren

Filene i motoren kaller hverandre fram og tilbake. Det går bra så lenge ingen fil bruker en annen mens den lastes. Det som trengs
mens filene lastes (rutenettene, køen for kall og kildene for lag som tegnes i nettleseren), ligger derfor i `grunnlag.js`, som
bare bruker `felles.js`. Selve kartet lages først når alt er lastet. Bryter man regelen, stopper siden med en `ReferenceError` når
den åpnes.

### Regning og tegning

Koden holder tre ting fra hverandre, og navnet på en funksjon sier hvilken den er:

| Navn begynner med | Hva funksjonen gjør |
|---|---|
| `tolk`, `kryss`, `bygg`, `tell`, `les` | Regner. Får alt som argumenter og gir svaret tilbake. Leser ikke fra siden, skriver ikke til den, henter ikke fra nettet og bruker ikke delt tilstand. |
| `vis` | Tegner kartet: slår lag av og på og ber om ny tegning av siden. Regner ikke ut nye tall. |
| `hent`, `sjekk`, `regn`, `velg` | Samordner. Henter data, kaller regnefunksjonene, legger svaret i tilstanden og ber om ny tegning. |

Regnefunksjonene er den delen som kan tas med uendret til en annen løsning. `node verktoy/sjekk-regning.js` kontrollerer at de
holder seg rene. Noen bruker et lerret til å telle piksler, men ingen av dem rører siden.

Teksten på siden lages i komponentene. Enkelte tall der regnes også ut der, som prosenter av tall som alt ligger i tilstanden.

## Designsystemet

Siden bruker `@miljodirektoratet/md-react` og `@miljodirektoratet/md-css`, åpen kildekode i `miljodir/md-components` på
GitHub. Dette er brukt hvor:

| Komponent | Brukes til |
|---|---|
| `MdSelect` | Valg av fylke |
| `MdComboBox` | Valg av kommune. Søker i alle kommuner, og viser kommunene i valgt fylke når søkefeltet er tomt. |
| `MdFilterChip` | Kartlagene av og på |
| `MdAccordionItem` | Temaene, med tallene i raden og detaljene inni |
| `MdAlertMessage` | Ingen kommuneplan (`warning`), egne områder i tallene (`info-box`), og meldinger om tegning og opplasting |
| `MdButton`, `MdIconButton` | Tegning og opplasting, vis i kartet, faktaark, slett, bytt kommune, til listen og fjern markering |
| `MdLink` | Lenker i løpende tekst |
| `MdRadioGroup` | Om et tegnet område er utbygging eller ikke |
| `MdCheckbox`, `MdToggle` | Slør over det som ikke er kartlagt, smale striper og teknisk visning |
| `MdLoadingSpinner` | Mens kartet hentes |
| Ikoner | Tegn, last opp, sted, åpne i ny fane, slett og lukk |

Det designsystemet ikke har, er laget selv med designsystemets variabler for farger, skrift og avstander: tabeller, stolpene som
viser fordeling, tegnforklaringer med fargeruter, og alt i kartet. Kartfargene for arealklasser og tema er data, ikke utforming,
og følger med som før.

### Fast mønster for utformingen

Reglene står også øverst i `src/stil.css`. De bygger på designsystemets sider om farger, typografi og komponenter, og på
Miljødirektoratets profil og språkprofil.

- **Skrift.** Sidetittelen (kommunenavnet) er `heading-l`, og `heading-xl` på bred skjerm. Seksjoner har `heading-s` (klassen
  `seksjonstittel`), kort og bokser `heading-xs` (`korttittel`). Brødtekst er 16 px. Kilder, hjelpetekst og tabeller er 14 px,
  og 12 px brukes bare for små tall under tallene i tabellene og i teknisk visning. Uthevinger har vekt 600.
- **Flater.** Siden er hvit. Rader som kan åpnes, har designsystemets egen flate. Kort og bokser er hvite med tynn grå kant.
  Beige brukes bare i meldinger av typen `info-box`, oransje bare i advarsler. Sjøgrønn er eneste aksentfarge, som profilen sier:
  én hovedfarge, og høyst én av de andre om gangen.
- **Handlinger.** Primærknapp bare for hovedvalget i et øyeblikk: «Ferdig» når man tegner, og «Bytt til …» etter trykk utenfor
  kommunen. Sekundærknapper for verktøy, tertiærknapper for handlinger i
  lister («Vis i kartet», «Faktaark»), og vanlige lenker bare i løpende tekst.
- **Avstander.** Designsystemets trinn (4, 8, 12, 16, 24, 32 px). Mellom avsnitt i løpende tekst minst to ganger
  skriftstørrelsen, som designsystemet krever etter WCAG 2.1.
- **Tekst.** Språkprofilen: tall til og med tolv med bokstaver i løpende tekst, forkortelser skrevet ut første gang
  (Statistisk sentralbyrå (SSB)), desimalkomma, og mellomrom foran prosent. «Dekar» i setninger og «daa» i tabeller og lister.
- **Kartfarger.** Fargene i kartet er data og velges for å skille klassene, også ved fargeblindhet. Der profilen har en farge
  med samme rolle, brukes den: Oransje mørk for villrein, Sjøgrønn lys for grønt i bebygd område og Blå mørk for egne områder.
  Verneområder og verdsatt natur har egne farger, se `FARGER` i `src/motor/felles.js`.

Det designsystemet ikke sier noe om, er laget etter de samme reglene: tabellene (`talltabell`), oppsettet med kart og tall i to
kolonner, og alt i kartet.

Ting å vite:

- Designsystemet har ikke mørkt tema, så siden har det ikke lenger.
- Tre feil i designsystemet (md-css 6.32.0) rettes i `src/stil.css`: variabelen `--md-typography-weight-semibold` brukes av
  etikettene, men er ikke definert, så den settes til 600. «Lukk» nederst i rader som kan åpnes, har ingen skrift og får
  nettleserens standardskrift, så knapper arver skriften. Overskriften i de samme radene regner bredde uten kant, så
  fargerutene setter dette selv.
- Skriften i designsystemet er Open Sans og Sofia Pro. Open Sans følger med bygget (fra `@fontsource/open-sans`). Sofia Pro kan
  bare brukes i Miljødirektoratets egne løsninger og ligger ikke i dette repoet, så overskriftene bruker Open Sans. Har maskinen
  Sofia Pro installert, brukes den.
- Komponentene hentes hver for seg (`src/visning/md.js`), og bare stilene for dem lastes (`src/main.jsx`). Pakkens samlede
  inngang tar med alle komponentene.
- Komponentene er CommonJS og henter Ariakit med `require`. Ariakits CommonJS-utgave har en hjelper som byggeverktøyet gjør om
  til en uendelig løkke, så `vite.config.js` sender `@ariakit/react` til Ariakits ES-utgave.
- `MdComboBox` finnes bare som standardeksport. `md.js` tar høyde for begge måtene byggeverktøyet kan levere den på.

## Legge ut en endring

1. Gjør endringen.
2. `python3 verktoy/utgave.py` setter nytt utgavemerke, som vises under «Vis teknisk informasjon».
3. `npm run sjekk` og `npm test` (se under).
4. Commit og push til `main`.

Arbeidsflyten `.github/workflows/legg-ut.yml` («Bygg og legg ut») kjører ved hver push til `main`: den installerer pakkene fra
`package-lock.json`, kjører `npm run sjekk`, bygger og legger ut `dist/` på GitHub Pages. Den kan også startes for hånd under
Actions. Feiler sjekken eller bygget, blir ingenting lagt ut, og siden som ligger ute, står urørt.

GitHub Pages må ha «GitHub Actions» som kilde (Settings → Pages → Build and deployment → Source). Står den på «Deploy from a
branch», legger GitHub ut repoet slik det er, uten bygg, og siden blir blank.

Hver action i arbeidsflyten er låst til en bestemt commit, med versjonen i en kommentar. Ved oppgradering byttes både
commit og kommentar.

## Verktøy

Verktøyene ligger i `verktoy/` og trengs bare under utvikling.

- `utgave.py` setter utgavemerke, se over.
- `regresjon.js` bygger siden, kjører et fast sett handlinger i en mobilnettleser for Trondheim, Surnadal og Oslo, og lagrer
  tallene motoren har regnet ut, teksten siden viser og skjermbilder av kartet. `node verktoy/regresjon.js ut/ny --mot HEAD`
  sammenligner arbeidskopien med siste commit. Tallene kommer fra åpne tjenester og endrer seg over tid, så de to kjøringene må
  tas samme dag. Ett kjent avvik som ikke skyldes koden: arealet av verdsatt natur per verdikategori kan skille med under én
  dekar mellom kjøringer.
- `motortall.js` henter tallene fra motoren til regresjonstesten. Siden gjør motoren tilgjengelig som `window.motor` med
  `?teknisk`.
- `sjekk-regning.js` kontrollerer skillet mellom regning og tegning, og `sjekk-navn.js` at alle navn som brukes, er definert eller
  importert. `npm run sjekk` kjører begge.
- `oversiktsbilde.py` lager de lagrede oversiktsbildene, for eksempel `python3 verktoy/oversiktsbilde.py --fylke 50`.
  Én kommune koster 4 til 16 kall mot NIBIO.
- `testdata/testplan-bygg.geojson` er tolv planflater fra Trondheim, hentet fra DiBK, til test av opplasting.

`npm run formater` formaterer koden etter `.prettierrc.json`.

## Kilder

Grunnkart for arealanalyse og kart over grå arealer: NIBIO. Arealtall: SSB, tabell 09594. Kommuneplaner: DiBK.
Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grenser og bakgrunnskart: Kartverket.
