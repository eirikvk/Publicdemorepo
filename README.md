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

## Slik henger koden sammen

Dataene går gjennom tre lag, etter mønsteret bronse, sølv og gull fra moderne dataplattformer. Motoren samordner lagene, og
visningen viser resultatet:

```
Åpne tjenester: SSB, Kartverket, NIBIO, DiBK, Miljødirektoratet
      │
      ▼
src/bronse/   Bronse: hvordan hver tjeneste brukes. Adresser, parametre og stiler.
              Svarene kommer urørt tilbake. Alt nettverk går gjennom dette laget.
      │
      ▼
src/solv/     Sølv: felles standard, så dataene fra flere kilder kan brukes sammen.
              UTM33, km², de tre klassene, kommunen og rutenettene.
      │
      ▼
src/gull/     Gull: svarene. Arealer, andeler, kryssinger og regnskap, i den formen
              hver side trenger.
      │
      ▼
src/visning/  Visning: React. Gjør gull om til tekst, lister, stolper og tabeller.


src/motor/    Samordner: bestemmer hva som hentes og regnes når, holder tilstanden
              (app), tegner kartet og sier fra til siden når noe er klart (endret).
```

Sølv og gull får alt som argumenter og gir svaret tilbake. De bruker verken kartet, siden eller nettet, og kan kjøres i Node.

Slik går en runde, for eksempel når brukeren velger kommune:

1. Brukeren velger Trondheim i `Topp.jsx`. Komponenten kaller `velg` i `motor/handlinger.js`.
2. Motoren ber bronse hente grensen, tallene fra SSB, kommuneplanen og temaene. Sølv gjør dem om til felles standard, og motoren
   legger dem i `app`. Kryssingene med planlagt utbygging tar tid, så motoren kjører dem i gull én gang og legger svaret i `app`.
3. Hver gang noe er klart, kaller motoren `endret()`. React tegner da siden på nytt. Hver komponent gir det som ligger i `app` til
   en `bygg`-funksjon i gull, og viser svaret.

Velger brukeren en side, kaller `Sidevelger.jsx` funksjonen `velgSide` i motoren. Den husker siden i `app.side`, slår på
temaet i kartet og skriver siden i adressen, for eksempel `#5001/verdi`. Lenkene mellom sidene, som navnene på oversikten, gjør
det samme (`Sidelenke` i `deler.jsx`).

Komponentene endrer aldri tilstanden selv, og regner ikke selv. De viser det gull gir dem, og kaller motoren når brukeren gjør
noe.

Siden er bygd opp av disse delene. De fleste har en `.jsx`-fil og en `.css`-fil med samme navn i `src/visning/`:

```
App              sideoppsettet: toppen, sidevelgeren, og kartet og innholdet i to kolonner
├─ Topp          navnet, valg av fylke og kommune, og kommunenavnet
├─ Sidevelger    én knapp per side, med temaene samlet under «Naturen i kommunen». Siden bestemmer innholdet og hva kartet viser.
├─ Kartpanel     kartet og linjen under det
└─ Innhold       den valgte siden:
   ├─ Oversikt   det viktigste fra hver side, med lenke til siden
   ├─ Regnskap   utbredelsesregnskapet: forklart med stolper, satt opp som regnskap, og land og vann
   ├─ Temaer     én side per tema: grått areal, villrein, inngrepsfri natur, verdsatt natur og verneområder
   ├─ Framtid    utvikling fremover: planlagt utbygging, og
   │  └─ Egne    egne områder: tegning, opplasting og sammenligning
   └─ Om         om og metode, og tekniske valg
```

Hver side bestemmer hva kartet viser: arealklassene og planlagt utbygging vises alltid, og temaet bare på sin egen side. Hvilke
sider som finnes, rekkefølgen og gruppene står i `SIDER` i `motor/handlinger.js`.

Felles for alle delene:

