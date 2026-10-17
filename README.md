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
| `public/` | Filer som legges ut som de er: listen over kommuner, flaten til hver kommune (`kommuneareal.json`), dagens klasser lagret per blokk på 21 og 10 meter for noen kommuner (`klasser/` og `klasser.json`), og detaljklassene per blokk på 10 meter for seks kommuner (`detaljklasser/` og `detaljklasser.json`) |
| `.github/workflows/legg-ut.yml` | Bygger og legger ut siden på GitHub Pages ved push til `main` |
| `.nvmrc` | Node-versjonen, for nvm og for arbeidsflyten |

### Data

Katalogen og cachen, i `src/data/`. Se «Katalogen og cachen» under.

| Fil | Innhold |
|---|---|
| `katalog.ts` | Katalogen: listen over tabellene i bronse, sølv og gull, som `katalog.lag.tabell`. Hver tabell er en ETL-funksjon med samme navn, og har et kort, lesbart navn (`tittel`), hva den er (`om`) og hvor mange kommuner som huskes. Tabellene bak tallene har også forklaringen, usikkerheten og kilden (`forklaring`, `usikkerhet`, `kilde`), og oppslag, lagrede svar og hjelpetabeller er merket som tekniske (`teknisk`). Kildene står samlet øverst (`KILDE`), med lisensen. |
| `avhengigheter.ts` | Hvilke tabeller i katalogen hver tabell bygger på, lest ut av koden. Laget av `verktoy/forklaringer.ts`, ikke rediger for hånd. |
| `cache.ts` | Cachen: svarene fra ETL-funksjonene, per tabell og kommune, med status (henter, feil, ok), tid og om svaret er delvis. Gjør kallene, deler kall som pågår, og glemmer det eldste. Importerer ingenting. |

Generelt, i `src/data/generelt/`. Det som ikke vet noe om natur, kommuner eller kilder. Hver ting finnes bare her, så alle lagene
regner likt. Filene importerer ingenting.

| Fil | Innhold |
|---|---|
| `geometri.ts` | Flater og utsnitt: typene, arealet med fortegn og omløpsretning, utsnittet som rommer en flate, snitt og overlapp |
| `tall.ts` | Summen av en liste tall (`summen`) |
| `farge.ts` | Hvilken av noen farger en farge ligger nærmest (`naermesteFarge`) |
| `png.ts` | PNG-filer: bitene i en fil, og et bilde med fargetabell (til de lagrede klassene) |
| `glissen.ts` | Glisne rutenett: et stort rutenett i blokker på 512 × 512 ruter, der bare blokkene som har noe, finnes. Leses rute for rute som et vanlig rutenett. Brukes av utbyggingen. |

Bronse, i `src/data/bronse/`. Én fil per tjeneste, og felles filer for hvordan det hentes og for kartjenester etter WMS.

| Fil | Innhold |
|---|---|
| `henting.ts` | Henting, kall-loggen, hvor sidens egne filer ligger, og køen for kartbilder (høyst fire kall om gangen per kilde). Bakgrunnskartet har en egen kø som tallene ikke venter på. Husker ingenting: det gjør cachen. Sier fra om hva som skjer, uten å vite hvem som lytter. |
| `endepunkter.ts` | Endepunktene for alle kildene, samlet. Filene i bronse bygger kallene på dem, og katalogen viser dem ved hver kilde i infoknappene og METODE.md |
| `wms.ts` | Adressen til et kartbilde eller et oppslag fra en kartjeneste etter WMS 1.3.0, for et utsnitt i UTM33 eller ett punkt |
| `ssb.ts` | SSB, tabell 09594, med det eldre API-et som reserve, summert til tre klasser og hver arealklasse for seg |
| `kartverket.ts` | Fylker og kommuner, kommunegrensene, oppslag av kommune i et punkt, og bakgrunnskartet |
| `nibio-grunnkart.ts` | Nasjonalt grunnkart for arealanalyse: kartbildene med de seks klassene i rene farger, per flis, de lagrede klassene per blokk med registeret, og grunnkartet i ett punkt |
| `dibk-kommuneplan.ts` | Kommuneplanene hos DiBK: flatene for framtidig utbygging, en oversikt over hvor de ligger i kommunen, hvor mye av kommunen planen dekker, hvilken plan det er, og flatene i ett punkt |
| `mdir-naturtema.ts` | Miljødirektoratets verneområder, villreinområder, naturtyper med KU-verdi og det kartlagte området, side for side når det er flere flater enn tjenesten gir i ett svar, og alle feltene for ett område |
| `mdir-inon.ts` | Inngrepsfrie naturområder, som ett bilde av kommunen og i ett punkt |
| `mdir-naturskog.ts` | Kartet over naturskog (v1), som kartbilder til visning i tvillingen |
| `nibio-graa.ts` | Kart over grå arealer, som bilder av kommunen og som fliser |
| `planfil.ts` | En opplastet planfil, lest i nettleseren og gjort om til UTM33 |

Sølv, i `src/data/solv/`. Hver fil er én ting i felles standard, med kildene side om side. METODE.md forklarer metoden bak hver fil.

