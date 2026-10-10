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

[KOM-I-GANG.md](KOM-I-GANG.md) har hele veien: krav, prøving på mobil, bygg, tester, Python-verktøyene og feilsøking.

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
  generelt/     Det som ikke handler om noe bestemt: flategeometri, minne med fast
                plass, summer og nærmeste farge. Alle lagene i data bruker det.
  bronse/       Bronse: hvordan hver tjeneste brukes. Adresser, parametre og stiler.
                Svarene kommer urørt tilbake. Alt nettverk går gjennom dette laget.
  solv/         Sølv: felles standard, så dataene fra flere kilder kan brukes sammen.
                UTM33, km², de tre klassene, kommunen og rutenettene.
  gull/         Gull: svarene. Arealer, andeler, kryssinger og regnskap, i den formen
                hver side trenger.
  motor/        Datamotoren: tilstanden (app), og hva som hentes og regnes når.
      │
      ▼  leser tilstanden, og kaller datamotoren når brukeren gjør noe
src/ui/
  komponenter/  React: sidene og delene rundt dem. Gjør gull om til tekst, lister,
                stolper og tabeller.
  kart/         OpenLayers: kartlagene, tegning i kartet og trykk i kartet.
```

Sølv og gull får alt som argumenter og gir svaret tilbake. De bruker verken kartet, siden eller nettet, og kan kjøres i Node.

React-komponentene og kartet er to likestilte deler av brukergrensesnittet, og fungerer på samme måte: de abonnerer på tilstanden,
tegner seg på nytt når den endres, og kaller datamotoren når brukeren gjør noe. Datamotoren vet ikke at de finnes.

Slik går en runde, for eksempel når brukeren velger kommune:

1. Brukeren velger Trondheim i `Topp.tsx`. Komponenten kaller `velgKommune` i `data/motor/kommune.ts`.
2. Datamotoren ber bronse hente grensen, tallene fra SSB, kommuneplanen og temaene. Sølv gjør dem om til felles standard, og
   datamotoren legger dem i `app`. Kryssingene med planlagt utbygging tar tid, så datamotoren kjører dem i gull én gang og legger
   svaret i `app`.
3. Hver gang noe er klart, kaller datamotoren `endret()`. React tegner da siden på nytt: hver komponent gir det som ligger i `app`
   til en `bygg`-funksjon i gull, og viser svaret. Samtidig ser hvert kartlag etter om det det tegnes av, er nytt, og tegner seg
   på nytt hvis det er det. Grensen kommer for eksempel som koordinater i `app.grense`, og kartet lager sin egen geometri av dem.

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
| `public/` | Filer som legges ut som de er: listen over kommuner og de lagrede oversiktsbildene |
| `.github/workflows/legg-ut.yml` | Bygger og legger ut siden på GitHub Pages ved push til `main` |
| `.nvmrc` | Node-versjonen, for nvm og for arbeidsflyten |

### Data

Generelt, i `src/data/generelt/`. Det som ikke vet noe om natur, kommuner eller kilder. Hver ting finnes bare her, så alle lagene
regner likt. Filene importerer ingenting.

| Fil | Innhold |
|---|---|
| `geometri.ts` | Flater og utsnitt: typene, arealet med fortegn og omløpsretning, utsnittet som rommer en flate, snitt og overlapp |
| `minne.ts` | Minne med fast plass (`husk`): svar fra kildene og resultater for kommuner som er valgt før |
| `tall.ts` | Summen av en liste tall (`summen`) |
| `farge.ts` | Hvilken av noen farger en farge ligger nærmest (`naermesteFarge`) |

Bronse, i `src/data/bronse/`. Én fil per tjeneste, og felles filer for hvordan det hentes og for kartjenester etter WMS.

| Fil | Innhold |
|---|---|
| `henting.ts` | Henting med minne, kall-loggen, og køen for kartbilder (høyst fire kall om gangen per kilde). Sier fra om hva som skjer, uten å vite hvem som lytter. |
| `wms.ts` | Adressen til et kartbilde eller et oppslag fra en kartjeneste etter WMS 1.3.0, for et utsnitt i UTM33 |
| `ssb.ts` | SSB, tabell 09594, med det eldre API-et som reserve |
| `kartverket.ts` | Fylker og kommuner, kommunegrensene, oppslag av kommune i et punkt, og bakgrunnskartet |
| `nibio-grunnkart.ts` | Nasjonalt grunnkart for arealanalyse: kartbildene med de seks klassene i rene farger, og de lagrede oversiktsbildene |
| `dibk-kommuneplan.ts` | Kommuneplanene hos DiBK: flatene for framtidig utbygging, hvor mye av kommunen planen dekker, og hvilken plan det er |
| `mdir-naturtema.ts` | Miljødirektoratets verneområder, villreinområder, naturtyper med KU-verdi og det kartlagte området |
| `mdir-inon.ts` | Inngrepsfrie naturområder, som ett bilde av kommunen |
| `nibio-graa.ts` | Kart over grå arealer, som bilder av kommunen og som fliser |
| `planfil.ts` | En opplastet planfil, lest i nettleseren og gjort om til UTM33 |

Sølv, i `src/data/solv/`. METODE.md forklarer metoden bak hver fil.

| Fil | Innhold |
|---|---|
| `felles.ts` | UTM33, flisnettet, rutenettene, alle terskler, og målestokken i UTM: arealet av en flate i km² i terrenget |
| `projeksjoner.ts` | Projeksjonene siden kjenner, og omregning til UTM33 |
| `raster.ts` | Fra flater og bilder til ruter: flatene tegnes i et lerret, bildene leses inn, og dekningen regnes om til areal. Den eneste filen i sølv og gull som bruker nettleseren. |
| `klasser.ts` | Bebygd, jordbruk og natur: koblingen til SSBs arealklasser og grunnkartets økosystemtyper, og tolking av fargene i kartbildene |
| `ssb.ts` | SSB-svarene gjort om til km² per klasse, for nyeste år og 2017 |
| `planrutenett.ts` | Kommuneplanen lagt oppå dagens klasser i ruter på 21 meter, med smale striper tatt bort, og om kommunen har plan |
| `egne.ts` | Egne områder: hvilke flater som er utbygging, og hvordan de legges inn i planrutenettet |
| `temaer.ts` | Verneområder, villrein og verdsatt natur: flatene klippet mot kommunen, og som masker i et rutenett |
| `inon.ts` | Inngrepsfri natur: sone per rute |
| `graa.ts` | Grått areal: trinn per rute etter andel vegetasjon |

Gull, i `src/data/gull/`. Funksjonene som heter `bygg` noe, gir det en side viser.

| Fil | Innhold |
|---|---|
| `felles.ts` | Andel i prosent, areal fra antall ruter avrundet til nærmeste 10 dekar, og tilstanden for temaene som hentes som ett bilde |
| `regnskap.ts` | Utbredelsen nå, forskjellen fra 2017, regnskapsoppstillingen, og land og vann |
| `planlagt.ts` | Natur og jordbruk som planen setter av, med andeler, og kortversjonen til oversikten |
| `egne.ts` | Hva som ligger i hvert eget område, og radene som sammenligner med kommuneplanen |
| `temaer.ts` | Arealet per verdikategori, kryssingen med planen, og tallene på temasidene |
| `inon.ts` | Tallene på siden |
| `graa.ts` | Kryssingen med planen, og tallene på siden |

Datamotoren, i `src/data/motor/`.

| Fil | Innhold |
|---|---|
| `tilstand.ts` | Tilstanden (`app`), lageret som sier fra når noe er endret (`endret`, `abonner`), og tidtakingen |
| `kommune.ts` | Listen over kommuner, og valg av kommune: alt som hentes og regnes ut når en kommune velges |
| `tall.ts` | Tallene fra SSB |
| `grunnkart.ts` | Dagens klasser: det lagrede oversiktsbildet, det sammensatte kartet av flisene som er hentet, og klassene i én flis |
| `plan.ts` | Om DiBK har kommuneplanen, og samordningen av planrutenettet |
| `naturtema.ts` | Verneområder, villrein og verdsatt natur: hvilke temaer som finnes, hentingen og kryssingen med planen |
| `kommunebilde.ts` | Flyten for temaene som hentes som ett bilde av kommunen: minnet, hentingen, tolkingen og arealet |
| `inon.ts` | Inngrepsfri natur: oppsettet for kommunebildet |
| `graa.ts` | Grått areal: oppsettet for kommunebildet, og kryssingen med planen |
| `egne.ts` | Egne områder: tegnede og opplastede, og det radene i sammenligningen bygges av |

### Brukergrensesnittet

Felles, i `src/ui/`:

| Fil | Innhold |
|---|---|
| `tilstand.ts` | Det som bare gjelder visningen (`ui`): valgt side, hva som er slått på i kartet, og hva kartet sier om seg selv |
| `sider.ts` | Sidene, valg av side, adressen, og oppstarten |
| `farger.ts` | Fargene i kartet og i tegnforklaringene |
| `tekst.ts` | Hvordan tall og tekst skrives: dekar, prosent, endring med fortegn, tall med bokstaver og oppramsing |
| `teknisk.ts` | Formen på `window.motor`: det siden gjør tilgjengelig med `?teknisk`, til feilsøking og regresjonstesten |

Kartet, i `src/ui/kart/`. Hvert kartlag har sin fil og følger tilstanden selv.

| Fil | Innhold |
|---|---|
| `ol.ts` | Delene av OpenLayers som brukes, samlet som `ol` |
| `felles.ts` | Flisnettene, hva kartet holder på med, og hjelpere for lag som tegnes i nettleseren |
| `kart.ts` | Selve kartet: bakgrunn, grense og status, og hvordan lagene settes sammen |
| `klipping.ts` | Klipping mot kommunen: utenfor valgt kommune vises bare bakgrunnskartet |
| `trykk.ts` | Trykk i kartet: hva som er i punktet, og bytte til kommunen man trykket i |
| `maaling.ts` | Måling av hvor jevnt kartet går, til teknisk visning |
| `fargelegging.ts` | Fargelegging av kartbildene fra NIBIO, fra de rene fargene til kartfargene |
| `grunnkart.ts` | Dagens klasser i kartet: flisene fra NIBIO, og oversiktsbildet zoomet ut |
| `plan.ts` | Planlagt utbygging |
| `naturtema.ts` | Verneområder, villrein og verdsatt natur, sløret over det som ikke er kartlagt, og markering av ett område |
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
| `Innhold.tsx` | Den valgte siden. Alle sidene ligger i siden, men bare den valgte vises. |
| `Oversikt.tsx` | Det viktigste fra hver side: navnet som lenke, ett tall og en kort forklaring |
| `Regnskap.tsx` | Utbredelsesregnskapet: natur nå, forskjellen fra 2017 som stolper, regnskapsoppstillingen, og land og vann |
| `Temaside.tsx` | Toppen og rammen som alle temasidene har: navnet, arealet i kommunen, andelen av landarealet og kilden |
| `Naturtema.tsx` | Sidene for verneområder, villrein og verdsatt natur, med lister over områdene, og ordene sidene bruker om hvert tema |
| `Inon.tsx` | Siden for inngrepsfri natur |
| `Graa.tsx` | Siden for grått areal |
| `Framtid.tsx` | Utvikling fremover: planlagt utbygging og egne områder |
| `Egne.tsx` | Egne områder og opplastet plan, med tabellene som sammenligner med kommuneplanen |
| `Om.tsx` | Om og metode: kall-loggen, hvordan klassene er satt sammen, om siden og tekniske valg |
| `deler.tsx` | Det designsystemet ikke har: fargeruter, stolper, tegnforklaringer, linjer i en liste med tall, lenker mellom sidene og tabeller med tall |
| `md.ts` | Komponentene fra designsystemet som siden bruker |
| `lager.ts` | Kroken som kobler komponentene til tilstanden |

## Dokumentasjon

- [KOM-I-GANG.md](KOM-I-GANG.md) viser hvordan man kjører, bygger og tester siden lokalt.
- [METODE.md](METODE.md) forklarer hver analyse med samme oppsett (spørsmål, data inn, steg, resultat, usikkerhet, kontroll og
  kode), i samme inndeling som `src/data/`.
- [AVHENGIGHETER.md](AVHENGIGHETER.md) lister biblioteker, tjenester og verktøy, med lisenser og det som gjelder sikkerhet og
  personvern.

Begge må oppdateres når en metode, en kilde eller et bibliotek endres.

## Datamotoren og brukergrensesnittet

Datamotoren henter og regner ut. Brukergrensesnittet viser og tar imot det brukeren gjør. De er skilt slik:

- Tilstanden for dataene ligger i ett objekt, `app`, i `src/data/motor/tilstand.ts`: valgt kommune, grensen, tallene fra SSB,
  planrutenettet, egne områder og hentingen. Temaene fra Miljødirektoratet har dataene sine i `NATURTEMA`, ett objekt per tema.
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

De store rutenettene og bildene ligger i `app` sammen med tallene. Det går fordi siden aldri sammenligner eller kopierer tilstanden,
bare leser den.

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
| `src/data/motor/` | `hent`, `sjekk`, `regn`, `velg` | Samordner. Ber bronse hente, kaller sølv og gull, legger svaret i tilstanden og sier fra. |
| `src/ui/kart/` | `tegn`, `vis`, `last` | Tegner kartet: lag, fliser og markeringer. Regner ikke ut nye tall. |
| `src/ui/komponenter/` | Store bokstaver | React-komponenter: gjør gull om til tekst, tabeller og stolper. |

Sølv og gull er den delen som kan tas med uendret til en annen løsning, og kan kjøres i Node. Flatene gjøres om til ruter ved å
tegne dem i et lerret, og det er det eneste de trenger fra nettleseren (`raster.ts`).

`node verktoy/sjekk-lag.ts` kontrollerer at lagene bare bruker hverandre i riktig retning: data importerer aldri fra ui, generelt
importerer ingenting, sølv og gull holder seg for seg selv, bronse og datamotoren bruker ikke OpenLayers eller React, React-komponentene henter ikke fra bronse og
tar bare navn og faste verdier fra sølv, og det har ikke havnet regnefunksjoner i datamotoren.

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
2. `python3 verktoy/utgave.py` setter nytt utgavemerke, som vises under «Vis teknisk informasjon».
3. `npm run sjekk`, `npm test` og `npm run regresjon` (se under).
4. Commit og push til `main`.

Arbeidsflyten `.github/workflows/legg-ut.yml` («Bygg og legg ut») kjører ved hver push til `main`: den installerer pakkene fra
`package-lock.json`, kjører `npm run sjekk` og `npm test`, bygger og legger ut `dist/` på GitHub Pages. Den kan også startes for hånd under
Actions. Feiler sjekken, testene eller bygget, blir ingenting lagt ut, og siden som ligger ute, står urørt.

GitHub Pages må ha «GitHub Actions» som kilde (Settings → Pages → Build and deployment → Source). Står den på «Deploy from a
branch», legger GitHub ut repoet slik det er, uten bygg, og siden blir blank.

Hver action i arbeidsflyten er låst til en bestemt commit, med versjonen i en kommentar. Ved oppgradering byttes både
commit og kommentar.

## Tester

Testene ligger i `test/`, én fil for hvert av generelt, sølv og gull. De prøver regnefunksjonene med små, faste eksempler, som
arealet av et kvadrat med hull, tolking av fargene og avrunding til 10 dekar. De bruker Nodes egen testkjører, trenger verken nett
eller nettleser, og tar under ett sekund: `npm test`. Funksjonene som tegner i et lerret (`solv/raster.ts` og arealet av verdsatt
natur) trenger nettleseren og prøves av regresjonstesten.

## Verktøy

Verktøyene ligger i `verktoy/` og trengs bare under utvikling.

- `utgave.py` setter utgavemerke, se over.
- `regresjon.ts` bygger siden, kjører et fast sett handlinger i en mobilnettleser for Trondheim, Surnadal og Oslo, og lagrer
  tallene datamotoren har regnet ut, teksten siden viser og skjermbilder av kartet. `npm run regresjon` kjører den, og
  `node verktoy/regresjon.ts ut/ny --mot HEAD` sammenligner arbeidskopien med siste commit. Tallene kommer fra åpne tjenester og endrer seg over tid, så de to kjøringene må
  tas samme dag. Miljødirektoratet sender lokalitetene i tilfeldig rekkefølge, men sølv sorterer dem på en fast måte, så to
  kjøringer av samme kode gir nøyaktig like tall.
- `motortall.ts` henter tallene fra datamotoren til regresjonstesten. Med `?teknisk` gjør siden tilstanden, temaene og kartet
  tilgjengelig som `window.motor` (`src/ui/teknisk.ts`).
- `sjekk-lag.ts` kontrollerer at lagene bare bruker hverandre i riktig retning, se over. `npm run sjekk` kjører typesjekken
  (`tsc`) for `src` og `verktoy`, og så denne.
- `oversiktsbilde.py` lager de lagrede oversiktsbildene, for eksempel `python3 verktoy/oversiktsbilde.py --fylke 50`.
  Én kommune koster 4 til 16 kall mot NIBIO.
- `testdata/testplan-bygg.geojson` er tolv planflater fra Trondheim, hentet fra DiBK, til test av opplasting.

`npm run formater` formaterer koden etter `.prettierrc.json`.

## Kilder

Grunnkart for arealanalyse og kart over grå arealer: NIBIO. Arealtall: SSB, tabell 09594. Kommuneplaner: DiBK.
Verneområder, villreinområder, naturtyper og inngrepsfri natur: Miljødirektoratet. Grenser og bakgrunnskart: Kartverket.