| Fil | Hva den er |
|---|---|
| `src/grunnlag.css` | Stilen som gjelder hele siden, og reglene for utformingen |
| `deler.jsx` og `deler.css` | Byggeklossene designsystemet ikke har: fargeruter, stolper, lister og tabeller med tall |
| `tekst.js` | Hvordan tall og tekst skrives |
| `md.js` | Komponentene fra designsystemet som siden bruker |

Stilen kommer i tre lag, der hvert lag kan bygge på det forrige: designsystemets egen CSS (hentet i `main.jsx`), så
`grunnlag.css`, så filen til hver komponent.

## Filene

| Fil | Innhold |
|---|---|
| `index.html` | Inngangen. Bare et tomt element som React fyller. |
| `src/main.jsx` | Stilene fra designsystemet, skriften, kartets stil og den felles stilen, og oppstarten av React |
| `src/grunnlag.css` | Stilen som gjelder hele siden. Bruker designsystemets variabler. |
| `src/bronse/` | Hentingen, én fil per tjeneste |
| `src/solv/` | Felles standard for dataene. Kan kjøres i Node. |
| `src/gull/` | Svarene sidene viser, én fil per tema. Kan kjøres i Node. |
| `src/motor/` | Motoren: samordningen, tilstanden og kartet. Vanlig JavaScript uten React. |
| `src/visning/` | Sidens komponenter i React |
| `public/` | Filer som legges ut som de er: listen over kommuner og de lagrede oversiktsbildene |
| `.github/workflows/legg-ut.yml` | Bygger og legger ut siden på GitHub Pages ved push til `main` |
| `.nvmrc` | Node-versjonen, for nvm og for arbeidsflyten |

Bronse, i `src/bronse/`. Én fil per tjeneste, og en felles fil for hvordan det hentes.

| Fil | Innhold |
|---|---|
| `henting.js` | Henting med minne, kall-loggen, og køen for kartbilder (høyst fire kall om gangen per kilde) |
| `ssb.js` | SSB, tabell 09594, med det eldre API-et som reserve |
| `kartverket.js` | Fylker og kommuner, kommunegrensene, oppslag av kommune i et punkt, og bakgrunnskartet |
| `nibio-grunnkart.js` | Nasjonalt grunnkart for arealanalyse: kartbildene med de seks klassene i rene farger, og de lagrede oversiktsbildene |
| `dibk-kommuneplan.js` | Kommuneplanene hos DiBK: flatene for framtidig utbygging, hvor mye av kommunen planen dekker, og navnet på planen |
| `mdir-naturtema.js` | Miljødirektoratets verneområder, villreinområder, naturtyper med KU-verdi og det kartlagte området |
| `mdir-inon.js` | Inngrepsfrie naturområder, som ett bilde av kommunen |
| `nibio-graa.js` | Kart over grå arealer, som bilder av kommunen og som fliser |
| `planfil.js` | En opplastet planfil, lest i nettleseren og gjort om til UTM33 |

Sølv, i `src/solv/`. METODE.md forklarer metoden bak hver fil.

| Fil | Innhold |
|---|---|
| `felles.js` | Rutenettene, alle terskler, målestokken i UTM og arealet av en flate |
| `raster.js` | Fra flater til ruter: flatene tegnes i et lerret. Den eneste filen i sølv og gull som bruker nettleseren. |
| `klasser.js` | Bebygd, jordbruk og natur: koblingen til SSBs arealklasser og grunnkartets økosystemtyper, og tolking av fargene i kartbildene |
| `ssb.js` | SSB-svarene gjort om til km² per klasse, for nyeste år og 2017 |
| `planrutenett.js` | Kommuneplanen lagt oppå dagens klasser i ruter på 21 meter, med smale striper tatt bort, og om kommunen har plan |
| `egne.js` | Egne områder: hvilke flater som er utbygging, og hvordan de legges inn i planrutenettet |
| `temaer.js` | Verneområder, villrein og verdsatt natur: flatene klippet mot kommunen, og som masker i et rutenett |
| `inon.js` | Inngrepsfri natur: sone per rute |
| `graa.js` | Grått areal: trinn per rute etter andel vegetasjon |