| Fil | Innhold |
|---|---|
| `felles.ts` | UTM33, flisnettet, rutenettene, alle terskler, målestokken i UTM (arealet av en flate i km² i terrenget), og datamodellen for planen per rute (`Planruter`) |
| `kommune.ts` | Kommunegrensen i UTM33 med utsnittet, nettet for bilder av hele kommunen, og et slikt bilde tolket til ruter |
| `grunnkart.ts` | Grunnkartet fra NIBIO: dagens klasser per blokk på 21 meter (`solv.klasser`, laget av kartbildene eller lagret), blokkene i kommunen, og dagens klasser for hele kommunen zoomet ut fra to kilder: blokkene satt sammen og det sammensatte kartet av flisene som er hentet |
| `projeksjoner.ts` | Projeksjonene siden kjenner, og omregning til UTM33 |
| `raster.ts` | Fra flater og bilder til ruter: flatene tegnes i et lerret, bildene leses inn, og dekningen regnes om til areal. Den eneste filen i sølv og gull som bruker nettleseren. |
| `klasser.ts` | Bebygd, jordbruk og natur: koblingen til SSBs arealklasser og grunnkartets økosystemtyper, tolking av fargene i kartbildene, og dagens klasse per rute i en flis |
| `ssb.ts` | SSB-svarene gjort om til km² per klasse, for nyeste år og 2017, og hver arealklasse for seg per år (til tvillingen fra Figma) |
| `kommuneplan.ts` | Kommuneplanen fra DiBK: planen per rute i en flis (`solv.kommuneplanruter`), hvor planen ligger i kommunen (`solv.planoversikt`), og om kommunen har plan og hvilken |
| `egne.ts` | Egne områder fra `bronse.egne`: hvilke flater som er utbygging (`solv.egne`), og områdene som planen per rute (`solv.egneruter`) |
| `temaer.ts` | Verneområder, villrein og verdsatt natur: flatene klippet mot kommunen, og som masker i et rutenett |
| `inon.ts` | Inngrepsfri natur: sone per rute |
| `graa.ts` | Grått areal: trinn per rute etter andel vegetasjon |
| `punkt.ts` | Oppslag i ett punkt, til detaljene ved trykk i kartet: grunnkartet, kommuneplanen og inngrepsfri natur i punktet, og alle feltene for et område i et naturtema, som felt og verdi. Inngår ikke i tallene. |
| `kodelister.ts` | Kodelister fra Geonorge og SOSI: arealformål, arealbruksstatus og eierform i kommuneplanen |

Gull, i `src/data/gull/`. Alt som setter kilder sammen, og det sidene viser, for én kommune. Funksjonene som heter `bygg`, `kryss`
eller `kombiner` noe, er rene utregninger som tabellene bruker.

| Fil | Innhold |
|---|---|
| `felles.ts` | Andel i prosent, areal fra antall ruter avrundet til nærmeste 10 dekar, landarealet, og tilstanden for temaene som hentes som ett bilde |
| `grunnkart.ts` | Dagens klasser for kommunen på tvers av de to kildene i sølv: blokkene for hele kommunen, lagret eller hentet fra NIBIO, og det sammensatte kartet når blokkene ikke kan lages |
| `utbygging.ts` | Utbyggingen, midtpunktet: egne områder erstatter kommuneplanen der de ligger, og planen legges oppå dagens klasser i ruter på 21 meter (eller 10,6 meter, valgt under Tekniske valg), med smale striper tatt bort. Én rad per rute med planlagt utbygging. Rutenettene er glisne: planen har bare blokkene med planlagt utbygging. |
| `regnskap.ts` | Utbredelsen nå, forskjellen fra 2017, regnskapsoppstillingen, og land og vann |
| `syntetisk.ts` | Syntetiske tabeller til SSBs tabeller for naturregnskapet kommer, av SSBs arealstatistikk alene: arealet per hovedøkosystem i 2024 og endringen mellom bebygd og landklassene 2017–2024, for kommunen og for alle kommunene i Norge, og summene, regnskapet og sammenligningen med Norge som tvillingen viser. Merket syntetisk. |
| `okosystemer.ts` | Grunnkartets økosystemtyper: skog, våtmark, naturen i verneområdene og planlagt utbygging per økosystemtype, av arealet per detaljklasse. Foreløpig bare til tvillingen. |
| `planlagt.ts` | Natur og jordbruk som planen setter av, med andeler, og kortversjonen til oversikten |
| `egne.ts` | Hva som ligger i hvert eget område, og radene som sammenligner med kommuneplanen |
| `temaer.ts` | Naturtemaene: temaet (områdene, arealet og andelen), kartleggingen av verdsatt natur, kolonnen for hvert tema i utbyggingen, summene over den, og planlagt utbygging utenfor det kartlagte |
| `inon.ts` | Tallene på siden |
| `graa.ts` | Arealet per trinn, og kryssingen med utbyggingen |

Datamotoren, i `src/data/motor/`.

