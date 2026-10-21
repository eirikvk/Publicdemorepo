# Kommunalt naturregnskap – teknologidemo

En nettside som viser arealet i en kommune delt i bebygd, jordbruk og natur, hva kommuneplanen setter av til utbygging, og hvordan
det treffer verneområder, villrein, verdsatt natur, inngrepsfri natur og grått areal. Alt hentes direkte fra åpne tjenester i
nettleseren. Det finnes ingen egen server.

Siden er laget i React med Miljødirektoratets designsystem (<https://design.miljodirektoratet.no>) og bygges med Vite. Legg til
`?teknisk` i adressen for å se utgave, måling og kall-logg.

Dette er en prototype til illustrasjon. Kartet og arealene som regnes ut i nettleseren, er omtrentlige. Grunnkartet fra
NIBIO er lisensiert «Norge digitalt begrenset».

## Kjøre siden

Krever Git og Node 22.18 eller nyere.

```
git clone https://github.com/eirikvk/Publicdemorepo.git
cd Publicdemorepo
npm ci
npm run dev        siden på http://localhost:5173, som lastes på nytt ved endringer
npm run bygg       bygger siden til dist/
```

Tvillingen fra Figma (se under) kjøres med `npm run dev-figma` og bygges med `npm run bygg-figma`, etter `npm run bygg`.

[KOM-I-GANG.md](KOM-I-GANG.md) har hele veien: krav, prøving på mobil, bygg, tester, verktøyene og feilsøking.

Innholdet i `dist/` er hele siden: én HTML-fil, ett skript, ett stilark, skriftfilene og de lagrede dataene. Det kan legges på en
hvilken som helst webserver, også i en undermappe, fordi alle adresser er relative.

## Slik henger koden sammen

Koden har to hoveddeler: `src/data/` er alt om dataene, og `src/ui/` er brukergrensesnittet. Data importerer aldri fra ui, og
bruker verken React eller OpenLayers. Dataene går gjennom tre lag, etter mønsteret bronse, sølv og gull fra moderne
dataplattformer, og datamotoren samordner dem:

```
Åpne tjenester: SSB, Kartverket, NIBIO, DiBK, Miljødirektoratet
      │
      ▼
src/data/
  katalog.ts    Katalogen: tabellene i bronse, sølv og gull, som katalog.lag.tabell.
  cache.ts      Cachen: svarene fra tabellene, så det som er hentet, ikke hentes på nytt.
  generelt/     Det som ikke handler om noe bestemt: flategeometri, summer, nærmeste
                farge og PNG. Alle lagene i data bruker det.
  bronse/       Bronse: hvordan hver tjeneste brukes. Adresser, parametre og stiler.
                Svarene kommer urørt tilbake. Alt nettverk går gjennom dette laget.
  solv/         Sølv: felles standard, så dataene fra flere kilder kan brukes sammen.
                UTM33, km², de tre klassene, kommunen og rutenettene.
  gull/         Gull: svarene. Arealer, andeler, kryssinger og regnskap, i den formen
                hver side trenger.
  motor/        Datamotoren: valgene (app), og hva som hentes og regnes når.
      │
      ▼  leser tilstanden, og kaller datamotoren når brukeren gjør noe
src/ui/
  komponenter/  React: sidene og delene rundt dem. Gjør gull om til tekst, lister,
                stolper og tabeller.
  kart/         OpenLayers: kartlagene, tegning i kartet og trykk i kartet.
```

Bronse, sølv og gull er ETL-koden: den henter, tolker og regner ut, men husker ingenting. Hver tabell i katalogen er en funksjon i
ETL-koden med samme navn, som henter det den bygger på fra katalogen og regner ut svaret. Svarene huskes i cachen. Regnefunksjonene
i sølv og gull bruker verken kartet, siden eller nettet, og kan kjøres i Node. Se «Katalogen og cachen» under.

React-komponentene og kartet er to likestilte deler av brukergrensesnittet, og fungerer på samme måte: de abonnerer på tilstanden,
tegner seg på nytt når den endres, og kaller datamotoren når brukeren gjør noe. Datamotoren vet ikke at de finnes.

Slik går en runde, for eksempel når brukeren velger kommune:

1. Brukeren velger Trondheim i `Topp.tsx`. Komponenten kaller `velgKommune` i `data/motor/kommune.ts`.
2. Datamotoren kaller alle tabellene i gull for kommunen, for eksempel `katalog.gull.inon('5001')`. Hver av dem kaller tabellene i
   sølv den bygger på, og de igjen tabellene i bronse, som henter fra kildene. Svarene huskes i cachen.
3. Hver gang noe er klart, sier cachen fra med `endret()`. React tegner da siden på nytt: hver komponent leser sin tabell i gull
   for valgt kommune, for eksempel `valgt(katalog.gull.inon)`, og viser svaret. Samtidig ser hvert kartlag etter om det det
   tegnes av, er nytt, og tegner seg på nytt hvis det er det. Grensen kommer for eksempel som koordinater fra
   `katalog.solv.grense`, og kartet lager sin egen geometri av dem.

Velger brukeren en side, kaller `Sidevelger.tsx` funksjonen `velgSide` i `ui/sider.ts`. Den husker siden i `ui.side`, og kartet
viser temaet til den siden. Adressen følger med, for eksempel `#5001/verdi`. Lenkene mellom sidene, som navnene på oversikten,
gjør det samme (`Sidelenke` i `deler.tsx`).

Komponentene endrer aldri tilstanden i datamotoren selv, og regner ikke selv. De viser det gull gir dem, og kaller datamotoren
når brukeren gjør noe.

Siden er bygd opp av disse delene. De fleste har en `.tsx`-fil og en `.css`-fil med samme navn i `src/ui/komponenter/`:

```
App              sideoppsettet: toppen, sidevelgeren, og kartet og innholdet i to kolonner
├─ Topp          navnet, valg av fylke og kommune, og kommunenavnet
├─ Sidevelger    én knapp per side, med temaene samlet under «Naturen i kommunen». Siden bestemmer innholdet og hva kartet viser.
├─ Kartpanel     kartet (fra ui/kart/) og linjen under det
└─ Innhold       den valgte siden:
   ├─ Oversikt   det viktigste fra hver side, med lenke til siden
   ├─ Regnskap   utbredelsesregnskapet: forklart med stolper, satt opp som regnskap, og land og vann
   ├─ Naturtema  én side per naturtema: villrein, verdsatt natur og verneområder
   ├─ Inon       inngrepsfri natur
   ├─ Graa       grått areal
   ├─ Framtid    utvikling fremover: planlagt utbygging, og
   │  └─ Egne    egne områder: tegning, opplasting og sammenligning
   └─ Om         om og metode, og tekniske valg
      └─ Katalog katalogen og cachen, i teknisk visning
         └─ Datavisning  innholdet i en rad: bilder, rutenett, tabeller og flater
```

Hver side bestemmer hva kartet viser: arealklassene og planlagt utbygging vises alltid, og temaet bare på sin egen side. Hvilke
sider som finnes, rekkefølgen og gruppene står i `SIDER` i `ui/sider.ts`.

Stilen kommer i tre lag, der hvert lag kan bygge på det forrige: designsystemets egen CSS (hentet i `main.tsx`), så
`grunnlag.css`, så filen til hver komponent.

## TypeScript

All koden er TypeScript med streng typesjekk. Typene beskriver hva som går inn og ut av hver del: for eksempel `Tilstand` for
datamotorens tilstand (`src/data/motor/tilstand.ts`), `Visning` for visningens (`src/ui/tilstand.ts`), typene for flater og
utsnitt i `src/data/generelt/geometri.ts`, og for flisnett og rutebilder i `src/data/solv/felles.ts`. Typene er bare beskrivelser: Vite fjerner dem når siden bygges, og Node fjerner
dem selv når verktøyene kjøres. Koden bruker derfor bare TypeScript som kan fjernes uten å endre noe (`erasableSyntaxOnly`), og
importer har filendelsen med (`./tilstand.ts`).

Der noe hentes, sier typen hvilken tilstand det er i. Inngrepsfri natur og grått areal er for eksempel enten under henting,
feilet, eller hentet med alle tallene (`Kommunebilde` i `src/data/gull/felles.ts`), og sidene får tallene som henter, feil, ingen
eller ok (`Bildetall`). Tallene finnes da bare der de kan brukes. Der en verdi kan mangle, sier typen det (`| null`). Der koden vet mer enn typene, står det et `!` (verdien finnes her) eller en
`as` (verdien har denne formen). Kartet har flest av dem, fordi typene i OpenLayers er videre enn det kartet faktisk bruker. I
bronse står `as` der et svar fra en tjeneste leses: typen sier hvilken form svaret skal ha. Testverktøyene bruker de samme typene
som siden, så en endring i tilstanden som testen ikke er rettet for, stopper i typesjekken.

## Filene

| Fil | Innhold |
|---|---|
| `index.html` | Inngangen. Bare et tomt element som React fyller. |
| `src/main.tsx` | Stilene fra designsystemet, skriften, kartets stil og den felles stilen, og oppstarten av React |
| `src/grunnlag.css` | Stilen som gjelder hele siden, og reglene for utformingen. Bruker designsystemets variabler. |
| `src/utgave.ts` | Utgaven av siden, som vises under teknisk informasjon |
| `tsconfig.json` | Typesjekken for `src`. `verktoy/tsconfig.json` gjelder verktøyene og `vite.config.ts`. |
| `src/data/` | Alt om dataene: bronse, sølv, gull og datamotoren. Uten React og OpenLayers. |
| `src/ui/` | Brukergrensesnittet: React-komponentene og kartet |
| `public/` | Filer som legges ut som de er: listen over kommuner, flaten til hver kommune (`kommuneareal.json`), dagens klasser lagret per blokk på 10 meter for noen kommuner (`klasser/` og `klasser.json`), detaljklassene per blokk på 10 meter for sju kommuner (`detaljklasser/` og `detaljklasser.json`), og kommunegrensen og kommunens andel per rute for de samme kommunene (`kommunegrenser/` og `kommunegrenser.json`) |
| `.github/workflows/legg-ut.yml` | Bygger og legger ut siden på GitHub Pages ved push til `main` |
| `.nvmrc` | Node-versjonen, for nvm og for arbeidsflyten |

### Data

Katalogen og cachen, i `src/data/`. Se «Katalogen og cachen» under.

| Fil | Innhold |
|---|---|
| `katalog.ts` | Katalogen: listen over tabellene i bronse, sølv og gull, som `katalog.lag.tabell`. Hver tabell er en ETL-funksjon med samme navn, og har et kort, lesbart navn (`tittel`), hva den er (`om`) og hvor mange kommuner som huskes. Tabellene bak tallene har også forklaringen, usikkerheten og kilden (`forklaring`, `usikkerhet`, `kilde`), og oppslag, lagrede svar og hjelpetabeller er merket som tekniske (`teknisk`). Kildene står samlet øverst (`KILDE`), med lisensen. Datasettene i sølv står i `DATASETT`, og tabellene som hører til et datasett, er merket med det (`datasett`), som dataene eller som støttedata (`stotte`), med innholdet i egne data (`innhold`). Til eksempelradene i katalogvisningen sier tabellen hva én rad er (`radform`), hva kolonnene er (`kolonner`) og hvilken verdi som betyr at en rute ikke har data (`tom`). |
| `avhengigheter.ts` | Hvilke tabeller i katalogen hver tabell bygger på, lest ut av koden. Laget av `verktoy/forklaringer.ts`, ikke rediger for hånd. |
| `kolonneinfo.ts` | Kolonnene i eksempelradene i katalogen: hva hver kolonne er, enheten og navnet på kodene (som 3 Natur og 01 Bebygd og opparbeidet areal), for tabellene der navnene ellers er kryptiske, og for tabellene med ruter hvilken verdi som betyr at ruta ikke har data (tom). Kodene hentes fra listene sidene bruker. |
| `cache.ts` | Cachen: svarene fra ETL-funksjonene, per tabell og kommune, med status (henter, feil, ok) og tid. Gjør kallene, deler kall som pågår, og glemmer det eldste, og alt som feilet når brukeren ber om et nytt forsøk (`glemFeilede`). Importerer ingenting. |

Generelt, i `src/data/generelt/`. Det som ikke vet noe om natur, kommuner eller kilder. Hver ting finnes bare her, så alle lagene
regner likt. Filene importerer ingenting.

| Fil | Innhold |
|---|---|
| `geometri.ts` | Flater og utsnitt: typene, arealet med fortegn og omløpsretning, utsnittet som rommer en flate, snitt og overlapp, oppslag av mange punkter i en flate, kantene i bånd for å se om kanten av en flate går gjennom et utsnitt, en flate klippet mot et rektangel, og et rutenett av punkter for å finne punktene i et utsnitt |
| `tall.ts` | Summen av en liste tall (`summen`) |
| `kopi.ts` | En egen kopi av et ferdig svar (`egenKopi`), som omvei rundt en feil i JavaScript-motoren. Se regel 7 under Prinsippene for dataflyten. |
| `farge.ts` | Hvilken av noen farger en farge ligger nærmest (`naermesteFarge`) |
| `png.ts` | PNG-filer: bitene i en fil, og et bilde med fargetabell (til de lagrede klassene) |
| `glissen.ts` | Glisne rutenett: et stort rutenett i blokker på 512 × 512 ruter, der bare blokkene som har noe, finnes. Leses rute for rute som et vanlig rutenett. Brukes av utbyggingen. |
| `dekning.ts` | Dekningsandel: hvor stor andel av hver rute flater dekker, med en skanlinje i egen kode (fire delrader per rad, eksakt bortover), vindingstall per lag for union, masker og kategorier, og andelen lagret som spenn per rad. Også den samme regelen for én og én rute. |

Bronse, i `src/data/bronse/`. Én fil per tjeneste, og felles filer for hvordan det hentes og for kartjenester etter WMS.

| Fil | Innhold |
|---|---|
| `henting.ts` | Henting, kall-loggen, hvor sidens egne filer ligger, og køen for kartbilder (høyst fire kall om gangen per kilde). Bakgrunnskartet har en egen kø som tallene ikke venter på. En feilmelding i XML i stedet for et bilde regnes som et kall som feilet, og for hver kilde står det om siste kall feilet (`feiletSist`). Husker ingenting: det gjør cachen. Sier fra om hva som skjer, uten å vite hvem som lytter. |
| `endepunkter.ts` | Endepunktene for alle kildene, samlet. Filene i bronse bygger kallene på dem, og katalogen viser dem ved hver kilde i infoknappene og METODE.md |
| `wms.ts` | Adressen til et kartbilde eller et oppslag fra en kartjeneste etter WMS 1.3.0, for et utsnitt i UTM33 eller ett punkt |
| `ssb.ts` | SSB, tabell 09594, med det eldre API-et som reserve: hver arealklasse for alle kommunene i 2017 og 2024, bare til de syntetiske tallene for naturregnskapet |
| `kartverket.ts` | Fylker og kommuner, kommunegrensene, oppslag av kommune i et punkt, og bakgrunnskartet |
| `nibio-grunnkart.ts` | Nasjonalt grunnkart for arealanalyse: kartbildene med de seks klassene i rene farger og med de 19 detaljklassene, per flis, de lagrede klassene og detaljklassene per blokk med registrene, og grunnkartet i ett punkt |
| `dibk-kommuneplan.ts` | Kommuneplanene hos DiBK: flatene for framtidig utbygging, en oversikt over hvor de ligger i kommunen, hvor mye av kommunen planen dekker, hvilken plan det er, og flatene i ett punkt |
| `mdir-naturtema.ts` | Miljødirektoratets verneområder, villreinområder, naturtyper med KU-verdi (med og uten fast verdi, i én henting) og det kartlagte området, side for side når det er flere flater enn tjenesten gir i ett svar, og alle feltene for ett område |
| `mdir-inon.ts` | Inngrepsfrie naturområder, som bilder per bit (2048 x 2048 ruter à 10,6 meter) og i ett punkt |
| `nibio-graa.ts` | Kart over grå arealer, som to bilder per bit (alt grått areal, og andel vegetasjon) og som de samme to bildene per flis til kartet zoomet inn |
| `planfil.ts` | En opplastet planfil, lest i nettleseren og gjort om til UTM33 |

Sølv, i `src/data/solv/`. Hver fil er én ting i felles standard, med kildene side om side. METODE.md forklarer metoden bak hver fil.

| Fil | Innhold |
|---|---|
| `felles.ts` | UTM33, flisnettet, rutenettene, alle terskler, målestokken i UTM (arealet av en flate i km² i terrenget), og datamodellen for planen per rute (`Planruter`) |
| `kommune.ts` | Kommunegrensen i UTM33 med utsnittet, dekningsandelen til flater i bitene (`andelsbiter`), kommunens flate i bitene (`solv.kommunebiter`), og et tema som hentes i biter talt i kommunen eller i et naturtema i den (`tellIKommune`, `tellIBitene`) |
| `grunnkart.ts` | Grunnkartet fra NIBIO, én felles sannhet per nivå, som ett datasett med to kolonner: klassen og detaljklassen per rute, i blokker på 10,6 meter (`solv.klasser`, laget av de to kartbildene eller lagret, kolonne for kolonne) og på finere nivåer av kartbildene der, den vanligste klassen og detaljklassen zoomet ut (`solv.klasserUt`), og blokkene i kommunen |
| `projeksjoner.ts` | Projeksjonene siden kjenner, og omregning til UTM33 |
| `raster.ts` | Lerretet: bildene leses inn, og kartet tegnes. Dekningen av flater regnes ikke her, men i `generelt/dekning.ts`. Tegneflatene brukes om igjen, én per størrelse. Den eneste filen i sølv og gull som bruker nettleseren, sammen med bakgrunnstråden. |
| `tolking.ts` | Tolkingen av kartbildene til verdier per rute for grått areal, inngrepsfri natur og kommuneplanen, uten katalogen, så den kan kjøres i bakgrunnstråden |
| `oppgaver.ts` | Det tunge bildearbeidet som oppgaver: pakke ut og tolke bildene, dekningsandelen til flater i bitene (kommunen og naturtemaene), og telle i kommunen |
| `arbeid.ts`, `arbeider.ts` | Bakgrunnstråden (Web Worker med OffscreenCanvas): oppgavene kjøres der, så siden ikke henger, og på siden når nettleseren ikke har den |
| `klasser.ts` | Bebygd, jordbruk og natur: koblingen til SSBs arealklasser og grunnkartets økosystemtyper, tolking av fargene i kartbildene, og dagens klasse per rute i en flis |
| `ssb.ts` | Tolkingen av SSBs arealstatistikk for alle kommunene: km² for hver arealklasse per år og kommune, til de syntetiske tallene |
| `naturregnskap.ts` | Datasettet «Syntetisk naturregnskap fra SSB»: SSBs to tabeller for naturregnskapet i SSBs form, med økosystemtypene i SSBs klassifisering (KLASS 988). Til SSB publiserer dem, lages de syntetisk her av arealtallene, se under |
| `kommuneplan.ts` | Kommuneplanen fra DiBK: planen per rute i en flis (`solv.kommuneplanruter`), hvor planen ligger i kommunen (`solv.planoversikt`), og om kommunen har plan og hvilken |
| `egne.ts` | Datasettet «Areal satt av til framtidig utbygging i egne planer» fra `bronse.egne`: hver plan per rute, én rad per plan (`solv.egneruter`), og som støttedata flatene tolket til utbygging eller ikke (`solv.egne`) og opplysningene om planene (`solv.egneinfo`) |
| `temaer.ts` | Verneområder, villrein, verdsatt natur og det kartlagte: flatene klippet mot kommunen (lokalitetene i verdsatt natur bare der kanten av kommunen går gjennom dem, og da mot den delen av kommunen som ligger rundt), temaet som andel per rute i bitene (`solv.vernAndel` og de andre, uten arealet, som regnes i gull), og flatene som oppslag for rutene i utbyggingen |
| `inon.ts` | Inngrepsfri natur: sone per rute, sonen per piksel i kartet på hvert nivå (`solv.inonsoner` og `solv.inonsonerUt`), og sonene i naturen |
| `graa.ts` | Grått areal: trinn per rute etter andel vegetasjon, trinnet per piksel i kartet på hvert nivå (`solv.graatrinn` og `solv.graatrinnUt`), og grønt i bebygd område |
| `nivaer.ts` | Én sannhet per nivå for temaene i biter: rutene i en bit lest for en flis på nivå 10 og finere, og halvregelen zoomet ut |
| `punkt.ts` | Oppslag i ett punkt, til detaljene ved trykk i kartet: grunnkartet, kommuneplanen og inngrepsfri natur i punktet, og alle feltene for et område i et naturtema, som felt og verdi. Inngår ikke i tallene. |
| `kodelister.ts` | Kodelister fra Geonorge og SOSI: arealformål, arealbruksstatus og eierform i kommuneplanen |

Gull, i `src/data/gull/`. Alt som setter kilder sammen, og det sidene viser, for én kommune. Funksjonene som heter `bygg`, `kryss`
eller `kombiner` noe, er rene utregninger som tabellene bruker.

| Fil | Innhold |
|---|---|
| `felles.ts` | Andel i prosent, areal fra antall ruter avrundet til nærmeste 10 dekar, landarealet (fra tabellen for naturregnskapet), og tilstanden for temaene som hentes i biter |
| `grunnkart.ts` | Dagens klasser for hele kommunen: alle blokkene lest, lagret eller hentet fra NIBIO når kommunen velges, og arealet per detaljklasse |
| `planflis.ts` | Planlagt utbygging per piksel i kartet, én sannhet per nivå: rutene i utbyggingen på nivå 10, finere nivåer i eller inntil feltene der, og zoomet ut innenfor dagens klasse i pikselen |
| `utbygging.ts` | Utbyggingen, midtpunktet: egne områder erstatter kommuneplanen der de ligger, og planen legges oppå dagens klasser i ruter på 10,6 meter, med smale striper tatt bort. Én rad per rute med planlagt utbygging i den nye eller den gamle planen. Rutenettene er glisne: planen har bare blokkene med planlagt utbygging. Utvalgene (`Utvalg`) sier hvilke ruter en analyse regnes over: den nye planen eller den gamle (kommuneplanen alene), i hele kommunen eller i ett eget område. Nøkkelen er utvalget, som `5001`, `5001/gammel` eller `5001/ny/1`. Hvert utvalg slås opp én gang (`gull.utvalg`), med raden og verdien for hver rute, så analysene slipper. Kommuneplanen alene ryddes for smale striper én gang så lenge blokkene med planen er de samme (`gull.planAlene`). |
| `naturregnskap.ts` | SSBs tabeller for naturregnskapet fra sølv, lest med hovedøkosystemene i grunnkartet: arealet per hovedøkosystem i 2024 og endringen mellom bebygd og landklassene 2017–2024, for kommunen og for alle kommunene i Norge. Av dem det sidene viser, de samme tabellene for hovedsiden og tvillingen: natur, jordbruk og bebygd nå og endringen fra 2017, regnskapet per hovedøkosystem med summene per klasse, og land og vann. Og nedbyggingen og sammenligningen med Norge, som bare tvillingen viser. Merket syntetisk så lenge tallene i sølv er det. |
| `okosystemer.ts` | Grunnkartets økosystemtyper: skog, våtmark, naturen i verneområdene og planlagt utbygging per økosystemtype, av arealet per detaljklasse. Brukes av tvillingen og i sammenligningen for egne områder. |
| `planlagt.ts` | Natur og jordbruk som planen setter av, med andeler, for et utvalg, kortversjonen til oversikten, og planlagt utbygging per detaljklasse |
| `egne.ts` | Hva som ligger i hvert eget område, og radene som sammenligner den gamle planen med den nye, for hele kommunen og hvert område. Analysene er de samme som for kommuneplanen, regnet for hvert utvalg; her settes bare radene og forskjellen sammen. |
| `temaer.ts` | Naturtemaene: arealet av hvert tema (`gull.vernAreal` og de andre), temaet (områdene, arealet og andelen), kartleggingen av verdsatt natur og kryssingen med det kartlagte, oppslagene til kryssingen med utbyggingen (`gull.naturoppslag`), kolonnene for hvert tema i utbyggingen (andelen av hver rute i temaet og i hvert område), summene over dem, og planlagt utbygging utenfor det kartlagte. Når egne områder endres, regnes kolonnene bare ut for rutene som er nye (`gull.temaminne` og `gull.radorden`). |
| `inon.ts` | Tallene på siden |
| `graa.ts` | Arealet per trinn, og kryssingen med utbyggingen |

Datamotoren, i `src/data/motor/`.

| Fil | Innhold |
|---|---|
| `valgt.ts` | Valgt kommune, og en tabell lest for den: `valgt(katalog.gull.inon)` gir raden i cachen, og ber om den hvis den mangler |
| `tilstand.ts` | Tilstanden som gjelder nå (`app`): valgene og det tekniske. Lageret som sier fra når noe er endret (`endret`, `abonner`), og tidtakingen. |
| `kommune.ts` | Listen over kommuner, valg av kommune, og det som bes om med en gang: alle tabellene i gull for kommunen |
| `kartverdier.ts` | Hva hver piksel i en kartflis er, fra sølv og gull på nivået flisen er på: dagens klasser, detaljklassene, grått areal, inngrepsfri natur og planlagt utbygging. Begge sidene tegner kartlagene av dette, og trykk i kartet slår opp i det samme (`verdiIPunkt`). |
| `grunnkart.ts` | Om kommunen har lagrede klasser, og hvor langt hentingen av blokkene fra NIBIO er kommet |
| `plan.ts` | Det siden og kartet trenger å vite om utbyggingen: om kommunen har plan, utbyggingen for valgt kommune, og hvor langt den er kommet. Om siste kall til DiBK feilet (`dibkFeilet`), og et nytt forsøk (`provPlanIgjen`). |
| `egne.ts` | Egne områder, tegnede og opplastede: en kilde fra brukeren, som legges slik brukeren laget dem i `bronse.egne` |

### Brukergrensesnittet

Felles, i `src/ui/`:

| Fil | Innhold |
|---|---|
| `tilstand.ts` | Det som bare gjelder visningen (`ui`): valgt side, hva som er slått på i kartet, og hva kartet sier om seg selv |
| `sider.ts` | Sidene, valg av side, adressen (`#kommune/side`), og oppstarten. Hvert nytt valg av side eller kommune legges i nettleserens historikk, så Tilbake og Frem virker, og en adresse som skrives inn eller lenkes til, velger kommunen og siden. |
| `farger.ts` | Fargene i kartet og i tegnforklaringene |
| `tekst.ts` | Hvordan tall og tekst skrives: dekar, prosent, endring med fortegn, tall med bokstaver og oppramsing |
| `tvilling.ts` | Lenkene mellom hovedsiden og tvillingen fra Figma: hvilken side i den ene som svarer til en side i den andre, så lenken i linjen øverst åpner samme kommune og tema |
| `eksempelrader.ts` | Eksempelradene i katalogen: noen rader fra en verdi i cachen, spredt jevnt over alle, som tabell med kolonner, typer og hvor mange rader som har verdi. Hva én rad er, sier tabellen selv (`radform`: ruter, andeler, kommuner, JSON-stat, eller en liste i en liste). Uten radform er radene listen, den lengste listen i svaret, eller hele svaret som én rad. Rene funksjoner, testet i `test/eksempelrader.test.ts`. |
| `egnetekster.ts` | Tekstene om egne områder, som hovedsiden og tvillingen viser likt: meldingen om tegning og opplasting, hva en opplastet plan inneholder, hva som ligger i et område i dag, når et område er for smalt, og hvorfor planlagt utbygging ikke kunne regnes ut (`planFeil`) |
| `forklaringer.ts` | Forklaringene bak tallene: hvert kort med spørsmålet, kort fortalt, tabellene i gull det viser (og andre det forklarer) og regnestykket for valgt kommune, og stegene fra kilde til tall. Et steg et annet kort forklarer, blir en henvisning dit. I infoknappene står hver kilde i bronse sammen med sølvtabellene som justerer den (`infostegFor`): «hentes … justeres …». Brukes av infoknappene og av `verktoy/forklaringer.ts`. |
| `teknisk.ts` | Formen på `window.motor`: det siden gjør tilgjengelig med `?teknisk`, til feilsøking og regresjonstesten |

Kartet, i `src/ui/kart/`. Hvert kartlag har sin fil og følger tilstanden selv.

| Fil | Innhold |
|---|---|
| `ol.ts` | Delene av OpenLayers som brukes, samlet som `ol` |
| `felles.ts` | Flisnettet, hva kartet holder på med, hjelpere for lag som tegnes i nettleseren, og kildene hvert lag krediterer (`KILDER`) |
| `kart.ts` | Selve kartet: bakgrunn, grense og status, hvordan lagene settes sammen, og kartets minne til katalogen |
| `klipping.ts` | Klipping mot kommunen: utenfor valgt kommune vises bare bakgrunnskartet |
| `trykk.ts` | Trykk i kartet: hva som er i punktet, fra datamotoren på nivået kartet viser, prikken og omrisset av flatene i punktet, og bytte til kommunen man trykket i |
| `punktinfo.ts` | Detaljene for punktet man trykket på, gruppert per kartlag, som et oppslag i et vanlig GIS: det som alt er hentet, og det som slås opp hos kildene når detaljene vises |
| `feltnavn.ts` | Lesbare navn på feltene fra kildene i detaljene, og hvilke felt som bare vises med kildenes egne navn |
| `maaling.ts` | Måling av hvor jevnt kartet går, til teknisk visning |
| `verdilag.ts` | Tegnemotoren for lagene som tegnes piksel for piksel av datamotoren (`kartverdier.ts`), brukt av begge sidene: laget gir bare verdiene farger, uten utjevning |
| `grunnkart.ts` | Dagens klasser i kartet, tegnet av sølv på nivået kartet viser, så alle kartlagene er enige om hver piksel |
| `plan.ts` | Planlagt utbygging: fargene, med styrken zoomet ut, og når laget vises |
| `naturtema.ts` | Verneområder og villrein med skravur (områdene er ofte store, og små områder vises som ring), verdsatt natur fylt, sløret over det som ikke er kartlagt, og markering av ett område |
| `inon.ts` | Inngrepsfri natur: fargene for sonene, og når laget vises |
| `graa.ts` | Grått areal: fargene for trinnene og grønt i bebygd område, og når laget vises |
| `egne.ts` | Egne områder: tegning i kartet og omrissene |

React-komponentene, i `src/ui/komponenter/`. De fleste har en CSS-fil med samme navn, for eksempel `Oversikt.css` ved siden av
`Oversikt.tsx`. Temasidene deler `Temaside.css`.

| Fil | Innhold |
|---|---|
| `App.tsx` | Hele siden, og valget av teknisk visning |
| `Topp.tsx` | Valg av fylke og kommune, overskriften, og linjen øverst med lenke til tvillingen fra Figma |
| `Sidevelger.tsx` | Knappene for sidene, over kart og innhold, i grupper |
| `Kartpanel.tsx` | Kartet med merkelappene oppå, og linjen under kartet |
| `Punktdetaljer.tsx` | Detaljene for punktet under kartet, og knappen som slår dem på og av |
| `Tegnforklaring.tsx` | Tegnforklaringen i kartet: fargene som vises nå, ut fra hvilke kartlag som er synlige. Kan lukkes. |
| `Innhold.tsx` | Den valgte siden. Alle sidene ligger i siden, men bare den valgte vises. |
| `Oversikt.tsx` | Det viktigste fra hver side: navnet som lenke, ett tall og en kort forklaring |
| `Regnskap.tsx` | Utbredelsesregnskapet: natur nå, forskjellen fra 2017 som stolper, regnskapsoppstillingen, og land og vann |
| `Tallforklaring.tsx` | Overskriften på et kort med infoknappen, og panelet under. `MedForklaring` setter infoknappen for ett tall ved siden av avsnittet eller overskriften der tallet står, for kort med én infoboks per tall |
| `Infoknapp.tsx` | Infoknappen og panelet den åpner: kort fortalt, regnestykket for kommunen, stegene fra kilde til tall (hver kilde med det den justeres til), usikkerheten og lenker til metoden og koden. Et kort med tall (`tall` i kortet, foreløpig bare verdsatt natur) har ingen infoboks for hele kortet, men én per tall, der tallet står på siden. Hver av dem står på egne bein: kort fortalt og regnestykket for tallet, stegene fra kilde til det tallet (`linjeFor`) og usikkerheten. Kildene står først, med kildens egen beskrivelse og detaljene bak en knapp, så stegene i gull, der støttedataene står under steget som bruker dem. Ingen infobokser inni hverandre, og ingen henvisninger. Brukes også av tvillingen. |
| `Temaside.tsx` | Toppen og rammen som alle temasidene har: navnet, arealet i kommunen, andelen av landarealet og kilden |
| `Naturtema.tsx` | Sidene for verneområder, villrein og verdsatt natur, med lister over områdene, og ordene sidene bruker om hvert tema |
| `Inon.tsx` | Siden for inngrepsfri natur |
| `Graa.tsx` | Siden for grått areal |
| `Framtid.tsx` | Utvikling fremover: planlagt utbygging og egne områder. Kan planlagt utbygging ikke regnes ut, sier en melding hvorfor (DiBK eller kartene), med knappen «Prøv igjen». |
| `Egne.tsx` | Egne områder og opplastet plan, med tabellene som sammenligner den gamle planen med den nye: natur og jordbruk, grått areal, temaene, verdsatt natur, områder som berøres og økosystemtypene |
| `Om.tsx` | Om og metode: kall-loggen og katalogen, hvordan klassene er satt sammen, om siden og tekniske valg |
| `Katalog.tsx` | Katalogen i teknisk visning: bronse, sølv og gull som trekkspill. I bronse og sølv står tabellene gruppert etter ETL-filen, der dataene i et datasett står som én rad og støttedataene bak knappen «Støttedata». Gull står etter kortene som viser tallene, med mellomregningene og hurtigminnet som støttedata bak knappen. Hver tabell står med tittelen og «Info» (hva tabellen er, kilden med kildens egen beskrivelse, hvor den hentes fra og hvordan den lages, hva den bygger på, usikkerheten, det tekniske navnet og hvor ETL-funksjonen ligger: det samme som infoboksene bygger på) og «Data» (radene i cachen, som kan åpnes for å se verdien) |
| `Datavisning.tsx` | Innholdet i en rad i cachen, etter formen det har (med eksempelrader står bare bildene, rutenettene og flatene her): bilder fra kildene slik de kom, rutenett som bilde med én farge per verdi, lister som tabell, flater som omriss, og de enkle feltene. Formen finnes ut fra dataene, uten oppsett per tabell. |
| `deler.tsx` | Det designsystemet ikke har: fargeruter, stolper, tegnforklaringer, linjer i en liste med tall, lenker mellom sidene og tabeller med tall |
| `illustrasjoner.tsx` | Tegningene til temaene og de blå båndene, i stedet for bildene i skissene: flate landskap i samme stil, laget med KI og merket med det |
| `md.ts` | Komponentene fra designsystemet som siden bruker |
| `lager.ts` | Kroken som kobler komponentene til tilstanden |

## Tvillingen fra Figma

En egen side med utseendet og navigeringen fra Figma-skissene for naturregnskapet, drevet av den samme datamotoren. Den ligger på
`…/figma/` ved siden av hovedsiden, med samme adresser i hash: `#5001` (oversikten), `#5001/naturtapet`, `#5001/utforsk`,
`#5001/utforsk/skog`, `#5001/kart` og `#5001/hjelp`. Den skal la oss prøve den overordnede navigeringen og enkeltsidene fra skissene
med ekte tall, uten å endre hovedsiden. Begge sidene har en smal linje øverst med lenke til den andre, for samme kommune og samme
tema der det finnes (`src/ui/tvilling.ts`): Utvikling fremover og Naturtapet, temasidene på hovedsiden og temasidene under
«Utforsk naturen» (grått areal er bynatur), og Om og metode og Hjelp. Resten går til oversikten.

- Kildekoden ligger i `srcFigma/`, og bygges for seg med `vite.figma.config.ts` til `dist/figma/`. Arbeidsflyten bygger den etter
  hovedsiden, så hovedsidens bygg er det samme som uten den.
- `srcFigma/` kan bruke kode fra `src/`, men `src/` bruker aldri `srcFigma/`. Fra `src/` bruker den datamotoren (`src/data`), kartet
  (`src/ui/kart`) og noen små fellesfiler (tekst, farger, designsystemet, kroken som tegner siden på nytt, infoknappen med
  kortene den forklarer, og tekstene om egne områder i `src/ui/egnetekster.ts`). Hovedsidens sider og adresse
  (`src/ui/sider.ts`) bruker den ikke.
- Tvillingen er bare brukergrensesnitt. All data og all metode ligger i datamotoren, som én sannhet for begge sidene: tallene leses
  ferdige fra gull gjennom katalogen, og `srcFigma/tall.ts` slår dem bare opp. Hva som regnes som skog, våtmark og land i
  grunnkartet, står i `src/data/solv/klasser.ts`. `verktoy/sjekk-lag.ts` passer på at tvillingen
  - ikke bruker bronse-filene eller regnehjelperne i `data/generelt/`,
  - bare bruker typer fra gull, ikke funksjonene,
  - og fra bronse i katalogen bare kartbildene (tabeller som slutter på «flis»), slik kartet i hovedsiden gjør.
- Kartet er det samme som i hovedsiden. Hvilket tema det viser, følger siden, som i hovedsiden (`ui.side`). Lagene bare tvillingen
  har (`srcFigma/kartlag.ts`), tegnes av sølv (`solv.blokker`, detaljklassene i `solv.klasser` og `solv.graabit`), flatene i gull
  (`gull.verneformer` og `gull.verdsattVurderes`) og kartbildene fra bronse.
- Noen tabeller bruker foreløpig bare tvillingen, og hovedsiden henter dem ikke:
  - Grunnkartet med detaljklassene (`gull/okosystemer.ts`): skog (`gull.skog`), våtmark (`gull.vatmark`), naturen i
    verneområdene (`gull.vernetNatur`) og planlagt utbygging per økosystemtype (`gull.planPerOkosystem`). De bygger på arealet
    per detaljklasse (`gull.detaljareal`, `gull.detaljerIVerneomrader` og `gull.planlagtPerDetaljklasse`). Detaljklassene er lagret
    for Trondheim, Kautokeino, Malvik, Røros, Stavanger, Sandnes og Bodø, og hentes fra NIBIO for de andre kommunene. Tabellene regnes etter
    behov (`etterBehov`), så hovedsiden henter dem bare til sammenligningen for egne områder (`gull.egneOkosystemer`), se
    METODE.md, Arealklassene.
  - SSBs tabeller for naturregnskapet (`gull/naturregnskap.ts`), foreløpig syntetiske i sølv: arealet per hovedøkosystem i 2024
    (`gull.okosystemfordeling`) og endringen mellom bebygd og landklassene 2017–2024 (`gull.bebygdEndring`), og det tvillingen
    viser av dem: natur, jordbruk og bebygd nå og endringen (`gull.utbredelse`, den samme som på hovedsiden), nedbyggingen per
    landklasse (`gull.nedbygging`) og regnskapet per hovedøkosystem (`gull.okosystemregnskap`, også den på hovedsiden). De samme for alle kommunene (`gull.okosystemerNorge`) gir
    sammenligningen med Norge (`gull.sammenligning`). De to regnes først når tvillingen ber om dem (`etterBehov`), så hovedsiden
    henter dem ikke. Se METODE.md, SSB-tallene.
  - Naturtemaene (`gull/temaer.ts`, `gull/grunnkart.ts` og `gull/inon.ts`): vernet areal per gruppe av verneformer, på land og i sjø, med det som er telt i flere verneformer for seg (`gull.vernLandSjo`, etter behov), villreinområdene med
    andelen (`gull.villreinPerOmrade`), verdsatt natur per naturtype (`gull.verdsattPerNaturtype`) og inngrepsfri natur i
    villreinområdene (`gull.inonIVillrein`), også over tid (`gull.inonIVillreinUtvikling`, etter behov). Og det som var merket «Kan regnes ut»: verdsatt natur som vurderes per lokalitet eller
    per naturtype (`gull.verdsattVurderes`), verneområdene med gruppen for verneformen (`gull.verneformer`), grått areal i
    villreinområdene (`gull.graaIVillrein`) og grønne arealer i bebyggelse (`gull.gronneArealer`). Se METODE.md, loggen for 18.
    oktober 2026.
- Sidens egne filer (`kommuner.json`, `klasser/` og `detaljklasser/`) ligger hos hovedsiden. Tvillingen sier hvor med
  `<meta name="egne-filer" content="../">`, som bronse leser (`src/data/bronse/henting.ts`).
- Utseendet følger skissene fra 17. oktober 2026 så nær som mulig: bredden (1200 px), toppen, kortene, båndene, radene som kan
  åpnes, figurene og flisene, med fargene målt i skissene. Skissene ligger ikke i repoet. Tallene er de samme som før.
- Der designsystemet har en regel, følger tvillingen designsystemet, også der skissene er annerledes: overskriftene
  (`md-typography-heading-xl` til `-s`, vanlig vekt), luften i trekkspillene, sidevelgeren i tabellene, ikonene i zoomknappene,
  tittelstørrelsen i flisene og lenkene med pil, som er designsystemets lenke med strek under. Avvik i skissene fra
  designsystemet er innspill til skissene.
- Tvillingen er et verktøy for å jobbe med designerne, så den har ikke egne tillegg som ikke er i skissene (avklart 18. oktober):
  temasidene har bare kartlagene, lenkene og boksene skissene har, figurene har fast rekkefølge og viser også det som er tomt, og
  arealer står i hele dekar. Fargene for verdsatte naturtyper, inngrepsfri natur, villrein, tresatt myr og grått areal på
  villreinsiden er skissenes (`srcFigma/farger.ts`), med prikker der skissene har det, også i kartet. Svarene under «Ofte stilte
  spørsmål» er skrevet med KI fra offentlige kilder og merket «KI-generert plassholdertekst», fordi skissene ikke har svar.
  Siden om verneområder har to kart, som skissene: verneformene øverst og naturen i verneområdene lenger ned. Dekningskartet
  for verdsatte naturtyper viser det som er kartlagt med lilla prikker, som skissene, der hovedsiden har slør over det som ikke er
  kartlagt.
  Bynaturen er ikke tegnet, så den er som før.
- Det skissene viser som datamotoren ikke har ennå, står tomt: felt som krever en dataplattform har et tomt merke (–), og figurer
  og felt som mangler kilde eller ikke er laget, har en stiplet flate med det som trengs. Det blå feltet om hva naturen ble bygget
  ned til (som utgår), viser kommuneplanen i stedet. Listene over områdene er beholdt.
- Naturtapet og «Utforsk i kart» er ikke tegnet i skissene. De er satt sammen av delene fra de tegnede sidene, og merket øverst
  med at oppsettet og teksten er et KI-generert forslag:
  - Naturtapet følger malen for temasidene: toppen med ikon, ingress, trekkspill og en egen illustrasjon, tallkortene, kartet med
    planlagt utbygging, figurene (hva slags natur planen setter av, og hvor mye som ligger i verdifull natur), grått areal som
    fremhevet melding, et blått bånd som leder over til det som ble bygget ned fra 2017 til 2024, regnskapet fra SSB, en tom figur
    for målt naturtap, ofte stilte spørsmål, ressurser og flisene til temaene.
  - «Utforsk i kart» har ett stort kart med temaene fra «Utforsk naturen», valgt med designsystemets filterbrikker over kartet.
    Hvert tema har de samme kartlagene som temasiden (`srcFigma/temalag.ts`), og planlagt utbygging kan slås på i alle. Under
    lagene står tallene for temaet og lenken til temasiden. Temaet står i adressen (`#5001/kart/skog`), så et kart kan deles.
  - Egne analyser på Naturtapet (`srcFigma/komponenter/Egne.tsx`, lagt til etter ønske 19. oktober 2026, også det et forslag):
    ved kartet kan man tegne et område eller laste opp en plan, også ved å slippe filen i kartet. Da er tallene på siden regnet
    med området i stedet for kommuneplanen der det ligger, med de samme analysene som for kommuneplanen (`gull.egneRader` og
    `gull.egneOkosystemer`), og siden viser begge: endringen under tallkortene, hule og fylte stolper i figurene, grått areal i
    begge, et kort per område med de viktigste tallene og alle tallene i en tabell, og alle tallene for kommunen. Områdene har
    nummer, som i kartet. De andre sidene har en linje under toppen når egne områder er med i tallene. Tekstene er de samme som
    på hovedsiden. Egne analyser kan skrus av i `srcFigma/flagg.ts`.
- Bildene fra skissene er ikke med, fordi rettighetene ikke er avklart, og heller ikke logoen eller skriften Sofia Pro (Open Sans
  står i stedet). Temaene og de blå båndene har i stedet en enkel illustrasjon hver, laget med KI og merket «KI-generert»
  (`srcFigma/illustrasjoner.tsx`).
- Tallkortene og figurene har et spørsmålstegn med forklaringen bak tallene, den samme infoknappen og det samme panelet som
  hovedsiden (`src/ui/komponenter/Infoknapp.tsx`). Der tvillingen viser de samme tallene som hovedsiden, viser den kortet derfra.
  Tallene bare tvillingen har, har egne kort i `src/ui/forklaringer.ts` (gruppen `tvilling`), med eget kapittel i METODE.md. Et
  steg et annet kort forklarer, lenker til kapitlet i METODE.md. Hvert spørsmålstegn kan skrus av og på i `srcFigma/flagg.ts`, og
  alle på en gang med `sporsmalstegn`.
- `npm run roykt-figma` åpner hver side i en mobilnettleser og sjekker overskrift, bredde, feil og Tilbake, og laster opp
  testplanen på Naturtapet og sletter den igjen (`verktoy/figma-roykt.ts`).

| Fil i `srcFigma/` | Innhold |
|---|---|
| `index.html`, `main.tsx` | Inngangen: stilene og siden |
| `App.tsx` | Hele siden: toppen, siden for adressen og bunnen |
| `navigasjon.ts` | Hovedsidene i menyen, adressen, Tilbake og Frem, og oppstarten |
| `temaer.ts` | Temasidene under «Utforsk naturen», i gruppene fra Figma |
| `tall.ts` | Tallene sidene viser, slått opp ferdige i gull, med tilstanden (henter, feil, ingen, mangler eller ok) |
| `kart2.ts` | Kart nummer to, med naturen i verneområdene, som skissene har som eget kart. Det deler data og kilder med hovedkartet og settes inn først når det er rullet fram. |
| `farger.ts`, `tekst.ts` | Fargene fra skissene, byttet i tvillingens kopi av fargetabellen før noe tegnes, og tallene som tekst med hele dekar |
| `kartlag.ts` | Kartlag bare tvillingen har: skogtyper, tresatt myr og tresatt innmarksbeite fra detaljklassene, verneområdene per verneform, naturen i verneområdene, verdsatt natur som vurderes, og grått areal og grønne arealer i bebyggelse. Lagene av grunnkartet og grått areal bruker den samme datamotoren og tegnemotoren som hovedsiden (`kartverdier.ts` og `verdilag.ts`), og bestemmer bare fargene. |
| `md.ts` | Designsystemets komponenter, og ikonene tvillingen trenger i tillegg |
| `flagg.ts` | Funksjonsflagg: egne analyser på Naturtapet, og spørsmålstegnene ved tallene, alle på en gang og hvert for seg |
| `komponenter/` | Toppen med meny og kommunevelger, kartet med lagvelger, tabellen med sider, egne analyser (`Egne.tsx`), og delene sidene er bygd av (også stolpene, stolpene i par for to planer, kakediagrammet og ikonene for temaene) |
| `temalag.ts` | Kartlagene for hvert tema, som temasidene og «Utforsk i kart» bruker, og fargene for hovedøkosystemene |
| `sider/` | Hovedsidene, temasidene, Naturtapet og «Utforsk i kart» |
| `stil.css` | Grunnlaget og delene. Toppen og kartet har egne stilark. |

## Testsiden for GeoParquet

En egen side på `parquet/` (kildekoden i `srcParquet/`, bygget med `npm run bygg-parquet` og `vite.parquet.config.ts`) prøver å
spørre direkte i en GeoParquet-fil på nettet uten å laste den ned: verneområdene i Norge fra Miljødirektoratet (rundt 33 MB,
nesten alt er flatene).

- Filen ligger i den offentlige bøtta [eirikvk/naturdata](https://huggingface.co/buckets/eirikvk/naturdata) på Hugging Face
  (Storage Buckets), som `miljodirektoratet/naturvernomrader.parquet`. Bøtta har en README om kilde, lisens og hvordan filen er
  laget, og skriptet som laget den (`miljodirektoratet/skriv.py`, med pyarrow).
- Innholdet er det samme som i testfilen den er laget fra (3512 rader, alle kolonnene). Filen er skrevet for spørringer over
  nettet: sortert etter kommune og navn, én radgruppe med små sider (høyst 64 rader og rundt 32 KB) og sideindeks, ordbok bare for
  kolonner med få ulike verdier, og ingen ordbok og ingen statistikk for flatene. GeoParquet 1.1, WKB og EPSG:25833 som før.
- Man velger en kommune, og siden viser verneområdene som ligger helt eller delvis i den: navn med lenke til faktaarket, verneform,
  vernedato og kommunene. Med «Hent flatene» hentes og tegnes flatene for de samme radene.
- Spørringen går i tre steg. Først beskrivelsen av filen og sideindeksen i ett kall (de siste 64 kB), og kommunekolonnen for alle
  radene. Så tekstkolonnene for bare radene i kommunen. Til slutt flatene for de radene. Sideindeksen sier hvilke sider radene
  ligger i, så bare de sidene hentes.
- Målt i Chromium 21. oktober 2026: Trondheim (14 verneområder) kostet 74 kB i 8 kall for radene, med det som hentes første gang,
  og 96 kB i 1 kall for flatene. Til sammen 170 kB av 33 MB. Kautokeino etterpå kostet 1 kB for radene og 72 kB for flatene. Med
  testfilen slik den var, uten sideindeks, måtte hele kolonnen med flatene (rundt 33 MB) hentes for å få flatene for én kommune.
- Hugging Face sender videre til en adresse i sitt CDN som gjelder i en time. Siden bruker den adressen direkte etter første kall,
  og går tilbake til den faste adressen hvis den ikke svarer. CDN-et svarer med bare biten det spørres om (206) og tillater at
  andre sider leser filen (CORS).
- Lesingen gjøres av [hyparquet](https://github.com/hyparam/hyparquet) (MIT). Siden ber alltid om en bestemt bit (bytes=a-b),
  aldri «de siste n». Svarer tjenesten med hele filen, stoppes hentingen.
- Det som er hentet, huskes mens siden er åpen, også biter inni større biter, så ingenting hentes to ganger. Ingenting lagres i
  nettleseren.
- Siden står utenfor datamotoren og lagene i bronse, sølv og gull: den spør selv i én fil. Fra `src/` bruker den bare designsystemet,
  tekstene for tall, kartfargene og grunnlaget for stilen, og `src/` bruker den aldri (sjekkes av `verktoy/sjekk-lag.ts`). Skal
  filen brukes i hovedsiden, bør den inn som en tabell i bronse.

## Dokumentasjon

- [KOM-I-GANG.md](KOM-I-GANG.md) viser hvordan man kjører, bygger og tester siden lokalt.
- [METODE.md](METODE.md) forklarer hver analyse med samme oppsett (spørsmål, data inn, steg, resultat, usikkerhet, kontroll og
  kode), i samme inndeling som `src/data/`. Den er en sammenstilling: de generelle delene skrives for hånd, og kapitlene om tallene
  på kortene lages av katalogen og kortene. Kontrollene skrives for hånd under hvert kapittel. Katalogen og kortene har ansvaret for sin egen forklaring:
  tabellene i katalogen har forklaringen, usikkerheten og kilden, kortene i `src/ui/forklaringer.ts` har spørsmålet, kort fortalt
  og regnestykket, og hvilke tabeller hver tabell bygger på, leses ut av koden. Infoknappene på kortene viser det samme.
- [AVHENGIGHETER.md](AVHENGIGHETER.md) lister biblioteker, tjenester og verktøy, med lisenser og det som gjelder sikkerhet og
  personvern.

Begge må oppdateres når en metode, en kilde eller et bibliotek endres.

## Katalogen og cachen

Datapipelinen er organisert som kall mot en katalog, slik Unity Catalog i Databricks har `katalog.skjema.tabell`. Katalogen
(`src/data/katalog.ts`) er listen over ETL-funksjonene i bronse, sølv og gull, som tabeller: `katalog.bronse.inonbit`,
`katalog.solv.inonbit` og `katalog.gull.inon`. Man kaller en tabell med nøkkelen, som regel kommunenummeret. Hver tabell er en
ETL-funksjon med samme navn, og funksjonen henter selv det den bygger på fra katalogen:

```ts
/* gull/inon.ts: tallene på siden om inngrepsfri natur */
export async function inon(nr: string): Promise<Inontall> {
  const [A, land] = await Promise.all([katalog.gull.inonAreal(nr), landareal(nr)]);
  return { ...byggInon({ nr, tilstand: 'ok', soner: A.km2, sum: A.sum }, land), sum: A.sum, soner: A.km2 };
}

/* gull/inon.ts: arealet per sone i kommunen for et år: rutene talt bit for bit, og antall ganger arealet av en rute */
export async function inonAreal(n: string): Promise<InonAreal> {
  const [nr, aar] = lesInonNokkel(n),
    S = await tellIKommune(nr, 3, tc => katalog.solv.inonbit([aar, tc]).then(D => D.sone), /* … */);
  return { aar, ...arealFraRuter(S.n, S.res, S.skala) };
}

/* solv/inon.ts: sonen per rute i en bit for et år */
export async function inonbit([aar, tc]: [number, Flis]): Promise<Inonsoner> {
  return { ...bitRuter(tc), sone: await arbeid({ type: 'inon', P: await katalog.bronse.inonbit([aar, tc]) }) };
}
```

Katalogen vet ikke hvor dataene kommer fra. Det ser man i ETL-funksjonen: `gull.inon` kaller `gull.inonAreal`, som kaller
`solv.inonbit` for hver bit og år, som kaller `bronse.inonbit`, som henter bildet fra Miljødirektoratet. Utviklingen siden 1988
(`gull.inonUtvikling`) kaller de samme tabellene med de tidligere årene. Slik kan man følge hvert tall fra siden ned til kilden.

**Datasett i sølv.** Et datasett er ett sett data fra virkeligheten, gjort om til vår standard. Tabellene i bronse og sølv som henter
og lager det, hører til datasettet på én av to måter. *Dataene* er selve datasettet: i bronse slik det hentes, og i sølv slik det er
gjort om. *Støttedata* trengs for å hente, forstå og regne med dataene: en sjekk av om dataene finnes, en oversikt som gjør hentingen raskere,
opplysninger om dataene, oppslag når man trykker i kartet, dataene i en annen form, som zoomet ut eller lagt på rutene, eller en
mellomregning. Støttedata er opplysninger om dataene, dataene i en annen form eller mellomregninger, ikke nye data, så det samme
ligger ikke to ganger i sølv. Støttedata som ikke hører til ett datasett, står for seg som *Andre støttedata*: bakgrunnskartet og
alle feltene for et område i naturtemaene.
Støttedata kan favne bredere enn dataene, og tallene kan regnes av støttedata som er dataene i en annen form, som arealet av
verneområdene. Hver tabell beskriver innholdet i sine egne data (`innhold`), og hva hver støttedata er til for, står én gang, på datasettet.
En støttedata har det samme navnet i bronse og sølv, i bronse med hvordan den hentes etter komma, som «Dekningen av kommuneplanen,
kartbilder». Datasettene står i `DATASETT` i katalogen. I katalogvisningen står dataene som én vanlig rad, i gruppen for filen de
lages i, og støttedataene ligger bak knappen «Støttedata» på raden. Bare én av knappene Info, Data og Støttedata på en rad er åpen om
gangen. Det som ikke er ferdig i støttedataene, står også på raden. Elleve datasett er delt inn slik: arealklassene fra grunnkartet,
grått areal, inngrepsfri natur, kommunene, kommuneplanen, egne planer, de fire naturtemaene (verneområdene, villreinområdene,
verdsatt natur og det kartlagte for naturtyper) og det syntetiske naturregnskapet fra SSB. Egne planer følger mønsteret fra kommuneplanen:
*Areal satt av til framtidig utbygging i egne planer*, med hver plan per rute som dataene, én rad per plan (`solv.egneruter`), og
«ikke utbygging» i tillegg til utbygging, fordi en egen plan erstatter kommuneplanen der den ligger. Flatene og opplysningene om
planene er støttedata. Sammenslåingen, der den siste planen gjelder der planer overlapper og planene erstatter kommuneplanen, skjer i
gull (`leggInnEgne` i `gull/utbygging.ts`). Arealklassene fra grunnkartet er ett datasett med to kolonner,
klassen og detaljklassen, i én tabell i sølv (`solv.klasser`). Støttedataene er de lagrede klassene og detaljklassene, blokkene i
kommunen, klassene zoomet ut og grunnkartet i et punkt. For grått areal og inngrepsfri natur er støttedataene kartet zoomet inn og ut
(og sonen i et punkt). Kommunene er ett datasett med listen over fylker og kommuner og grensen til hver kommune som dataene, og som
støttedata de lagrede grensene, kommunen i bitene (en mellomregning alle arealtellingene bruker), flaten til alle kommunene og
kommunen i et punkt. Kommuneplanen er *Areal satt av til framtidig utbygging i
kommuneplanen*, ikke hele kommuneplanen. Dataene er kartbildene (`bronse.planflis` og
`solv.kommuneplanruter`). Støttedataene er dekningen av kommuneplanen (`planbit`, `plandekning`), opplysningene om den
(`planopplysninger`, `planinfo`), oversikten over arealet satt av (`planoversikt`) og kommuneplanen i et punkt (`planIPunkt`).
Verneområdene kommer som flater, så der er det vektoren som er dataene: områdene klippet mot kommunen, med opplysningene
(`bronse.verneomrader` og `solv.verneomrader`). Verneområdene i rutene er avledet av flatene og er støttedata (`vernAndel` og
`verneformAndel`), etter prinsippet om at det samme ikke skal ligge to ganger i sølv. Der kilden er kartbilder, er rutene dataene.
Villreinområdene, verdsatt natur og det kartlagte er delt inn på samme måte, og arealet av hvert tema regnes i gull av rutene
(`gull.vernAreal`, `gull.villreinAreal`, `gull.verdsattAreal`, `gull.vurderesAreal` og `gull.kartlagtAreal`). Verdsatt natur er ett
datasett med én henting: lokalitetene med og uten fast verdi, klippet mot kommunen, i én tabell i sølv. Kryssingen av verdsatt
natur og det kartlagte regnes i gull (`gull.verdsattNaturIKartlagt`), og oppslagene for kryssingen med utbyggingen er en
hjelpetabell i gull (`gull.naturoppslag`). Arealet av hvert område i naturtemaene står i sølv: arealet av én flate i kommunen er
en egenskap ved flaten, som utsnittet, og mange geodataformater har det som et eget felt. Arealet av et tema i kommunen, der
områdene er slått sammen så overlapp telles én gang, er en utregning over mange flater eller ruter, og står i gull.

**Støttedata i gull.** Gull har ingen datasett. Der er det sidene viser data: tabellene som står i et kort i forklaringene (`KORT` i
`src/ui/forklaringer.ts`). Alt annet i gull er støttedata: mellomregninger, som arealet av et tema, kolonnene for temaene i
utbyggingen og SSBs tabeller lest med hovedøkosystemene, og hurtigminne, som utvalgene og kommuneplanen alene. En test sjekker at
hver tabell i gull er det ene eller det andre. I katalogvisningen står gull etter kortene, i den rekkefølgen kortene står: tabellene
kortet viser, og støttedataene det bygger på bak knappen på den siste. En tabell står under det første kortet som viser den, og en
støttedata under det første kortet som bygger på den. Hovedsiden og tvillingen bruker de samme tabellene der de viser det samme, som
utbredelsen og regnskapet fra SSB.

**Syntetiske data lages i sølv.** Naturregnskapet fra SSB er et bevisst avvik fra regelen om at sølv bare tolker kildene. SSBs to
tabeller (arealet per økosystemtype i 2024, og endringen mellom bebygd og de andre økosystemtypene 2017–2024) publiseres 25. november
2026. Til da lages de syntetisk i sølv (`solv/naturregnskap.ts`), av arealtallene, i den formen SSB vil gi dem, med kodene i SSBs
klassifisering av økosystemer. Grunnen er at bronse og sølv er det som byttes ut når de ekte tallene kommer, mens gull og sidene skal
bestå. Da kommer en tabell i bronse, og tabellene i sølv tolker den i stedet for å lage tallene. Datasettet og tabellene i sølv er
merket syntetisk, og feltet `syntetisk` følger tallene til sidene. Tabellene er den eneste kilden til SSB-tall: utbredelsesregnskapet,
land og vann og landarealet på hovedsiden regnes også av dem. SSBs arealstatistikk (tabell 09594) er bare en kilde i bronse
(`bronse.arealAlle`) som de syntetiske tallene lages av.

**Katalogen og cachen er to ting.** Katalogen er det interne API-et: hvilke tabeller som finnes, hvordan de kalles, og hvor
ETL-funksjonen står. Alt som hentes, går gjennom den, også bakgrunnskartet (`bronse.bakgrunnsflis`). Cachen er hvor mye som huskes
av svarene, og det står per tabell (`husk`). En tabell med `husk: 0` går gjennom katalogen uten at noe lagres. Bakgrunnskartet er
slik: kartet holder de ferdige flisene selv, og nettleseren har sin egen hurtigbuffer. Et kall som er underveis, deles også når
svaret ikke lagres, så to som spør samtidig, gir ett kall til kilden. Hva som lagres, følger prinsipp 6 under.

**Cachen kan starte utfylt.** En tabell kan ha ferdige svar som ligger lagret sammen med siden (`lagret` i katalogen). Finnes
svaret der, brukes det, og ETL-funksjonen kjøres ikke. Ellers kjøres den som vanlig. Kommunegrensen og andelen per rute er slik.
Grunnkartet per blokk (`solv.klasser`) er lagret kolonne for kolonne, og ETL-funksjonen leser den lagrede kolonnen der den finnes og
henter resten fra NIBIO: for 57 kommuner (alle i Trøndelag og Finnmark, og Bergen) er klassene laget på forhånd av den samme ETL-funksjonen
(`verktoy/klasser.ts`) og lagret som små bilder i `public/klasser/`, på 10,6 meter (nivå 10), 4 971 filer og 20 MB. Siden slipper da kallene mot NIBIO, og nettleseren henter
bare filene for valgt kommune. Blokkene i kommunen (`solv.blokker`) står i registeret (`public/klasser.json`). Detaljklassene (den andre kolonnen i `solv.klasser`) er lagret på samme måte for 59 kommuner, alle i Trøndelag og
Finnmark, og Stavanger, Sandnes og Bodø (`verktoy/klasser.ts --detalj`, i `public/detaljklasser/`, 5 254 filer og 59 MB), lest
innenfor de lagrede dagens klassene. For de andre kommunene lages de av kartbildene fra NIBIO, med den samme funksjonen. For de 60 kommunene
med lagrede klasser eller detaljklasser er også kommunegrensen (`solv.grense`) og kommunens andel per rute i bitene
(`solv.kommunebiter`) lagret (`verktoy/kommunegrenser.ts`, i `public/kommunegrenser/`, 3,5 MB grenser og 6,9 MB andeler pakket med
gzip). Da hentes ingenting fra Kartverket, og andelen regnes ikke ut, når kommunen velges.

Svarene huskes i cachen (`src/data/cache.ts`), som ETL-koden ikke vet noe om:

- **Les-gjennom.** Ligger svaret i cachen, brukes det. Ellers kjøres ETL-funksjonen, og svaret legges i cachen. Et kall som alt er
  underveis, deles, så to som spør etter det samme, gir ett kall til kilden.
- **Én rad per tabell og kommune**, med status (henter, feil eller ok), svaret og tiden det tok.
- **Det som bygger på brukeren, regnes ut på nytt** når egne områder endres. Tabellene det gjelder, er merket `brukerstyrt` i
  katalogen: utbyggingen og alt som bygger på den. Siden viser de gamle tallene til de nye er klare. Kommuneplanen alene i hele
  kommunen (`5001/gammel`) er den samme uansett egne områder, så i tabellene merket `gammelFast` blir den ikke utdatert. Når det
  første egne området kommer, legges svarene som alt er regnet ut for planen, inn som svarene for kommuneplanen alene
  (`kommuneplanAlene` i `motor/egne.ts`).
- **Ingen kopier i cachen.** Svarene lagres som de er, uten å gjøres om til tekst. Et nytt svar erstatter det gamle. Unntaket er
  merket voksende: utbyggingens blokker. Analysene for et utvalg tar selv en egen kopi av svaret før de gir det fra seg, se regel 7
  under.
- **Grensene** står per tabell i katalogen (`husk`). Svar fra kildene er store og huskes for noen få kommuner. Gull er små tabeller
  og huskes for flere. Det som er brukt lengst siden, går ut først.
- **Bare så lenge siden er åpen.** Siden lagrer ingenting selv i nettleseren: ingen informasjonskapsler og ingen lokal lagring.
  Cachen er borte når siden lukkes. Nettleserens vanlige hurtigbuffer kan likevel ta vare på svar fra tjenestene, slik hver
  tjeneste selv bestemmer, og da kan neste besøk få svaret uten et nytt kall.
- **Se innholdet.** Under Tekniske valg på siden Om og metode viser «Katalogen» alle tabellene, per lag og gruppert etter
  ETL-filen (i bronse er det kilden, i sølv og gull innholdet), og hvor mye cachen har lagret i hver. «Info» på hver tabell sier
  hva den er, kilden med kildens egen beskrivelse, hvor den hentes fra og hvordan den lages, hva den bygger på, usikkerheten og
  hvor ETL-funksjonen ligger: det samme som infoboksene og METODE.md bygger på. «Data» viser radene som ligger i cachen. En tabell som ikke lagrer, kan spørres i
  stedet («Spør»), med valgt kommune eller flisen midt i kartet som nøkkel (`eksempel` i katalogen). Det kan hente fra kildene,
  men spør ikke etter noe som ikke finnes, som egne områder som ikke er tegnet. Innholdet vises i to deler: om dataene (status, tiden, og feltene som beskriver dataene, som kommune,
  utsnitt og størrelse) og dataene selv: bildene slik de kom fra kildene, rutenettene i sølv og gull som bilder, lister som tabeller
  og flater som omriss. Til slutt viser «Kartets minne» hvor
  mange ferdige fliser OpenLayers holder på i hvert kartlag (opptil 512 per lag), og omtrent hvor mye minne de tar.

Noen tabeller har ingen ETL-funksjon. Egne områder slik brukeren laget dem (`bronse.egne`) fyller datamotoren. Hjelpetabellene
fyller en ETL-funksjon underveis: utbyggingens blokker og oppslagene i områdene.

### Prinsippene for dataflyten

1. **Sølv er felles standard, gull setter sammen.** Hver ting, som planen, dagens klasser eller et naturtema, får én datamodell i
   sølv: UTM33, km², de tre klassene og rutenettet. Har den flere kilder, ligger de side om side og uendret, merket så de kan
   skilles. Planen har to: kommuneplanen fra DiBK og egne områder fra brukeren. Sølv velger ikke mellom kildene og setter ikke
   ulike ting sammen. Det gjør gull: at et eget område erstatter kommuneplanen der det ligger, planen lagt oppå dagens klasser,
   verneområdene krysset med utbyggingen, verdsatt natur innenfor det kartlagte. Kommunegrensen og rutenettet er rammen, ikke en
   kilde, så å klippe verneområdene mot kommunen er sølv. Planen ligger i to tabeller, én per kilde, med samme datamodell (`Planruter`):
   `solv.kommuneplanruter` og `solv.egneruter` (én rad per egen plan). Dagens klasser er blokkene på 10,6 meter (`solv.klasser`), lagret eller hentet fra
   NIBIO når kommunen velges.
2. **Gull deles der det kommer inn en ny eller tregere kilde.** Hver tabell i gull svarer på ett spørsmål. Trenger en del av svaret
   noe som kommer senere, som utbyggingen, blir den delen en egen tabell som kaller den første. `gull.verneomrader` er
   verneområdene i kommunen, og `gull.verneomraderIPlan` er planlagt utbygging innenfor dem. Gull kan kalle gull.
3. **Gull venter på alt det bruker.** En ETL-funksjon henter det den bygger på med `await`, og titter ikke etter om noe finnes
   (`.naa()`). Da står hele sporet fra side til kilde i koden. Kan noe mangle uten at svaret er feil, som det kartlagte, står det
   uttrykkelig: `katalog.solv.kartlagt(nr).catch(() => null)`.
4. **Komponentene velger selv hvor store de er, og gjør bare visningslogikk.** En komponent kan lese flere resultater fra gull, for
   eksempel vise listen med en gang og planlagt utbygging når den er regnet ut. Men den lager ingen nye tall. Kommer det et tall ut
   av komponenten som ikke står i gull, er det metode, og det hører hjemme i gull.
5. **Det brukeren gjør, er kilder nederst.** Egne områder (`bronse.egne`) kommer fra brukeren, ikke fra kommunenummeret. Det er
   den eneste tabellen datamotoren fyller selv. Ellers bestemmer datamotoren bare når: når egne områder endres, er gull for
   kommunen utdatert og regnes ut på nytt.
6. **Gull lagres, sølv og bronse bare når noen vil spørre etter dem igjen.** Det er når gull regnes ut på nytt fordi brukeren
   har gjort noe, når kartet spør, og når mange bruker det samme, som kommunegrensen. Ellers hentes sølv og bronse rett før de
   trengs (`husk: 0`). Svarene fra Miljødirektoratet lagres for eksempel ikke, for sølv lagrer det som trengs av dem.
7. **Et svar med tall får en egen kopi før det gis videre, når den samme funksjonen regner for flere utvalg etter hverandre.**
   Dette er en omvei rundt en feil i JavaScript-motoren i Chromium, sett 18. og 19. oktober 2026 (METODE.md, under Kontroller): et
   ferdig svar kan få tallene fra det neste svaret den samme funksjonen regner ut, uten at noen kode skriver til det. Feilen kommer
   bare av og til, når siden har mye å gjøre. Omveien er fast, og skal brukes på samme måte for lignende feil:
   - Regner en funksjon det samme for den gamle og den nye planen, eller for hele kommunen og hvert eget område, og brukes et eldre
     svar videre, gis svaret fra seg som `egenKopi(svar)` (`src/data/generelt/kopi.ts`).
   - Kopien tas i det samme synkrone steget som svaret ble regnet ut, uten `await` imellom. Feilen slår til når det neste svaret
     regnes ut, og da må kopien alt være tatt.
   - Store ting som deles med vilje, som listen over områdene i et tema, kopieres ikke. Bare tallene kopieres.
   - Ses et tall i et ferdig svar endre seg uten at koden skriver til det, er det denne feilen. Da brukes den samme omveien der,
     og det skrives i loggen i METODE.md. Feilsøkingen som fant den, står der også.
   Analysene som gjør dette nå: `gull.planlagt`, `gull.planlagtPerDetaljklasse`, `gull.graakryss`, `gull.graaIPlan`,
   `gull.verneomraderIPlan`, `gull.villreinIPlan`, `gull.verdsattNaturIPlan`, `gull.utbyggingUtenforKartlagt`,
   `gull.planPerOkosystem` og summene i utbyggingen (`tellRyddet`).

**Utbyggingen er midtpunktet.** Siden handler om ett spørsmål: hvor er det planlagt utbygging, og hva treffer den?
`gull.utbygging` er svaret i rutenettform: kommuneplanen og egne områder lagt oppå dagens klasser, med én rad per rute med planlagt
utbygging. For hvert tema er det en kolonne som sier hvor hver rad ligger (`gull.utbyggingIVerneomrader` og de andre), og tallene
sidene viser, er summer over radene. Slik kunne det vært en faktatabell i Databricks:

```
bronse.planflis (DiBK) → solv.kommuneplanruter          ─┐
bronse.egne (brukeren) → solv.egne → solv.egneruter     ─┼─→ gull.utbygging ─┐
solv.klasser → gull.dagensKlasser                       ─┘                   ├─→ gull.utbyggingIVerneomrader ─→ gull.verneomraderIPlan
solv.verneomrader                                       ─────────────────────┘
```

Planen og dagens klasser tolkes per rute i sølv (`solv.kommuneplanruter`, `solv.egneruter` og `klasserIFlis`), og settes sammen i
gull. Kartlagene tegnes per piksel av den samme sannheten på nivået kartet viser, gjennom datamotoren (`motor/kartverdier.ts`), og
et trykk i kartet slår opp i den samme. Grått areal er
krysset med utbyggingen for seg (`gull.graakryss`), fordi det også teller planlagt utbygging der det alt er bebygd, og grønt i
bebygd område.

Det finnes tre slags tilstand: den som gjelder nå (`app` i datamotoren og `ui` i visningen), cachen, og kartets egen (OpenLayers og
kartkoden, som bare husker det som er laget for å tegne, som ferdige fliser og masker). De ferdige flisene vises i katalogen som
«Kartets minne».

## Datamotoren og brukergrensesnittet

Datamotoren samordner: den velger kommune, fyller kildene fra brukeren og bestemmer når noe skal regnes ut på nytt. Selve
utregningen gjøres i ETL-koden. Brukergrensesnittet viser og tar imot det brukeren gjør. De er skilt slik:

- Tilstanden som gjelder nå, ligger i ett objekt, `app`, i `src/data/motor/tilstand.ts`: valgt kommune og egne områder (valgene
  brukeren har gjort), og hentingen (det tekniske). Alt som er hentet og regnet ut, ligger i cachen.
- Komponentene og kartet leser tabellene i katalogen for valgt kommune, med `valgt` og `verdi` i `src/data/motor/valgt.ts`, for
  eksempel `valgt(katalog.gull.inon)`. Mangler svaret, bes det om, og siden tegnes på nytt når det er klart.
- Det som bare gjelder visningen, ligger i `ui` i `src/ui/tilstand.ts`: valgt side, hva som er slått på i kartet, og det som vises
  over og under kartet. Datamotoren bruker det ikke.
- Den som endrer noe som vises, kaller `endret()`. Varslene samles, så mange endringer etter hverandre gir én ny tegning.
- `App.tsx` abonnerer med kroken `useApp` og tegnes på nytt ved hvert varsel. Hvert kartlag abonnerer også, og ser etter om det
  det tegnes av, er nytt.
- Komponentene endrer ikke tilstanden i datamotoren selv. De kaller datamotoren, for eksempel `velgKommune` og `lastOppPlan`.
- Kartet lages i `ui/kart/kart.ts` (`lagKart`) og settes inn på siden av `Kartpanel.tsx`. Knappen for å bytte kommune er en del av
  siden, men kartet plasserer den over punktet man trykket på.
- Bronse sier fra om hentingen gjennom én funksjon (`nårHentingEndres`). Datamotoren legger det som vises, i `app`.

### Lasting av filene

Filene i datamotoren, og filene i kartet, kaller hverandre fram og tilbake. Det går bra så lenge ingen fil bruker en annen mens den
lastes. Det kartlagene trenger mens filene lastes (flisnettet og kildene for lag som tegnes i nettleseren), ligger derfor i
`ui/kart/felles.ts`, som bare bruker OpenLayers og datadelen. Selve kartet lages først når alt er lastet. Bryter man regelen,
stopper siden med en `ReferenceError` når den åpnes.

### Hvem gjør hva

Både mappen og navnet på en funksjon sier hva den gjør:

| Hvor | Navn begynner med | Hva funksjonen gjør |
|---|---|---|
| `src/data/generelt/` | | Det som ikke handler om noe bestemt. Får alt som argumenter og gir svaret tilbake. |
| `src/data/bronse/` | `hent` | Henter fra én tjeneste og gir svaret urørt tilbake. Det eneste stedet det går kall ut på nettet. |
| `src/data/solv/` og `src/data/gull/` | `tolk`, `kryss`, `bygg`, `tell` og andre | Regner. Får alt som argumenter og gir svaret tilbake. Leser ikke fra siden, skriver ikke til den, henter ikke fra nettet og bruker ikke delt tilstand. |
| `src/data/bronse/`, `src/data/solv/` og `src/data/gull/` | Samme navn som tabellen | ETL-funksjonene i katalogen: henter det de bygger på fra katalogen, og gir svaret tilbake. |
| `src/data/motor/` | `hent`, `les`, `velg`, `oppdater` | Samordner. Velger kommune, fyller kildene fra brukeren, ber om tabellene i katalogen og sier fra når noe er nytt. |
| `src/ui/kart/` | `tegn`, `vis`, `last` | Tegner kartet: lag, fliser og markeringer. Regner ikke ut nye tall. |
| `src/ui/komponenter/` | Store bokstaver | React-komponenter: gjør gull om til tekst, tabeller og stolper. |

Sølv og gull er den delen som kan tas med uendret til en annen løsning, og kan kjøres i Node. Flatene gjøres om til ruter i egen
kode (`generelt/dekning.ts`). Det eneste de trenger fra nettleseren, er lerretet til å lese kartbildene og tegne egne områder
(`raster.ts`, og bakgrunnstråden i `arbeid.ts` og `arbeider.ts`).

`node verktoy/sjekk-lag.ts` kontrollerer at lagene bare bruker hverandre i riktig retning: data importerer aldri fra ui, generelt
importerer ingenting, sølv og gull holder seg for seg selv, bronse og datamotoren bruker ikke OpenLayers eller React, React-komponentene henter ikke fra bronse og
tar bare navn og faste verdier fra sølv, det har ikke havnet regnefunksjoner i datamotoren, og ingen andre enn cachen har minne
i data. ETL-koden i bronse, sølv og gull importerer katalogen, men ikke cachen.

Komponentene regner ikke. Tallene og andelene kommer fra gull, og komponentene velger ord, avrunding og enhet. Unntaket er
stripene i `deler.tsx`, som regner ut bredden på hver del av det de tegner. Kartet tegner piksel for piksel og bruker derfor
tolkingen av fargene i sølv (`klasseAv`) og tersklene der. Der kartet har egne terskler, står det i METODE.md.

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
| `MdAccordionItem` | Bronse, sølv og gull i katalogen under teknisk visning |
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
  Verneområder og verdsatt natur har egne farger, se `FARGER` i `src/ui/farger.ts`.

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
- Komponentene hentes hver for seg (`src/ui/komponenter/md.ts`), og bare stilene for dem lastes (`src/main.tsx`). Pakkens samlede
  inngang tar med alle komponentene.
- Komponentene er CommonJS og henter Ariakit med `require`. Ariakits CommonJS-utgave har en hjelper som byggeverktøyet gjør om
  til en uendelig løkke, så `vite.config.ts` sender `@ariakit/react` til Ariakits ES-utgave.
- `MdComboBox` finnes bare som standardeksport. `md.ts` tar høyde for begge måtene byggeverktøyet kan levere den på.

## Legge ut en endring

1. Gjør endringen.
2. `npm run utgave` setter nytt utgavemerke, som vises under «Vis teknisk informasjon».
3. `npm run sjekk`, `npm test` og `npm run regresjon` (se under).
4. Commit og push til `main`.

Arbeidsflyten `.github/workflows/legg-ut.yml` («Bygg og legg ut») kjører ved hver push til `main`: den installerer pakkene fra
`package-lock.json`, kjører `npm run sjekk` og `npm test`, bygger hovedsiden og tvillingen fra Figma, og legger ut `dist/` på GitHub Pages. Den kan også startes for hånd under
Actions. Feiler sjekken, testene eller bygget, blir ingenting lagt ut, og siden som ligger ute, står urørt.

GitHub Pages må ha «GitHub Actions» som kilde (Settings → Pages → Build and deployment → Source). Står den på «Deploy from a
branch», legger GitHub ut repoet slik det er, uten bygg, og siden blir blank.

Hver action i arbeidsflyten er låst til en bestemt commit, med versjonen i en kommentar. Ved oppgradering byttes både
commit og kommentar.

## Tester

Testene ligger i `test/`, én fil for hvert av generelt, sølv og gull, og én for cachen. De prøver regnefunksjonene med små,
faste eksempler, som arealet av et kvadrat med hull, tolking av fargene og avrunding til 10 dekar, og at cachen leser gjennom,
holder seg innenfor grensen og husker feil riktig. De bruker Nodes egen testkjører, trenger verken nett
eller nettleser, og tar under ett sekund: `npm test`. Funksjonene som bruker et lerret (`solv/raster.ts`) trenger nettleseren og
prøves av regresjonstesten.

## Verktøy

Verktøyene ligger i `verktoy/` og trengs bare under utvikling.

- `utgave.ts` setter utgavemerke, se over.
- `regresjon.ts` bygger siden, kjører et fast sett handlinger i en mobilnettleser for Trondheim, Surnadal og Oslo, og lagrer
  tallene datamotoren har regnet ut, teksten siden viser og skjermbilder av kartet. `npm run regresjon` kjører den, og
  `node verktoy/regresjon.ts ut/ny --mot HEAD` sammenligner arbeidskopien med siste commit. Den gamle utgaven kjøres med sitt eget
  testverktøy, så hver utgave leser tallene fra sin egen datamotor. Tallene kommer fra åpne tjenester og endrer seg over tid, så de
  to kjøringene må tas samme dag. Miljødirektoratet sender lokalitetene i tilfeldig rekkefølge, men sølv sorterer dem på en fast måte, så to
  kjøringer av samme kode gir nøyaktig like tall.
- `motortall.ts` henter tallene fra datamotoren til regresjonstesten. Tallene leses fra katalogen, med samme utdata som før. Med `?teknisk`
  gjør siden tilstanden, temaene, katalogen, innholdet i cachen og kartet tilgjengelig som `window.motor` (`src/ui/teknisk.ts`).
- `sjekk-lag.ts` kontrollerer at lagene bare bruker hverandre i riktig retning, også mellom tvillingen og `src/`, se over. `npm run sjekk` kjører typesjekken
  (`tsc`) for `src` og `verktoy`, så denne, og så `forklaringer.ts --sjekk`.
- `forklaringer.ts` leser ut av ETL-funksjonene hvilke tabeller hver tabell bygger på (`src/data/avhengigheter.ts`), og skriver
  kapitlene i METODE.md mellom merkene `<!-- forklaringer:gruppe -->` fra kortene og katalogen. `npm run forklaringer` kjører den.
  Med `--sjekk` sier den fra hvis filene ikke er oppdatert, eller et steg mangler forklaring.
- `klasser.ts` lager de lagrede klassene på 10,6 meter, for eksempel `npm run klasser -- --fylke 50`. Arbeidet gjøres i Chromium med katalogen i `src` (`klasser-side.ts`): verktøyet kaller `solv.blokker` og
  `solv.klasser` uten registeret, så ETL-funksjonene kjøres, og lagrer svaret. Siden bruker da den samme funksjonens svar som
  ferdig svar (`lagret` i katalogen). En blokk koster ett kall mot NIBIO.
- `kommunegrenser.ts` lager de lagrede kommunegrensene og andelene per rute, for eksempel `node verktoy/kommunegrenser.ts --lagrede
  --hentet "18. oktober 2026"` for alle kommunene med lagrede klasser. Arbeidet gjøres i Chromium med katalogen i `src`
  (`kommunegrenser-side.ts`): verktøyet kaller `solv.grense` og `solv.kommunebiter` uten registeret og lagrer svaret. Den må lages på
  nytt når kommunegrensene endres.
- `kommuneareal.ts` lager `public/kommuneareal.json`: flaten til hver kommune med land, ferskvann og hav, regnet av Kartverkets
  grenser én gang. De syntetiske tabellene bruker den til havet i alle kommunene. Den må lages på nytt når kommunene endres.
- `figma-roykt.ts` er røyktesten for tvillingen fra Figma, se over.
- `egne-ytelse.ts` måler hvor lang tid sammenligningen for egne områder tar: laster opp testplanen og syntetiske planer med så mange
  flater som oppgis, og viser tiden til tabellene står og tiden med økosystemtypene, og stegene som tok tiden. Krever bygget i
  `dist/`. For eksempel `node verktoy/egne-ytelse.ts --kommune 5001 --flater 300,1500`.
- `testdata/testplan-bygg.geojson` er tolv planflater fra Trondheim, hentet fra DiBK, til test av opplasting.

`npm run formater` formaterer koden etter `.prettierrc.json`.

## Kilder

Grunnkart for arealanalyse og kart over grå arealer: NIBIO. Arealtall: SSB, tabell 09594. Kommuneplaner: DiBK.
Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grenser og bakgrunnskart: Kartverket.