Gull, i `src/gull/`. Funksjonene som heter `bygg` noe, gir det en side viser.

| Fil | Innhold |
|---|---|
| `felles.js` | Andel i prosent, og tilstanden for temaene som hentes som ett bilde |
| `regnskap.js` | Utbredelsen nå, forskjellen fra 2017, regnskapsoppstillingen, og land og vann |
| `planlagt.js` | Natur og jordbruk som planen setter av, med andeler, og kortversjonen til oversikten |
| `egne.js` | Hva som ligger i hvert eget område, og radene som sammenligner med kommuneplanen |
| `temaer.js` | Arealet per verdikategori, kryssingen med planen, og tallene på temasidene |
| `inon.js` | Arealet per sone og tallene på siden |
| `graa.js` | Arealet per trinn, kryssingen med planen, og tallene på siden |

Reglene for lagene sjekkes av `verktoy/sjekk-regning.js`: sølv importerer bare fra sølv, og gull fra gull og sølv. De bruker
ikke nettleseren eller tilstanden (bortsett fra lerretet i `raster.js`), og har ingen variabler på toppnivå som kan endres.
Bronse bruker ikke gull. Visningen henter ikke fra bronse, og tar bare navn og faste verdier fra sølv.

Motoren:

| Fil | Innhold |
|---|---|
| `ol.js` | Delene av OpenLayers som brukes, samlet som `ol` |
| `felles.js` | Projeksjoner, kartfargene, tilstanden (`app`) og lageret, og formatering av tall |
| `grunnlag.js` | Det de andre filene trenger når de lastes: rutenettene for flisene, hva kartet holder på med, og hjelpere for lag som tegnes i nettleseren |
| `farger.js` | Fargelegging av kartbildene i nettleseren |
| `fliser.js` | Grunnkartet som kartfliser, og dagens klasser i en flis |
| `oversikt.js` | Oversiktsbildet zoomet ut: det lagrede, eller det nettleseren setter sammen selv |
| `plan.js` | Kommuneplanen fra DiBK som kartlag, og samordningen av planrutenettet |
| `naturtema.js` | Verneområder, villrein og verdsatt natur: kartlagene, samordningen, og markering av ett område i kartet |
| `inon.js` | Inngrepsfri natur: kartlaget og samordningen |
| `graa.js` | Grått areal: kartlaget og samordningen |
| `egne.js` | Egne områder: tegning i kartet, opplasting av planfil, og det radene i sammenligningen bygges av |
| `kart.js` | Selve kartet: bakgrunn, grense, klipping mot kommunen, status, måling og trykk i kartet |
| `tall.js` | Tallene fra SSB: samordningen av henting og tolking, og hvor de legges i tilstanden |
| `handlinger.js` | Det brukeren kan gjøre: velge kommune, velge side (og dermed hva kartet viser), og oppstarten |

Komponentene. Hver av dem har en CSS-fil med samme navn, for eksempel `Temaer.css` ved siden av `Temaer.jsx`.

| Fil | Innhold |
|---|---|
| `App.jsx` | Hele siden, og valget av teknisk visning |
| `Topp.jsx` | Valg av fylke og kommune, og overskriften |
| `Sidevelger.jsx` | Knappene for sidene, over kart og innhold, i grupper |
| `Kartpanel.jsx` | Kartet med merkelappene oppå, og linjen under kartet |
| `Innhold.jsx` | Den valgte siden. Alle sidene ligger i siden, men bare den valgte vises. |
| `Oversikt.jsx` | Det viktigste fra hver side: navnet som lenke, ett tall og en kort forklaring |
| `Regnskap.jsx` | Utbredelsesregnskapet: natur nå, forskjellen fra 2017 som stolper, regnskapsoppstillingen, og land og vann |
| `Temaer.jsx` | Én side per tema, med detaljer og lister over områder |
| `Framtid.jsx` | Utvikling fremover: planlagt utbygging og egne områder |
| `Egne.jsx` | Egne områder og opplastet plan, med tabellene som sammenligner med kommuneplanen |
| `Om.jsx` | Om og metode: kall-loggen, hvordan klassene er satt sammen, om siden og tekniske valg |
| `deler.jsx` | Det designsystemet ikke har: fargeruter, stolper, tegnforklaringer, linjer i en liste med tall, lenker mellom sidene og tabeller med tall |
| `tekst.js` | Hvordan tall og tekst skrives: prosent, dekar, endring med fortegn, tall med bokstaver og oppramsing |
| `md.js` | Komponentene fra designsystemet som siden bruker |
| `lager.js` | Kroken som kobler komponentene til tilstanden i motoren |