| Fil | Innhold |
|---|---|
| `valgt.ts` | Valgt kommune, og en tabell lest for den: `valgt(katalog.gull.inon)` gir raden i cachen, og ber om den hvis den mangler |
| `tilstand.ts` | Tilstanden som gjelder nå (`app`): valgene og det tekniske. Lageret som sier fra når noe er endret (`endret`, `abonner`), og tidtakingen. |
| `kommune.ts` | Listen over kommuner, valg av kommune, og det som bes om med en gang: alle tabellene i gull for kommunen |
| `grunnkart.ts` | Dagens klasser til kartet, fra `gull.dagensKlasser`, og det sammensatte kartet mens blokkene hentes, med hvor langt hentingen er kommet. Legger nye fliser inn i det sammensatte kartet med en gang (tegningen står i sølv), og sier fra når kartet har stått stille med nye fliser og tallene bygger på det. |
| `plan.ts` | Det siden og kartet trenger å vite om utbyggingen: om kommunen har plan, utbyggingen for valgt kommune, og hvor langt den er kommet |
| `egne.ts` | Egne områder, tegnede og opplastede: en kilde fra brukeren, som legges slik brukeren laget dem i `bronse.egne` |

### Brukergrensesnittet

Felles, i `src/ui/`:

| Fil | Innhold |
|---|---|
| `tilstand.ts` | Det som bare gjelder visningen (`ui`): valgt side, hva som er slått på i kartet, og hva kartet sier om seg selv |
| `sider.ts` | Sidene, valg av side, adressen (`#kommune/side`), og oppstarten. Hvert nytt valg av side eller kommune legges i nettleserens historikk, så Tilbake og Frem virker, og en adresse som skrives inn eller lenkes til, velger kommunen og siden. |
| `farger.ts` | Fargene i kartet og i tegnforklaringene |
| `tekst.ts` | Hvordan tall og tekst skrives: dekar, prosent, endring med fortegn, tall med bokstaver og oppramsing |
| `forklaringer.ts` | Forklaringene bak tallene: hvert kort med spørsmålet, kort fortalt, tabellene i gull det viser (og andre det forklarer) og regnestykket for valgt kommune, og stegene fra kilde til tall. Et steg et annet kort forklarer, blir en henvisning dit. I infoknappene står hver kilde i bronse sammen med sølvtabellene som justerer den (`infostegFor`): «hentes … justeres …». Brukes av infoknappene og av `verktoy/forklaringer.ts`. |
| `teknisk.ts` | Formen på `window.motor`: det siden gjør tilgjengelig med `?teknisk`, til feilsøking og regresjonstesten |

Kartet, i `src/ui/kart/`. Hvert kartlag har sin fil og følger tilstanden selv.

| Fil | Innhold |
|---|---|
| `ol.ts` | Delene av OpenLayers som brukes, samlet som `ol` |
| `felles.ts` | Flisnettene, hva kartet holder på med, hjelpere for lag som tegnes i nettleseren, og kildene hvert lag krediterer (`KILDER`) |
| `kart.ts` | Selve kartet: bakgrunn, grense og status, hvordan lagene settes sammen, og kartets minne til katalogen |
| `klipping.ts` | Klipping mot kommunen: utenfor valgt kommune vises bare bakgrunnskartet |
| `trykk.ts` | Trykk i kartet: hva som er i punktet, prikken og omrisset av flatene i punktet, og bytte til kommunen man trykket i |
| `punktinfo.ts` | Detaljene for punktet man trykket på, gruppert per kartlag, som et oppslag i et vanlig GIS: det som alt er hentet, og det som slås opp hos kildene når detaljene vises |
| `feltnavn.ts` | Lesbare navn på feltene fra kildene i detaljene, og hvilke felt som bare vises med kildenes egne navn |
| `maaling.ts` | Måling av hvor jevnt kartet går, til teknisk visning |
| `fargelegging.ts` | Fargelegging av kartbildene fra NIBIO, fra de rene fargene til kartfargene |
| `grunnkart.ts` | Dagens klasser i kartet: flisene fra NIBIO, og bildet av hele kommunen zoomet ut |
| `plan.ts` | Planlagt utbygging |
| `naturtema.ts` | Verneområder og villrein med skravur (områdene er ofte store, og små områder vises som ring), verdsatt natur fylt, sløret over det som ikke er kartlagt, og markering av ett område |
| `kommunebilde.ts` | Felles for lagene som tegnes av et bilde av kommunen: masken, flisene og når laget vises |
| `inon.ts` | Inngrepsfri natur: fargene for sonene |
| `graa.ts` | Grått areal: fargene for trinnene, og fliser fra NIBIO når kartet er zoomet inn |
| `egne.ts` | Egne områder: tegning i kartet og omrissene |

React-komponentene, i `src/ui/komponenter/`. De fleste har en CSS-fil med samme navn, for eksempel `Oversikt.css` ved siden av
`Oversikt.tsx`. Temasidene deler `Temaside.css`.

| Fil | Innhold |
|---|---|
| `App.tsx` | Hele siden, og valget av teknisk visning |
| `Topp.tsx` | Valg av fylke og kommune, og overskriften |
| `Sidevelger.tsx` | Knappene for sidene, over kart og innhold, i grupper |
| `Kartpanel.tsx` | Kartet med merkelappene oppå, og linjen under kartet |
| `Punktdetaljer.tsx` | Detaljene for punktet under kartet, og knappen som slår dem på og av |
| `Tegnforklaring.tsx` | Tegnforklaringen i kartet: fargene som vises nå, ut fra hvilke kartlag som er synlige. Kan lukkes. |
| `Innhold.tsx` | Den valgte siden. Alle sidene ligger i siden, men bare den valgte vises. |
| `Oversikt.tsx` | Det viktigste fra hver side: navnet som lenke, ett tall og en kort forklaring |
| `Regnskap.tsx` | Utbredelsesregnskapet: natur nå, forskjellen fra 2017 som stolper, regnskapsoppstillingen, og land og vann |
| `Tallforklaring.tsx` | Overskriften på et kort med infoknappen, og panelet under: kort fortalt, regnestykket for kommunen, stegene fra kilde til tall (hver kilde med det den justeres til), usikkerheten og lenker til metoden og koden |
| `Temaside.tsx` | Toppen og rammen som alle temasidene har: navnet, arealet i kommunen, andelen av landarealet og kilden |
| `Naturtema.tsx` | Sidene for verneområder, villrein og verdsatt natur, med lister over områdene, og ordene sidene bruker om hvert tema |
| `Inon.tsx` | Siden for inngrepsfri natur |
| `Graa.tsx` | Siden for grått areal |
| `Framtid.tsx` | Utvikling fremover: planlagt utbygging og egne områder |
| `Egne.tsx` | Egne områder og opplastet plan, med tabellene som sammenligner med kommuneplanen |
| `Om.tsx` | Om og metode: kall-loggen og katalogen, hvordan klassene er satt sammen, om siden og tekniske valg |
| `Katalog.tsx` | Katalogen i teknisk visning: bronse, sølv og gull som trekkspill, og i hvert lag tabellene gruppert etter ETL-filen, med tittelen og «Info» (hva tabellen er, det tekniske navnet og hvor ETL-funksjonen ligger) og «Data» (radene i cachen, som kan åpnes for å se verdien) |
| `Datavisning.tsx` | Innholdet i en rad i cachen, etter formen det har: bilder fra kildene slik de kom, rutenett som bilde med én farge per verdi, lister som tabell, flater som omriss, og de enkle feltene. Formen finnes ut fra dataene, uten oppsett per tabell. |
| `deler.tsx` | Det designsystemet ikke har: fargeruter, stolper, tegnforklaringer, linjer i en liste med tall, lenker mellom sidene og tabeller med tall |
| `illustrasjoner.tsx` | Tegningene til temaene og de blå båndene, i stedet for bildene i skissene: flate landskap i samme stil, laget med KI og merket med det |
| `md.ts` | Komponentene fra designsystemet som siden bruker |
| `lager.ts` | Kroken som kobler komponentene til tilstanden |

## Tvillingen fra Figma

En egen side med utseendet og navigeringen fra Figma-skissene for naturregnskapet, drevet av den samme datamotoren. Den ligger på
`…/figma/` ved siden av hovedsiden, med samme adresser i hash: `#5001` (oversikten), `#5001/naturtapet`, `#5001/utforsk`,
`#5001/utforsk/skog`, `#5001/kart` og `#5001/hjelp`. Den skal la oss prøve den overordnede navigeringen og enkeltsidene fra skissene
med ekte tall, uten å endre hovedsiden.

- Kildekoden ligger i `srcFigma/`, og bygges for seg med `vite.figma.config.ts` til `dist/figma/`. Arbeidsflyten bygger den etter
  hovedsiden, så hovedsidens bygg er det samme som uten den.
- `srcFigma/` kan bruke kode fra `src/`, men `src/` bruker aldri `srcFigma/`. Fra `src/` bruker den datamotoren (`src/data`), kartet
  (`src/ui/kart`) og noen små fellesfiler (tekst, farger, designsystemet og kroken som tegner siden på nytt). Hovedsidens sider og
  adresse (`src/ui/sider.ts`) bruker den ikke.
- Tvillingen er bare brukergrensesnitt. All data og all metode ligger i datamotoren, som én sannhet for begge sidene: tallene leses
  ferdige fra gull gjennom katalogen, og `srcFigma/tall.ts` slår dem bare opp. Hva som regnes som skog, våtmark og land i
  grunnkartet, står i `src/data/solv/klasser.ts`. `verktoy/sjekk-lag.ts` passer på at tvillingen
  - ikke bruker bronse-filene eller regnehjelperne i `data/generelt/`,
  - bare bruker typer fra gull, ikke funksjonene,
  - og fra bronse i katalogen bare kartbildene (tabeller som slutter på «flis»), slik kartet i hovedsiden gjør.
- Kartet er det samme som i hovedsiden. Hvilket tema det viser, følger siden, som i hovedsiden (`ui.side`). Lagene bare tvillingen
  har (`srcFigma/kartlag.ts`), tegnes av sølv (`solv.detaljblokker` og `solv.detaljklasser`) og kartbildene fra bronse.