## Dokumentasjon

- [KOM-I-GANG.md](KOM-I-GANG.md) viser hvordan man kjører, bygger og tester siden lokalt.
- [METODE.md](METODE.md) forklarer hver analyse med samme oppsett (spørsmål, data inn, steg, resultat, usikkerhet, kontroll og
  kode), i samme inndeling som `src/solv/` og `src/gull/`.
- [AVHENGIGHETER.md](AVHENGIGHETER.md) lister biblioteker, tjenester og verktøy, med lisenser og det som gjelder sikkerhet og
  personvern.

Begge må oppdateres når en metode, en kilde eller et bibliotek endres.

## Motoren og siden

Motoren samordner henting og utregning, og tegner kartet. Siden viser tallene og tar imot det brukeren gjør. De er skilt slik:

- All delt tilstand ligger i ett objekt, `app`, i `src/motor/felles.js`: valgt kommune, grensen, tallene fra SSB, rutenettet for
  planlagt utbygging, egne områder, valgt side, hva som er slått på i kartet, og det som vises over og under kartet. Temaene fra
  Miljødirektoratet har dataene sine i `NATURLAG`, ett objekt per tema.
- Den som endrer noe i `app` som vises på siden, kaller `endret()`. Varslene samles, så mange endringer etter hverandre gir én ny
  tegning av siden.
- `App.jsx` abonnerer med kroken `useApp` og tegnes på nytt ved hvert varsel. Komponentene gir det som ligger i `app` og temaene
  til gull, og gjør svaret om til tekst, tabeller og stolper.
- Komponentene endrer ikke tilstanden selv. De kaller funksjoner i motoren, for eksempel `velg`, `velgSide` og `lastOppPlan`.
- Kartet lages av motoren (`lagKart`) og settes inn på siden av `Kartpanel.jsx`. Knappen for å bytte kommune er en del av siden,
  men motoren plasserer den over punktet man trykket på.

De store rutenettene og bildene ligger i `app` sammen med tallene. Det går fordi siden aldri sammenligner eller kopierer tilstanden,
bare leser den.

### Lasting av motoren

Filene i motoren kaller hverandre fram og tilbake. Det går bra så lenge ingen fil bruker en annen mens den lastes. Det som trengs
mens filene lastes (rutenettene, køen for kall og kildene for lag som tegnes i nettleseren), ligger derfor i `grunnlag.js`, som
bare bruker `felles.js`. Selve kartet lages først når alt er lastet. Bryter man regelen, stopper siden med en `ReferenceError` når
den åpnes.

### Henting, regning, tegning og samordning

Koden holder fire ting fra hverandre, og både mappen og navnet på en funksjon sier hvilken den er:

| Hvor | Navn begynner med | Hva funksjonen gjør |
|---|---|---|
| `src/bronse/` | `hent` | Henter fra én tjeneste og gir svaret urørt tilbake. Det eneste stedet det går kall ut på nettet. |
| `src/solv/` og `src/gull/` | `tolk`, `kryss`, `bygg`, `tell` og andre | Regner. Får alt som argumenter og gir svaret tilbake. Leser ikke fra siden, skriver ikke til den, henter ikke fra nettet og bruker ikke delt tilstand. |
| `src/motor/` | `vis` | Tegner kartet: slår lag av og på og ber om ny tegning av siden. Regner ikke ut nye tall. |
| `src/motor/` | `hent`, `sjekk`, `regn`, `velg` | Samordner. Ber bronse hente, kaller sølv og gull, legger svaret i tilstanden og ber om ny tegning. |