- Noen tabeller bruker foreløpig bare tvillingen, og hovedsiden henter dem ikke:
  - Grunnkartet med detaljklassene (`gull/okosystemer.ts`): skog (`gull.skog`), våtmark (`gull.vatmark`), naturen i
    verneområdene (`gull.vernetNatur`) og planlagt utbygging per økosystemtype (`gull.planPerOkosystem`). De bygger på arealet
    per detaljklasse (`gull.detaljareal`, `gull.detaljerIVerneomrader` og `gull.planlagtPerDetaljklasse`). Detaljklassene er lagret
    for Trondheim, Malvik, Røros, Stavanger, Sandnes og Bodø, og hentes fra NIBIO for de andre kommunene. Tabellene regnes etter
    behov (`etterBehov`), så hovedsiden henter dem ikke (se METODE.md, Arealklassene).
  - De syntetiske tabellene til SSBs naturregnskap kommer (`gull/syntetisk.ts`): arealet per hovedøkosystem i 2024
    (`gull.okosystemfordeling`) og endringen mellom bebygd og landklassene 2017–2024 (`gull.bebygdEndring`), og det tvillingen
    summerer av dem: kortene på oversikten (`gull.oversiktKort`), nedbyggingen per landklasse (`gull.nedbygging`) og regnskapet per
    hovedøkosystem (`gull.okosystemregnskap`). De samme for alle kommunene (`gull.okosystemerNorge`, ett kall til SSB) gir
    sammenligningen med Norge (`gull.sammenligning`). De to regnes først når tvillingen ber om dem (`etterBehov`), så hovedsiden
    henter dem ikke. Se METODE.md, SSB-tallene.
  - Naturtemaene (`gull/temaer.ts` og `gull/inon.ts`): vernet areal per verneform (`gull.vernPerVerneform`), villreinområdene med
    andelen (`gull.villreinPerOmrade`), verdsatt natur per naturtype (`gull.verdsattPerNaturtype`) og inngrepsfri natur i
    villreinområdene (`gull.inonIVillrein`).
- Sidens egne filer (`kommuner.json`, `klasser/` og `detaljklasser/`) ligger hos hovedsiden. Tvillingen sier hvor med
  `<meta name="egne-filer" content="../">`, som bronse leser (`src/data/bronse/henting.ts`).
- Utseendet følger skissene fra 17. oktober 2026 så nær som mulig: bredden (1200 px), toppen, kortene, båndene, radene som kan
  åpnes, figurene og flisene, med fargene målt i skissene. Skissene ligger ikke i repoet. Tallene er de samme som før.
- Det skissene viser som datamotoren ikke har ennå, står tomt: felt som krever en dataplattform har et tomt merke (–), og figurer
  og felt som mangler kilde eller ikke er laget, har en stiplet flate med det som trengs. Det blå feltet om hva naturen ble bygget
  ned til (som utgår), viser kommuneplanen i stedet. Kartlagene og listene som ikke er i skissene, som dagens arealklasser,
  planlagt utbygging og naturskog, er beholdt.
- Bildene fra skissene er ikke med, fordi rettighetene ikke er avklart, og heller ikke logoen eller skriften Sofia Pro (Open Sans
  står i stedet). Temaene og de blå båndene har i stedet en enkel illustrasjon hver, laget med KI og merket «KI-generert»
  (`srcFigma/illustrasjoner.tsx`).
- `npm run roykt-figma` åpner hver side i en mobilnettleser og sjekker overskrift, bredde, feil og Tilbake (`verktoy/figma-roykt.ts`).

| Fil i `srcFigma/` | Innhold |
|---|---|
| `index.html`, `main.tsx` | Inngangen: stilene og siden |
| `App.tsx` | Hele siden: toppen, siden for adressen og bunnen |
| `navigasjon.ts` | Hovedsidene i menyen, adressen, Tilbake og Frem, og oppstarten |
| `temaer.ts` | Temasidene under «Utforsk naturen», i gruppene fra Figma |
| `tall.ts` | Tallene sidene viser, slått opp ferdige i gull, med tilstanden (henter, feil, ingen, mangler eller ok) |
| `kartlag.ts` | Kartlag bare tvillingen har: skogtyper, tresatt myr og tresatt innmarksbeite fra detaljklassene, og to lag fra kartet over naturskog |
| `md.ts` | Designsystemets komponenter, og ikonene tvillingen trenger i tillegg |
| `komponenter/` | Toppen med meny og kommunevelger, kartet med lagvelger, tabellen med sider, og delene sidene er bygd av (også stolpene, kakediagrammet og ikonene for temaene) |
| `sider/` | Hovedsidene og temasidene |
| `stil.css` | Grunnlaget og delene. Toppen og kartet har egne stilark. |

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
(`src/data/katalog.ts`) er listen over ETL-funksjonene i bronse, sølv og gull, som tabeller: `katalog.bronse.inonbilde`,
`katalog.solv.inon` og `katalog.gull.inon`. Man kaller en tabell med nøkkelen, som regel kommunenummeret. Hver tabell er en
ETL-funksjon med samme navn, og funksjonen henter selv det den bygger på fra katalogen:

```ts
/* gull/inon.ts: tallene på siden om inngrepsfri natur */
export async function inon(nr: string): Promise<Inontall> {
  const [S, land] = await Promise.all([katalog.solv.inon(nr), landareal(nr)]),
    A = arealFraRuter(S.n, S.res, S.skala);
  return { ...byggInon({ ...S, nr, tilstand: 'ok', soner: A.km2, sum: A.sum }, land), sum: A.sum, soner: A.km2 };
}

/* solv/inon.ts: sonen per rute i bildet av kommunen */
export async function inon(nr: string): Promise<InonRuter> {
  return tolketBilde(nr, [await katalog.bronse.inonbilde(nr)], ([P], M) => tolkInon(P, M));
}
```

Katalogen vet ikke hvor dataene kommer fra. Det ser man i ETL-funksjonen: `gull.inon` kaller `solv.inon`, som kaller
`bronse.inonbilde`, som henter bildet fra Miljødirektoratet. Slik kan man følge hvert tall fra siden ned til kilden.

**Katalogen og cachen er to ting.** Katalogen er det interne API-et: hvilke tabeller som finnes, hvordan de kalles, og hvor
ETL-funksjonen står. Alt som hentes, går gjennom den, også bakgrunnskartet (`bronse.bakgrunnsflis`). Cachen er hvor mye som huskes
av svarene, og det står per tabell (`husk`). En tabell med `husk: 0` går gjennom katalogen uten at noe lagres. Bakgrunnskartet er
slik: kartet holder de ferdige flisene selv, og nettleseren har sin egen hurtigbuffer. Et kall som er underveis, deles også når
svaret ikke lagres, så to som spør samtidig, gir ett kall til kilden. Hva som lagres, følger prinsipp 6 under.

**Cachen kan starte utfylt.** En tabell kan ha ferdige svar som ligger lagret sammen med siden (`lagret` i katalogen). Finnes
svaret der, brukes det, og ETL-funksjonen kjøres ikke. Ellers kjøres den som vanlig. Dagens klasser per blokk (`solv.klasser`) er
slik: for 42 kommuner er svaret laget på forhånd av den samme ETL-funksjonen (`verktoy/klasser.ts`) og lagret som små bilder i
`public/klasser/`, både på 21 meter (nivå 9) og 10,6 meter (nivå 10), rundt 3 800 filer og 19 MB. Siden slipper da kallene mot
NIBIO, og nettleseren henter bare filene for valgt kommune og rutestørrelse. Blokkene i kommunen (`solv.blokker`) står i
registeret (`public/klasser.json`). Begge nivåene lages fra kartbildene fra NIBIO. 21 meter regnes ikke av 10 meter, for da ville
klassen avrundes to ganger. Detaljklassene (`solv.detaljklasser`) er lagret på samme måte for Trondheim, Malvik, Røros,
Stavanger, Sandnes og Bodø (`verktoy/klasser.ts --detalj`, i `public/detaljklasser/`, 457 filer og 5,1 MB). For de andre kommunene
lages de av kartbildene fra NIBIO, med den samme funksjonen.

Svarene huskes i cachen (`src/data/cache.ts`), som ETL-koden ikke vet noe om:

- **Les-gjennom.** Ligger svaret i cachen, brukes det. Ellers kjøres ETL-funksjonen, og svaret legges i cachen. Et kall som alt er
  underveis, deles, så to som spør etter det samme, gir ett kall til kilden.
- **Én rad per tabell og kommune**, med status (henter, feil eller ok), svaret, tiden det tok, og om svaret er delvis (regnet ut
  for den delen av kommunen nettleseren har hentet kart for).
- **Det som bygger på brukeren, regnes ut på nytt** når egne områder endres, eller kartet har stått stille med nye fliser. Tabellene
  det gjelder, er merket `brukerstyrt` i katalogen: utbyggingen og alt som bygger på den. Siden viser de gamle tallene til de nye
  er klare.
- **Ingen kopier.** Svarene lagres som de er, uten å gjøres om til tekst. Et nytt svar erstatter det gamle. Unntakene er merket
  voksende: det sammensatte kartet og utbyggingens blokker.
- **Grensene** står per tabell i katalogen (`husk`). Svar fra kildene er store og huskes for noen få kommuner. Gull er små tabeller
  og huskes for flere. Det som er brukt lengst siden, går ut først.
- **Bare så lenge siden er åpen.** Siden lagrer ingenting selv i nettleseren: ingen informasjonskapsler og ingen lokal lagring.
  Cachen er borte når siden lukkes. Nettleserens vanlige hurtigbuffer kan likevel ta vare på svar fra tjenestene, slik hver
  tjeneste selv bestemmer, og da kan neste besøk få svaret uten et nytt kall.