Sølv og gull er den delen som kan tas med uendret til en annen løsning, og kan kjøres i Node. Flatene gjøres om til ruter ved å
tegne dem i et lerret, og det er det eneste de trenger fra nettleseren (`raster.js`). `node verktoy/sjekk-regning.js`
kontrollerer reglene, retningen mellom lagene, og at det ikke er havnet regnefunksjoner i motoren.

Komponentene regner ikke. Tallene og andelene kommer fra gull, og komponentene velger ord, avrunding og enhet. Unntaket er
stripene i `deler.jsx`, som regner ut bredden på hver del av det de tegner.

## Designsystemet

Siden bruker `@miljodirektoratet/md-react` og `@miljodirektoratet/md-css`, åpen kildekode i `miljodir/md-components` på
GitHub. Dette er brukt hvor:

| Komponent | Brukes til |
|---|---|
| `MdSelect` | Valg av fylke |
| `MdComboBox` | Valg av kommune. Søker i alle kommuner, og viser kommunene i valgt fylke når søkefeltet er tomt. |
| `MdAlertMessage` | Ingen kommuneplan (`warning`), og feil ved tegning og opplasting |
| `MdButton`, `MdIconButton` | Tegning og opplasting, vis i kartet, faktaark, slett, bytt kommune, til listen og fjern markering |
| `MdLink` (og stilen `md-link`) | Lenker i løpende tekst, og lenkene mellom sidene |
| `MdRadioGroup` | Om et tegnet område er utbygging eller ikke |
| `MdCheckbox`, `MdToggle` | Slør over det som ikke er kartlagt, smale striper og teknisk visning |
| `MdLoadingSpinner` | Mens kartet hentes |
| Ikoner | Tegn, last opp, sted, åpne i ny fane, slett og lukk |
| Chips (stilen `md-chip` og `md-chip--active`) | Sidevelgeren |

Det designsystemet ikke har, er laget selv med designsystemets variabler for farger, skrift og avstander: tabeller, stolpene som
viser fordeling, tegnforklaringer med fargeruter, og alt i kartet. Kartfargene for arealklasser og tema er data, ikke utforming,
og følger med som før.

### Fast mønster for utformingen

Reglene står også øverst i `src/grunnlag.css`. De bygger på designsystemets sider om farger, typografi og komponenter, og på
Miljødirektoratets profil og språkprofil.

- **Tekst, seks stiler.** Tre overskrifter med designsystemets klasser: sidetittelen (`md-typography-heading-l`, og `heading-xl`
  på bred skjerm), seksjoner (`heading-s`) og undertitler (`heading-xs`). Brødtekst 16 px, vanlig eller halvfet. Liten tekst
  14 px: grå for kilder, hjelpetekst og forklaringer, svart i tabeller, og halvfet for etiketter og kolonneoverskrifter
  (`md-typography-label-s`). Ingen andre størrelser.
- **Flater.** Siden er hvit, også rundt kartet. Hvite kort med tynn grå kant brukes bare for egne områder. Sjøgrønn er eneste aksentfarge, som profilen sier: én hovedfarge, og høyst én av de andre om
  gangen.
- **Meldinger.** Designsystemets meldingsbokser bare når noe mangler eller er galt: ingen kommuneplan, en fil som ikke kan
  leses. Annen informasjon står som vanlig tekst.
- **Linjer.** Én tynn grå linje mellom seksjoner, linjer i lister og rader i tabeller.
- **Handlinger.** Primærknapp bare for hovedvalget i et øyeblikk: «Ferdig» når man tegner, og «Bytt til …» etter trykk utenfor
  kommunen. Sekundærknapper (med ramme) for verktøyene: tegn, last opp og angre. Tertiærknapper (bare tekst) for alle
  handlinger i lister og kort: «Vis i kartet», «Faktaark» og «Slett». Vanlige lenker bare i løpende tekst.