- **Se innholdet.** Under Tekniske valg på siden Om og metode viser «Katalogen» alle tabellene, per lag og gruppert etter
  ETL-filen (i bronse er det kilden, i sølv og gull innholdet), og hvor mye cachen har lagret i hver. «Info» på hver tabell sier
  hva den er og hvor ETL-funksjonen ligger. «Data» viser radene som ligger i cachen. En tabell som ikke lagrer, kan spørres i
  stedet («Spør»), med valgt kommune eller flisen midt i kartet som nøkkel (`eksempel` i katalogen). Det kan hente fra kildene,
  men spør ikke etter noe som ikke finnes, som egne områder som ikke er tegnet. Innholdet vises i to deler: om dataene (status, tiden, og feltene som beskriver dataene, som kommune,
  utsnitt og størrelse) og dataene selv: bildene slik de kom fra kildene, rutenettene i sølv og gull som bilder, lister som tabeller
  og flater som omriss. Til slutt viser «Kartets minne» hvor
  mange ferdige fliser OpenLayers holder på i hvert kartlag (opptil 512 per lag), og omtrent hvor mye minne de tar.

Noen tabeller har ingen ETL-funksjon. Egne områder slik brukeren laget dem (`bronse.egne`) fyller datamotoren. Det sammensatte
kartet (`solv.sammensatt`) har en ETL-funksjon, men er voksende: datamotoren legger inn nye fliser med en gang de er hentet. Hjelpetabellene fyller en ETL-funksjon underveis: utbyggingens blokker og maskene til områdene.

### Prinsippene for dataflyten

1. **Sølv er felles standard, gull setter sammen.** Hver ting, som planen, dagens klasser eller et naturtema, får én datamodell i
   sølv: UTM33, km², de tre klassene og rutenettet. Har den flere kilder, ligger de side om side og uendret, merket så de kan
   skilles. Planen har to: kommuneplanen fra DiBK og egne områder fra brukeren. Sølv velger ikke mellom kildene og setter ikke
   ulike ting sammen. Det gjør gull: at et eget område erstatter kommuneplanen der det ligger, planen lagt oppå dagens klasser,
   verneområdene krysset med utbyggingen, verdsatt natur innenfor det kartlagte. Kommunegrensen og rutenettet er rammen, ikke en
   kilde, så å klippe verneområdene mot kommunen er sølv. Planen ligger i to tabeller, én per kilde, med samme datamodell (`Planruter`):
   `solv.kommuneplanruter` og `solv.egneruter`. Dagens klasser for hele kommunen har også to: blokkene på 21 meter
   (`solv.klasser`, satt sammen i `solv.klassekart`), lagret eller hentet fra NIBIO når kommunen velges, og det sammensatte kartet
   (`solv.sammensatt`). `gull.dagensKlasser` bruker blokkene, og det sammensatte kartet bare når blokkene ikke kan lages.
2. **Gull deles der det kommer inn en ny eller tregere kilde.** Hver tabell i gull svarer på ett spørsmål. Trenger en del av svaret
   noe som kommer senere, som utbyggingen, blir den delen en egen tabell som kaller den første. `gull.verneomrader` er
   verneområdene i kommunen, og `gull.verneomraderIPlan` er planlagt utbygging innenfor dem. Gull kan kalle gull.
3. **Gull venter på alt det bruker.** En ETL-funksjon henter det den bygger på med `await`, og titter ikke etter om noe finnes
   (`.naa()`). Da står hele sporet fra side til kilde i koden. Kan noe mangle uten at svaret er feil, som det kartlagte, står det
   uttrykkelig: `katalog.solv.kartlagt(nr).catch(() => null)`.
4. **Komponentene velger selv hvor store de er, og gjør bare visningslogikk.** En komponent kan lese flere resultater fra gull, for
   eksempel vise listen med en gang og planlagt utbygging når den er regnet ut. Men den lager ingen nye tall. Kommer det et tall ut
   av komponenten som ikke står i gull, er det metode, og det hører hjemme i gull.
5. **Det brukeren gjør, er kilder nederst.** Egne områder (`bronse.egne`) og kartet som er hentet (flisene i
   `bronse.grunnkartflis`) kommer fra brukeren, ikke fra kommunenummeret. `bronse.egne` er den eneste tabellen datamotoren fyller
   selv. Det sammensatte kartet (`solv.sammensatt`) er en ETL-funksjon som leser flisene som er hentet, rett fra cachen. Det er et
   uttalt unntak fra prinsipp 3, for det som er hentet, er selve kilden. Nye fliser legger datamotoren inn med en gang. Ellers
   bestemmer datamotoren bare når: når egne områder endres, eller kartet har stått stille med nye fliser, er gull for kommunen
   utdatert og regnes ut på nytt.
6. **Gull lagres, sølv og bronse bare når noen vil spørre etter dem igjen.** Det er når gull regnes ut på nytt fordi brukeren
   har gjort noe, når kartet spør, og når mange bruker det samme, som kommunegrensen. Ellers hentes sølv og bronse rett før de
   trengs (`husk: 0`). Svarene fra Miljødirektoratet lagres for eksempel ikke, for sølv lagrer det som trengs av dem.