- **Avstander.** Designsystemets trinn (4, 8, 12, 16, 24, 32 px). Mellom avsnitt i løpende tekst minst to ganger
  skriftstørrelsen, som designsystemet krever etter WCAG 2.1.
- **Tekst.** Språkprofilen: tall til og med tolv med bokstaver i løpende tekst, forkortelser skrevet ut første gang
  (Statistisk sentralbyrå (SSB)), desimalkomma, og mellomrom foran prosent. «Dekar» i setninger og «daa» i tabeller og lister.
- **Kartfarger.** Fargene i kartet er data og velges for å skille klassene, også ved fargeblindhet. Der profilen har en farge
  med samme rolle, brukes den: Oransje mørk for villrein, Sjøgrønn lys for grønt i bebygd område og Blå mørk for egne områder.
  Verneområder og verdsatt natur har egne farger, se `FARGER` i `src/motor/felles.js`.

Det designsystemet ikke har, er laget etter de samme reglene, med noen få byggeklosser som brukes overalt:

| Klasse | Hva det er | Brukes til |
|---|---|---|
| `talliste` | Liste med navn til venstre, tall til høyre, og forklaring og knapper under | Arealklassene, planlagt utbygging, tegnforklaringene og områdene i temaene |
| `talltabell` | Tabell med 14 px skrift og tynne linjer | Egne områder, regnskapsoppstillingen, klassene og kall-loggen |
| `kort` | Hvit boks med tynn grå kant | Hvert eget område, og samlet for kommunen |
| `navn` | Navn med fargerute foran. Ruten følger skriftstørrelsen. | Første kolonne i lister og tabeller |
| `tall` | Tall til høyre, som ikke deles over linjer | Tallene i lister og tabeller |

I tillegg kommer oppsettet med kart og tall i to kolonner, stolpene (`stripe`), fargerutene (`rute`) og alt i kartet.

Ting å vite:

- Designsystemet har ikke mørkt tema, så siden har det ikke lenger.
- To feil i designsystemet (md-css 6.32.0) rettes i `src/grunnlag.css`: variabelen `--md-typography-weight-semibold` brukes av
  etikettene, men er ikke definert, så den settes til 600. Noen knapper har ingen skrift og får nettleserens standardskrift, så
  knapper arver skriften.
- Sidevelgeren er en navigasjon med knapper i chip-form, ikke faner. Faner kan ikke deles i grupper med overskrift, og
  designsystemets `MdTabs` legger innholdet rett under knappene. Her skal kartet stå mellom knappene og innholdet, og «Til listen»
  i kartet må kunne bytte side. Valgt side er merket med `aria-current="page"`.
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
  tas samme dag. Ett kjent avvik som ikke skyldes koden: Miljødirektoratet sender lokalitetene i tilfeldig rekkefølge, så arealet
  av verdsatt natur per verdikategori kan skille med under én dekar mellom kjøringer, og når to lokaliteter har nøyaktig samme
  flate, kan planlagt utbygging havne på den ene eller den andre.
- `motortall.js` henter tallene fra motoren til regresjonstesten. Siden gjør motoren tilgjengelig som `window.motor` med
  `?teknisk`.
- `sjekk-regning.js` kontrollerer at sølv og gull holder seg for seg selv og at lagene bare bruker hverandre i riktig retning,
  og `sjekk-navn.js` at alle navn som brukes, er definert eller importert. `npm run sjekk` kjører begge.
- `oversiktsbilde.py` lager de lagrede oversiktsbildene, for eksempel `python3 verktoy/oversiktsbilde.py --fylke 50`.
  Én kommune koster 4 til 16 kall mot NIBIO.
- `testdata/testplan-bygg.geojson` er tolv planflater fra Trondheim, hentet fra DiBK, til test av opplasting.

`npm run formater` formaterer koden etter `.prettierrc.json`.

## Kilder

Grunnkart for arealanalyse og kart over grå arealer: NIBIO. Arealtall: SSB, tabell 09594. Kommuneplaner: DiBK.
Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grenser og bakgrunnskart: Kartverket.