**Utbyggingen er midtpunktet.** Siden handler om ett spørsmål: hvor er det planlagt utbygging, og hva treffer den?
`gull.utbygging` er svaret i rutenettform: kommuneplanen og egne områder lagt oppå dagens klasser, med én rad per rute med planlagt
utbygging. For hvert tema er det en kolonne som sier hvor hver rad ligger (`gull.utbyggingIVerneomrader` og de andre), og tallene
sidene viser, er summer over radene. Slik kunne det vært en faktatabell i Databricks:

```
bronse.planflis (DiBK) → solv.kommuneplanruter          ─┐
bronse.egne (brukeren) → solv.egne → solv.egneruter     ─┼─→ gull.utbygging ─┐
solv.klasser, solv.sammensatt → gull.dagensKlasser      ─┘                   ├─→ gull.utbyggingIVerneomrader ─→ gull.verneomraderIPlan
solv.verneomrader                                       ─────────────────────┘
```

Planen og dagens klasser tolkes per rute i sølv (`solv.kommuneplanruter`, `solv.egneruter` og `klasserIFlis`), og settes sammen i
gull. Kartlagene for
planen, inngrepsfri natur og grått areal bruker de samme funksjonene når de tegner per piksel. Grått areal er
krysset med utbyggingen for seg (`gull.graakryss`), fordi det også teller planlagt utbygging der det alt er bebygd, og grønt i
bebygd område.

Det finnes tre slags tilstand: den som gjelder nå (`app` i datamotoren og `ui` i visningen), cachen, og kartets egen (OpenLayers og
kartkoden, som bare husker det som er laget for å tegne, som ferdige fliser og masker). De ferdige flisene vises i katalogen som
«Kartets minne».

## Datamotoren og brukergrensesnittet

Datamotoren samordner: den velger kommune, fyller kildene fra brukeren og bestemmer når noe skal regnes ut på nytt. Selve
utregningen gjøres i ETL-koden. Brukergrensesnittet viser og tar imot det brukeren gjør. De er skilt slik:

- Tilstanden som gjelder nå, ligger i ett objekt, `app`, i `src/data/motor/tilstand.ts`: valgt kommune og egne områder (valgene
  brukeren har gjort), og hentingen og om kartet flyttes (det tekniske). Alt som er hentet og regnet ut, ligger i cachen.
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
- Det som ikke er tilstand, men en hendelse, sies fra med `varsle` og `lytt`: datamotoren sier fra hver gang det er lagt en ny
  flis inn i det sammensatte kartet, og hvor, så kartet kan fargelegge sin kopi.
- Bronse sier fra om hentingen gjennom én funksjon (`nårHentingEndres`). Datamotoren legger det som vises, i `app`.

### Lasting av filene

Filene i datamotoren, og filene i kartet, kaller hverandre fram og tilbake. Det går bra så lenge ingen fil bruker en annen mens den
lastes. Det kartlagene trenger mens filene lastes (flisnettene og kildene for lag som tegnes i nettleseren), ligger derfor i
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

Sølv og gull er den delen som kan tas med uendret til en annen løsning, og kan kjøres i Node. Flatene gjøres om til ruter ved å
tegne dem i et lerret, og det er det eneste de trenger fra nettleseren (`raster.ts`).

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
| `MdCheckbox`, `MdToggle` | Slør over det som ikke er kartlagt, smale striper, ruter på 10 meter og teknisk visning |
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
eller nettleser, og tar under ett sekund: `npm test`. Funksjonene som tegner i et lerret (`solv/raster.ts` og arealet av verdsatt
natur) trenger nettleseren og prøves av regresjonstesten.

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
- `klasser.ts` lager de lagrede klassene på 21 og 10 meter, for eksempel `npm run klasser -- --fylke 50`, eller bare ett nivå med
  `--niva 9`. Arbeidet gjøres i Chromium med katalogen i `src` (`klasser-side.ts`): verktøyet kaller `solv.blokker` og
  `solv.klasser` uten registeret, så ETL-funksjonene kjøres, og lagrer svaret. Siden bruker da den samme funksjonens svar som
  ferdig svar (`lagret` i katalogen). En blokk koster fire kall mot NIBIO på 21 meter og ett på 10 meter, og de samme kartbildene
  brukes til begge.
- `kommuneareal.ts` lager `public/kommuneareal.json`: flaten til hver kommune med land, ferskvann og hav, regnet av Kartverkets
  grenser én gang. De syntetiske tabellene bruker den til havet i alle kommunene. Den må lages på nytt når kommunene endres.
- `figma-roykt.ts` er røyktesten for tvillingen fra Figma, se over.
- `testdata/testplan-bygg.geojson` er tolv planflater fra Trondheim, hentet fra DiBK, til test av opplasting.

`npm run formater` formaterer koden etter `.prettierrc.json`.

## Kilder

Grunnkart for arealanalyse og kart over grå arealer: NIBIO. Arealtall: SSB, tabell 09594. Kommuneplaner: DiBK.
Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grenser og bakgrunnskart: Kartverket.
