/* Katalogen: ETL-pipelinen, som en liste over tabeller i tre lag, slik Unity Catalog har katalog.skjema.tabell. Hver tabell er en
   ETL-funksjon i bronse, sølv eller gull, med samme navn som tabellen: katalog.solv.inon er inon() i solv/inon.ts. Man kaller
   tabellen med nøkkelen, som regel kommunenummeret: katalog.gull.verneomrader('5001').

   Hvor dataene kommer fra, ser man i ETL-funksjonen selv: den kaller katalogen etter det den bygger på. Åpner man
   gull.verneomrader, ser man at den kaller solv.verneomrader, og der at den kaller bronse.verneomrader, og så videre ned til kilden.

   Katalogen er det interne API-et. Svarene huskes i cachen (cache.ts), som er noe annet. Her står bare et kort, lesbart navn
   (tittel), hva tabellen er (om), og hvor mange nøkler som huskes (husk). Med husk 0 går kallet gjennom katalogen uten at noe lagres. Svar fra
   kildene og tolkingen av dem er store og huskes for noen få kommuner. Gull er små tabeller og huskes for flere. Tabeller merket
   brukerstyrt bygger på det brukeren gjør, og regnes ut på nytt når datamotoren sier fra om at det er endret.
   Tabeller uten ETL-funksjon er kildene fra brukeren, som datamotoren fyller (bronse.egne), og hjelpetabeller som
   en ETL-funksjon fyller underveis (gull.utbyggingsblokker og solv.naturoppslag).

   ETL-funksjonene skal være vanlige funksjonserklæringer (export async function), ikke piler: katalogen og ETL-filene bruker hverandre,
   og bare funksjonserklæringer finnes før filene er ferdig lastet. */
import { glem, tabell, type Datasettinfo, type Kildeinfo, type Tabell, type Utgangspunkt } from './cache.ts';
import * as E from './bronse/endepunkter.ts';
import * as dibk from './bronse/dibk-kommuneplan.ts';
import * as kartverket from './bronse/kartverket.ts';
import * as mdirInon from './bronse/mdir-inon.ts';
import * as mdirNatur from './bronse/mdir-naturtema.ts';
import * as nibioGraa from './bronse/nibio-graa.ts';
import * as nibioGrunnkart from './bronse/nibio-grunnkart.ts';
import * as ssb from './bronse/ssb.ts';
import * as solvGraa from './solv/graa.ts';
import * as solvGrunnkart from './solv/grunnkart.ts';
import * as solvInon from './solv/inon.ts';
import * as solvKommune from './solv/kommune.ts';
import * as solvPlan from './solv/kommuneplan.ts';
import * as solvPunkt from './solv/punkt.ts';
import * as solvSsb from './solv/ssb.ts';
type solvSsbJson = solvSsb.JsonStat;
import * as solvTemaer from './solv/temaer.ts';
import { BITNIVA, PLANNIVA, flisVed, flisnavn, type Fylke, type Flis, type Planruter } from './solv/felles.ts';
import { INON_NYESTE } from './solv/tolking.ts';
import * as solvEgne from './solv/egne.ts';
import type { Egetinn } from './solv/egne.ts';
import type { Omradesok } from './solv/temaer.ts';
import type { Klasseregister } from './bronse/nibio-grunnkart.ts';
import * as gullEgne from './gull/egne.ts';
import * as gullGraa from './gull/graa.ts';
import * as gullGrunnkart from './gull/grunnkart.ts';
import * as gullInon from './gull/inon.ts';
import * as gullOkosystemer from './gull/okosystemer.ts';
import * as gullSyntetisk from './gull/syntetisk.ts';
import * as gullPlan from './gull/planlagt.ts';
import * as gullRegnskap from './gull/regnskap.ts';
import * as gullTemaer from './gull/temaer.ts';
import * as gullUtbygging from './gull/utbygging.ts';
import type { Blokk, Utbygging } from './gull/utbygging.ts';

/* Til «Spør» i katalogvisningen: flisen midt i kartet på nivå z, eller på kartets eget nivå når z ikke er gitt. null før kartet
   finnes. */
const flisMidt =
  (z?: number) =>
  (u: Utgangspunkt): Flis | null =>
    u.midt ? flisVed(u.midt, z === undefined ? u.z : z) : null;

/* Kildene: hvem som eier dataene, datasettet, hvor det er beskrevet (Geonorge eller data.norge.no) og lisensen. Lisensene er
   kontrollert mot Geonorge og data.norge.no 11. oktober 2026, bakgrunnskartet 19. oktober (data.norge.no oppgir det som tjeneste for
   Kartverkets kartdata, som har CC BY 4.0). Brukes av tabellene
   i bronse (kilde) til infoknappene og METODE.md. */
export const KILDE = {
  kartverket: {
    navn: 'Kartverket',
    datasett: 'Administrative enheter, kommuner (Kommuneinfo-API-et)',
    adresse: 'https://kartkatalog.geonorge.no/metadata/041f1e6e-bdbc-4091-b48f-8a5990f3cc5b',
    lisens: 'CC BY 4.0'
  },
  bakgrunn: {
    navn: 'Kartverket',
    datasett: 'Topografisk norgeskart, gråtone (WMTS-cache)',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/8f381180-1a47-4453-bee7-9a3d64843efa',
    lisens: 'CC BY 4.0'
  },
  ssb: {
    navn: 'Statistisk sentralbyrå (SSB)',
    datasett: 'tabell 09594, Arealbruk og arealressurser',
    adresse: 'https://www.ssb.no/statbank/table/09594',
    lisens: 'CC BY 4.0'
  },
  grunnkart: {
    navn: 'NIBIO',
    datasett: 'Nasjonalt grunnkart for arealanalyse, årsversjon 2025',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/28c28e3a-d88f-4a34-8c60-5efe6d56a44d',
    lisens: 'Norge digitalt begrenset'
  },
  graa: {
    navn: 'NIBIO, Miljødirektoratet, Kartverket og SSB',
    datasett: 'Kart over grå arealer, testversjon 1 (2025)',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/c5f09d79-1546-495c-8b36-91efd4008bd7',
    lisens: 'Norge digitalt-lisensen'
  },
  dibk: {
    navn: 'Direktoratet for byggkvalitet (DiBK)',
    datasett: 'Kommuneplaner, WMS-tjeneste',
    adresse: 'https://data.norge.no/data-services/65ca688d-3193-336f-b029-3344106dd138',
    lisens: 'Norge digitalt-lisensen'
  },
  vern: {
    navn: 'Miljødirektoratet',
    datasett: 'Naturvernområder',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/5857ec0a-8d2c-4cd8-baa2-0dc54ae213b4',
    lisens: 'NLOD 2.0'
  },
  villrein: {
    navn: 'Miljødirektoratet',
    datasett: 'Villreinområder',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/fc59e9a4-59df-4eb3-978a-1c173b84bf4e',
    lisens: 'NLOD 2.0'
  },
  verdsatt: {
    navn: 'Miljødirektoratet',
    datasett: 'Naturtyper – verdsatte (naturtyper med KU-verdi)',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/64cbb884-a19d-4356-a114-380cfe4a7314',
    lisens: 'NLOD 2.0'
  },
  nin: {
    navn: 'Miljødirektoratet',
    datasett: 'Naturtyper på land (NiN), dekningskartet',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/eb48dd19-03da-41e1-afd9-7ebc3079265c',
    lisens: 'NLOD 2.0'
  },
  inon: {
    navn: 'Miljødirektoratet',
    datasett: 'Inngrepsfri natur i Norge',
    adresse: 'https://kartkatalog.geonorge.no/metadata/uuid/277bda73-b924-4a0e-b299-ea5441de2d3b',
    lisens: 'NLOD 2.0'
  }
} satisfies Record<string, Kildeinfo>;

/* Datasettene i sølv. Et datasett er ett sett data fra virkeligheten, gjort om til vår standard. Tabellene i bronse og sølv som henter
   og lager det, hører til datasettet (datasett på tabellen) på én av to måter:
   - data: det innholdet i datasettet lages av
   - støttedata (stotte på tabellen, med hva den brukes til): det som trengs for å hente og forstå dataene, som en sjekk av om
     dataene finnes, en oversikt som gjør hentingen raskere, opplysninger om dataene, eller oppslag når man trykker i kartet.
   Støttedata kan favne bredere enn dataene, for eksempel hele kommuneplanen, men tallene regnes ikke av dem. Foreløpig er bare
   kommuneplanen delt inn slik. */
export const DATASETT = {
  utbyggingsareal: {
    navn: 'Areal satt av til framtidig utbygging i kommuneplanen',
    om: 'For hver rute på 10,6 meter i kommunen: om ruta ligger i areal kommuneplanen setter av til framtidig bebyggelse og anlegg, eller samferdsel. Laget av kommuneplanene hos DiBK. Det er ikke hele kommuneplanen: andre arealformål og nåværende byggeområder er valgt bort.'
  }
} satisfies Record<string, Datasettinfo>;

export const katalog = {
  bronse: {
    kommuner: tabell<void, Fylke[]>({
      lag: 'bronse',
      navn: 'kommuner',
      endepunkt: 'kommuner.json',
      tittel: 'Fylker og kommuner',
      om: 'fylkene og kommunene, sortert etter navn',
      teknisk: true,
      forklaring:
        'Listen over fylker og kommuner med nummer og navn. Den ligger lagret sammen med siden, og hentes fra Kartverket hvis den mangler.',
      kilde: KILDE.kartverket,
      husk: 1,
      etl: kartverket.kommuner
    }),
    kommunegrense: tabell({
      lag: 'bronse',
      navn: 'kommunegrense',
      endepunkt: `${E.KOMMUNEINFO}/kommuner/{kommunenummer}/omrade`,
      tittel: 'Kommunegrensen',
      om: 'kommunegrensen fra Kartverket som GeoJSON',
      forklaring: 'Kommunegrensen som flate i UTM 33.',
      kilde: KILDE.kartverket,
      husk: 6,
      etl: kartverket.kommunegrense
    }),
    bakgrunnsflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'bakgrunnsflis',
      endepunkt: `${E.BAKGRUNN}/{z}/{y}/{x}.png`,
      tittel: 'Bakgrunnskartet',
      om: 'fliser av Kartverkets topografiske kart i gråtoner, kalt med flisen [z, x, y]. Lagres ikke: kartet holder de ferdige flisene selv, og nettleseren har sin egen hurtigbuffer.',
      kilde: KILDE.bakgrunn,
      husk: 0,
      nokkel: flisnavn,
      etl: kartverket.bakgrunnsflis,
      eksempel: flisMidt()
    }),
    kommuneIPunkt: tabell<number[], { kommunenummer: string }>({
      lag: 'bronse',
      navn: 'kommuneIPunkt',
      endepunkt: `${E.KOMMUNEINFO}/punkt`,
      tittel: 'Kommune i et punkt',
      om: 'hvilken kommune et punkt i kartet ligger i, fra Kartverket, når man trykker utenfor valgt kommune. Nøkkel: punktet i hele meter.',
      kilde: KILDE.kartverket,
      husk: 20,
      nokkel: kartverket.punktNokkel,
      etl: kartverket.kommuneIPunkt
    }),
    planIPunkt: tabell<number[], unknown>({
      lag: 'bronse',
      navn: 'planIPunkt',
      datasett: DATASETT.utbyggingsareal,
      stotte:
        'Oppslag når man trykker i kartet: flatene i kommuneplanen i punktet, med alle arealformål. Brukes ikke i tallene.',
      endepunkt: E.KOMMUNEPLAN,
      tittel: 'Kommuneplanen i et punkt',
      om: 'flatene i kommuneplanene i et punkt fra DiBK, med egenskapene og flaten, som GeoJSON. Til detaljene ved trykk i kartet. Lagres ikke: sølv lagrer det som trengs. Nøkkel: punktet i hele meter.',
      forklaring:
        'Oppslag i kommuneplanene fra DiBK i punktet man har trykket på (GetFeatureInfo), med alle arealformål.',
      kilde: KILDE.dibk,
      husk: 0,
      nokkel: kartverket.punktNokkel,
      etl: dibk.planIPunkt
    }),
    grunnkartIPunkt: tabell<number[], string>({
      lag: 'bronse',
      navn: 'grunnkartIPunkt',
      endepunkt: E.GRUNNKART,
      tittel: 'Grunnkartet i et punkt',
      om: 'grunnkartet i et punkt fra NIBIO, med økosystemtype, arealdekke, skogbonitet, grunnforhold og kilden, som GML. Til detaljene ved trykk i kartet. Lagres ikke. Nøkkel: punktet i hele meter.',
      forklaring: 'Oppslag i grunnkartet fra NIBIO i punktet man har trykket på (GetFeatureInfo).',
      kilde: KILDE.grunnkart,
      husk: 0,
      nokkel: kartverket.punktNokkel,
      etl: nibioGrunnkart.grunnkartIPunkt
    }),
    inonIPunkt: tabell<number[], unknown>({
      lag: 'bronse',
      navn: 'inonIPunkt',
      endepunkt: E.INON,
      tittel: 'Inngrepsfri natur i et punkt',
      om: 'sonen for inngrepsfri natur i et punkt fra Miljødirektoratet, som GeoJSON. Til detaljene ved trykk i kartet. Lagres ikke. Nøkkel: punktet i hele meter.',
      forklaring: 'Oppslag i kartet over inngrepsfri natur i punktet man har trykket på (GetFeatureInfo).',
      kilde: KILDE.inon,
      husk: 0,
      nokkel: kartverket.punktNokkel,
      etl: mdirInon.inonIPunkt
    }),
    temaegenskaper: tabell<[string, number], unknown>({
      lag: 'bronse',
      navn: 'temaegenskaper',
      endepunkt: `${E.MILJO}{tjeneste}/MapServer/{lag}/query`,
      tittel: 'Alle feltene for et område',
      om: 'alle feltene for ett område i et naturtema fra Miljødirektoratet, kalt med [tema, OBJECTID]. Til detaljene ved trykk i kartet. Lagres ikke. Nøkkel: «tema/OBJECTID».',
      forklaring: 'Alle feltene for området man har trykket på, slått opp med OBJECTID i karttjenesten.',
      husk: 0,
      nokkel: ([t, id]) => `${t}/${id}`,
      etl: mdirNatur.temaegenskaper
    }),
    arealtall: tabell({
      lag: 'bronse',
      navn: 'arealtall',
      endepunkt: E.SSB,
      tittel: 'Arealtall fra SSB',
      om: 'arealet per klasse i nyeste år fra SSB, som JSON-stat',
      forklaring: 'Arealet i km² per arealklasse i nyeste år. Svarer ikke API-et, spørres det eldre (v0) om det samme.',
      kilde: KILDE.ssb,
      husk: 6,
      etl: ssb.arealtall
    }),
    arealtidsserie: tabell({
      lag: 'bronse',
      navn: 'arealtidsserie',
      endepunkt: E.SSB,
      tittel: 'Arealtall fra SSB for 2017',
      om: 'arealet per klasse fra 2017 fra SSB, som JSON-stat',
      forklaring:
        'Det samme fra 2017, med SSBs sammenslåtte tidsserier, så tallene gjelder dagens kommune også der kommuner er slått sammen.',
      kilde: KILDE.ssb,
      husk: 6,
      etl: ssb.arealtidsserie
    }),
    arealdetaljer: tabell({
      lag: 'bronse',
      navn: 'arealdetaljer',
      endepunkt: E.SSB,
      tittel: 'Arealklassene fra SSB, hver for seg',
      om: 'arealet fra 2017 for hver av SSBs arealklasser for seg, som JSON-stat. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Det samme som arealtidsserie, men med hver arealklasse for seg i stedet for summert: bebygd per formål, fulldyrka og ikke fulldyrka jord, skog per treslag og resten av naturen per klasse.',
      kilde: KILDE.ssb,
      husk: 6,
      etl: ssb.arealdetaljer
    }),
    arealAlle: tabell<void, solvSsbJson>({
      lag: 'bronse',
      navn: 'arealAlle',
      endepunkt: E.SSB,
      tittel: 'Arealklassene fra SSB for alle kommuner',
      om: 'arealet i 2017 og 2024 for hver av SSBs arealklasser for seg, for alle kommunene i ett kall, som JSON-stat. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Det samme som arealdetaljer, men for alle kommunene og bare 2017 og 2024: rundt 100 kB. Med SSBs sammenslåtte tidsserier, så tallene gjelder dagens kommuner.',
      kilde: KILDE.ssb,
      husk: 1,
      etl: ssb.arealAlle
    }),
    grenseregister: tabell<void, kartverket.Grenseregister | null>({
      lag: 'bronse',
      navn: 'grenseregister',
      endepunkt: 'kommunegrenser.json',
      tittel: 'Register over lagrede kommunegrenser',
      om: 'kommunene som har kommunegrensen og andelen per rute i bitene lagret sammen med siden, og når de er hentet',
      teknisk: true,
      forklaring: 'Kommunene som har grensen og andelen per rute lagret sammen med siden.',
      husk: 1,
      etl: kartverket.grenseregister
    }),
    grensefil: tabell<string, kartverket.LagretGrense | null>({
      lag: 'bronse',
      navn: 'grensefil',
      endepunkt: 'kommunegrenser/{kommunenummer}.json',
      tittel: 'Lagret kommunegrense',
      om: 'kommunegrensen slik den er lagret sammen med siden: svaret fra solv.grense. null når kommunen ikke er lagret.',
      teknisk: true,
      forklaring:
        'Kommunegrensen som flerflate i UTM 33, med utsnittet og flaten i km², laget på forhånd med den samme funksjonen (verktoy/kommunegrenser.ts), så ingenting må hentes fra Kartverket.',
      husk: 6,
      etl: kartverket.grensefil
    }),
    andelfil: tabell<string, ArrayBuffer | null>({
      lag: 'bronse',
      navn: 'andelfil',
      endepunkt: 'kommunegrenser/{kommunenummer}-andel.bin.gz',
      tittel: 'Lagret andel per rute',
      om: 'kommunens andel per rute i bitene slik den er lagret sammen med siden: svaret fra solv.kommunebiter som bytes, pakket med gzip. null når kommunen ikke er lagret.',
      teknisk: true,
      forklaring:
        'Hvor stor del av hver rute som ligger i kommunen, laget på forhånd med den samme funksjonen (verktoy/kommunegrenser.ts), så den ikke må regnes ut når kommunen velges.',
      husk: 3,
      etl: kartverket.andelfil
    }),
    kommuneareal: tabell<void, kartverket.Kommuneareal>({
      lag: 'bronse',
      navn: 'kommuneareal',
      endepunkt: 'kommuneareal.json',
      tittel: 'Flaten til kommunene',
      om: 'flaten til hver kommune i km², med land, ferskvann og hav, regnet av Kartverkets kommunegrenser én gang og lagret sammen med siden (kommuneareal.json). Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Flaten innenfor hver kommunegrense, rettet for målestokken i UTM 33, som solv.grense gir for én kommune. Laget av verktoy/kommuneareal.ts.',
      kilde: KILDE.kartverket,
      husk: 1,
      etl: kartverket.kommuneareal
    }),
    grunnkartflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'grunnkartflis',
      endepunkt: E.GRUNNKART,
      tittel: 'Kartbilder av grunnkartet',
      om: 'kartbilder av dagens arealklasser fra NIBIO, 512 x 512 piksler, kalt med flisen [z, x, y]. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Kartbilder av dagens arealklasser, 512 × 512 piksler per flis, i egen stil uten kantstrek (se Arealklassene).',
      kilde: KILDE.grunnkart,
      husk: 400,
      nokkel: flisnavn,
      etl: nibioGrunnkart.grunnkartflis
    }),
    detaljflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'detaljflis',
      endepunkt: E.GRUNNKART,
      tittel: 'Kartbilder av grunnkartet med detaljklasser',
      om: 'kartbilder av de 19 detaljklassene fra NIBIO, 512 x 512 piksler med 24 bit farge, kalt med flisen [10, x, y]. Stilen er for lang til å stå i adressen, så de hentes med POST. Brukes foreløpig bare til å lage de lagrede detaljklassene. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Kartbilder av grunnkartet med 19 klasser: skogen delt etter treslag og underlag (tresatt myr og tresatt innmarksbeite), jordbruket i dyrket mark og grasmark, og naturen ellers etter økosystemtype. Hver klasse i sin farge, med 24 bit farge.',
      kilde: KILDE.grunnkart,
      husk: 50,
      nokkel: flisnavn,
      etl: nibioGrunnkart.detaljflis
    }),
    detaljregister: tabell<void, Klasseregister | null>({
      lag: 'bronse',
      navn: 'detaljregister',
      endepunkt: 'detaljklasser.json',
      tittel: 'Register over lagrede detaljklasser',
      om: 'kommunene som har detaljklassene lagret sammen med siden, og blokkene på nivå 10 for hver',
      teknisk: true,
      forklaring: 'Kommunene som har detaljklassene lagret sammen med siden, og blokkene for hver.',
      husk: 1,
      etl: nibioGrunnkart.detaljregister
    }),
    detaljfil: tabell<Flis, ArrayBuffer | null>({
      lag: 'bronse',
      navn: 'detaljfil',
      endepunkt: 'detaljklasser/{z}/{x}/{y}.png',
      tittel: 'Lagrede detaljklasser per blokk',
      om: 'detaljklassene i en blokk på nivå 10 slik de er lagret sammen med siden, som PNG med fargetabell, kalt med blokken [10, x, y]. null når blokken ikke er lagret. Nøkkel: blokken som «z/x/y».',
      teknisk: true,
      forklaring:
        'Detaljklassene i en blokk slik de er lagret sammen med siden. Det er svaret fra solv.detaljklasser, laget på forhånd med den samme funksjonen (verktoy/klasser.ts --detalj).',
      husk: 0,
      nokkel: flisnavn,
      etl: nibioGrunnkart.detaljfil
    }),
    klasseregister: tabell<void, Klasseregister | null>({
      lag: 'bronse',
      navn: 'klasseregister',
      endepunkt: 'klasser.json',
      tittel: 'Register over lagrede klasser',
      om: 'kommunene som har dagens klasser lagret sammen med siden, og blokkene på nivå 10 for hver',
      teknisk: true,
      forklaring: 'Kommunene som har dagens klasser lagret sammen med siden, og blokkene for hver.',
      husk: 1,
      etl: nibioGrunnkart.klasseregister
    }),
    klassefil: tabell<Flis, ArrayBuffer | null>({
      lag: 'bronse',
      navn: 'klassefil',
      endepunkt: 'klasser/{z}/{x}/{y}.png',
      tittel: 'Lagrede klasser per blokk',
      om: 'dagens klasser i en blokk på nivå 10 slik de er lagret sammen med siden, som PNG med fargetabell, kalt med blokken [z, x, y]. null når blokken ikke er lagret. Nøkkel: blokken som «z/x/y».',
      teknisk: true,
      forklaring:
        'Dagens klasser i en blokk slik de er lagret sammen med siden. Det er svaret fra solv.klasser, laget på forhånd med den samme funksjonen (verktoy/klasser.ts), så ingenting må hentes fra NIBIO.',
      husk: 1024,
      nokkel: flisnavn,
      etl: nibioGrunnkart.klassefil
    }),
    planbit: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'planbit',
      datasett: DATASETT.utbyggingsareal,
      stotte:
        'Sjekken av om DiBK har kommuneplanen for kommunen: hele planen, med alle arealformål, til å regne ut hvor mye av kommunen den dekker.',
      endepunkt: E.KOMMUNEPLAN,
      tittel: 'Bilder av kommuneplanen',
      om: 'hele kommuneplanen fra DiBK i en bit, en flis på nivå 8 med 2048 x 2048 ruter à 10,6 meter, som PNG. Kalt med biten [8, x, y]. Nøkkel: biten som «z/x/y».',
      forklaring:
        'Hele kommuneplanen i DiBKs egen stil, ett bilde per bit med ruter på 10,6 meter. En bit er 21,7 km på hver side, og kommunen hentes i så mange biter som trengs.',
      kilde: KILDE.dibk,
      husk: 12,
      nokkel: flisnavn,
      etl: dibk.planbit,
      eksempel: flisMidt(BITNIVA)
    }),
    planopplysninger: tabell({
      lag: 'bronse',
      navn: 'planopplysninger',
      datasett: DATASETT.utbyggingsareal,
      stotte: 'Opplysninger om planen: hvilken plan det er, hvem som leverte den og når den ble kopiert til DiBK.',
      endepunkt: E.KOMMUNEPLAN,
      tittel: 'Opplysninger om kommuneplanen',
      om: 'hvilken kommuneplan DiBK har, slått opp midt i det planen dekker',
      forklaring:
        'Plan-id, hvem som leverte planen og når den ble kopiert til DiBK, slått opp midt i det planen dekker.',
      kilde: KILDE.dibk,
      husk: 6,
      etl: dibk.planopplysninger
    }),
    planoversikt: tabell({
      lag: 'bronse',
      navn: 'planoversikt',
      datasett: DATASETT.utbyggingsareal,
      stotte:
        'Gjør hentingen raskere: en grov oversikt over hvor planen ligger, så kartbildene bare hentes der det er plan.',
      endepunkt: E.KOMMUNEPLAN,
      tittel: 'Oversikt over kommuneplanen',
      om: 'ett bilde av kommuneplanen fra DiBK over hele kommunen, med samme utvalg og stil som kartbildene og én piksel per 85 meter. Brukes til å hente kartbildene bare der det er plan.',
      teknisk: true,
      forklaring:
        'Ett bilde av kommuneplanen over hele kommunen, med samme utvalg og stil som kartbildene og én piksel per 85 meter. Det er et vanlig PNG, ikke med fargetabell, for der forsvinner piksler som en liten flate bare dekker en bit av.',
      kilde: KILDE.dibk,
      husk: 6,
      etl: dibk.planoversikt
    }),
    planflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'planflis',
      datasett: DATASETT.utbyggingsareal,
      endepunkt: E.KOMMUNEPLAN,
      tittel: 'Kartbilder av kommuneplanen',
      om: 'kartbilder av kommuneplanen fra DiBK, 512 x 512 piksler, kalt med flisen [z, x, y]. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Kartbilder av laget kparealformalomrade, 512 × 512 piksler per flis: arealformål i 1000- og 2000-serien (bebyggelse og anlegg, samferdsel og teknisk infrastruktur) med status framtidig, fylt og uten kantstrek.',
      usikkerhet: [
        'Kommuneplanens arealdel viser hva som er satt av, ikke hva som blir bygd. Reguleringsplaner er ikke med.'
      ],
      kilde: KILDE.dibk,
      husk: 400,
      nokkel: flisnavn,
      etl: dibk.planflis
    }),
    inonbit: tabell<[number, Flis], ArrayBuffer>({
      lag: 'bronse',
      navn: 'inonbit',
      endepunkt: E.INON,
      tittel: 'Bilder av inngrepsfri natur',
      om: 'bildet av inngrepsfri natur fra Miljødirektoratet for et år i en bit, en flis på nivå 8 med 2048 x 2048 ruter à 10,6 meter, som PNG. Kalt med [år, biten]. Nøkkel: «år/z/x/y».',
      forklaring:
        'Ett bilde per bit og år, med ruter på 10,6 meter, uten glatting av kantene: laget status for 2023, og status_1988, status_2008, status_2013 og status_2018 for de tidligere årene, med de samme fargene. En bit er 21,7 km på hver side, og kommunen hentes i så mange biter som trengs.',
      kilde: KILDE.inon,
      husk: 200,
      nokkel: ([aar, tc]) => `${aar}/${flisnavn(tc)}`,
      etl: mdirInon.inonbit,
      eksempel: u => (u.midt ? [INON_NYESTE, flisVed(u.midt, BITNIVA)] : null)
    }),
    graabit: tabell<[number, Flis], ArrayBuffer>({
      lag: 'bronse',
      navn: 'graabit',
      endepunkt: E.GRAA,
      tittel: 'Bilder av grått areal',
      om: 'ett av de to bildene av grått areal fra NIBIO i en bit, en flis på nivå 8 med 2048 x 2048 ruter à 10,6 meter, som PNG. Kalt med [lag, biten]: lag 0 er alt grått areal, lag 1 flatene med andel vegetasjon. Nøkkel: «lag/z/x/y».',
      forklaring:
        'To bilder per bit i egen stil uten kantstrek, med ruter på 10,6 meter: alt grått areal, og flatene med andel vegetasjon, der trinnet leses av fargen. De hentes hver for seg, så fargene ikke blandes langs kantene. En bit er 21,7 km på hver side, og kommunen hentes i så mange biter som trengs.',
      usikkerhet: [
        'Kartet er en testversjon. Andel bygninger er ikke brukt, fordi tjenesten oppga 0 for alle flater som ble slått opp.'
      ],
      kilde: KILDE.graa,
      husk: 40,
      nokkel: ([lag, tc]) => `${lag}/${flisnavn(tc)}`,
      etl: nibioGraa.graabit,
      eksempel: u => (u.midt ? [0, flisVed(u.midt, BITNIVA)] : null)
    }),
    graaflis: tabell<[number, Flis], ArrayBuffer>({
      lag: 'bronse',
      navn: 'graaflis',
      endepunkt: E.GRAA,
      tittel: 'Kartbilder av grått areal',
      om: 'ett av de to bildene av grått areal fra NIBIO for en flis finere enn nivå 10, 512 x 512 piksler, kalt med [lag, flisen] som bitene (bronse.graabit). Bare til kartet zoomet inn. Nøkkel: «lag/z/x/y».',
      kilde: KILDE.graa,
      husk: 400,
      nokkel: ([lag, tc]) => `${lag}/${flisnavn(tc)}`,
      etl: nibioGraa.graaflis
    }),
    verneomrader: tabell({
      lag: 'bronse',
      navn: 'verneomrader',
      endepunkt: E.VERN,
      tittel: 'Verneområder',
      om: 'verneområdene i kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Verneområdene i kommunen som flater i UTM 33, forenklet med 5 meter, side for side når de ikke kommer i ett svar.',
      kilde: KILDE.vern,
      husk: 0,
      etl: mdirNatur.verneomrader
    }),
    villrein: tabell({
      lag: 'bronse',
      navn: 'villrein',
      endepunkt: E.VILLREIN,
      tittel: 'Villreinområder',
      om: 'villreinområdene i kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Leveområdene for villrein i kommunen som flater i UTM 33, forenklet med 20 meter, side for side når de ikke kommer i ett svar.',
      kilde: KILDE.villrein,
      husk: 0,
      etl: mdirNatur.villrein
    }),
    verdsattNatur: tabell({
      lag: 'bronse',
      navn: 'verdsattNatur',
      endepunkt: E.VERDSATT,
      tittel: 'Verdsatt natur',
      om: 'naturtyper med verdi i kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Naturtyper med svært stor, stor, middels eller noe verdi i kommunen, som flater i UTM 33, forenklet med 5 meter, side for side når de ikke kommer i ett svar.',
      kilde: KILDE.verdsatt,
      husk: 0,
      etl: mdirNatur.verdsattNatur
    }),
    verdsattVurderes: tabell({
      lag: 'bronse',
      navn: 'verdsattVurderes',
      endepunkt: E.VERDSATT,
      tittel: 'Verdsatt natur uten fast verdi',
      om: 'naturtyper i kommunen fra Miljødirektoratet som skal vurderes per lokalitet eller per naturtype, eller ikke er gitt verdi, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Lokalitetene i det samme laget som verdsatt natur, med verdikategorien «Vurderes per lokalitet», «Vurderes per naturtype» eller «Ikke gitt verdi», som flater i UTM 33, forenklet med 5 meter.',
      kilde: KILDE.verdsatt,
      husk: 0,
      etl: mdirNatur.verdsattVurderes
    }),
    kartlagt: tabell({
      lag: 'bronse',
      navn: 'kartlagt',
      endepunkt: E.KARTLAGT,
      tittel: 'Kartlagt for naturtyper',
      om: 'dekningsflatene for naturtypekartlegging rundt kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Dekningsflatene for naturtypekartlegging etter Miljødirektoratets instruks rundt kommunen, forenklet med 10 meter, side for side når de ikke kommer i ett svar.',
      kilde: KILDE.nin,
      husk: 0,
      etl: mdirNatur.kartlagt
    }),
    egne: tabell<string, Egetinn[]>({
      lag: 'bronse',
      navn: 'egne',
      fil: 'motor/egne.ts',
      tittel: 'Egne områder',
      om: 'egne områder brukeren har tegnet eller lastet opp i kommunen, slik brukeren laget dem: tegnede områder med typen brukeren valgte, og opplastede planer med arealformål og status per flate, i UTM33. En kilde fra brukeren, som datamotoren fyller.',
      forklaring:
        'Områder brukeren tegner, eller en GeoJSON-fil i samme format som plandata fra DiBK. Filen leses i nettleseren og sendes ingen steder. Projeksjonen leses fra filen, eller gjettes. Tegnede områder under 400 m² avvises.',
      husk: 30
    })
  },
  solv: {
    grense: tabell({
      lag: 'solv',
      navn: 'grense',
      tittel: 'Kommunegrensen',
      om: 'kommunegrensen som flerflate i UTM33, med utsnitt og flate i km²',
      forklaring:
        'Kommunens flate i km², rettet for målestokken i UTM (se Felles grunnlag). For noen kommuner ligger svaret lagret sammen med siden (bronse.grensefil).',
      husk: 6,
      etl: solvKommune.grense,
      lagret: solvKommune.lagretGrense
    }),
    arealtall: tabell({
      lag: 'solv',
      navn: 'arealtall',
      tittel: 'Arealtall per klasse',
      om: 'arealet per klasse i nyeste år, med landareal, innsjø og elv',
      forklaring:
        'Arealklassene summeres til bebygd, jordbruk og natur (se Arealklassene), med innsjø og elv for seg. Landarealet er summen av de tre.',
      husk: 6,
      etl: solvSsb.arealtall
    }),
    historie: tabell({
      lag: 'solv',
      navn: 'historie',
      tittel: 'Arealtall i 2017 og nå',
      om: 'arealet per klasse i 2017 og i nyeste år',
      forklaring:
        'Arealet per klasse i 2017 og i nyeste år. Avviker kommunens samlede areal med mer enn 0,5 %, er grensen trolig flyttet, og årene sammenlignes ikke.',
      usikkerhet: [
        'SSB skriver at tabellen ikke kan brukes til å beregne arealendringer mellom årganger, fordi datagrunnlaget blir mer fullstendig over tid. Forskjellen fra 2017 er derfor ikke målt endring, og noe av den kan skyldes bedre kartlegging. Siden sier det der tallet står.',
        'Har SSB ikke tall for kommunen i 2017, vises ikke sammenligningen. Det gjelder blant annet kommuner som ble opprettet ved deling.'
      ],
      husk: 6,
      etl: solvSsb.historie
    }),
    arealdetaljer: tabell({
      lag: 'solv',
      navn: 'arealdetaljer',
      tittel: 'Arealklassene hver for seg',
      om: 'arealet per arealklasse hos SSB, hver for seg, i hvert år fra 2017. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Hver av SSBs arealklasser for seg, i km² per år fra 2017. Summert per klasse gir de det samme som arealtallene. Avviker kommunens samlede areal med mer enn 0,5 % i perioden, er grensen trolig flyttet.',
      usikkerhet: [
        'SSB skriver at tabellen ikke kan brukes til å beregne arealendringer mellom årganger, fordi datagrunnlaget blir mer fullstendig over tid. Forskjeller mellom år er derfor ikke målt endring.'
      ],
      husk: 6,
      etl: solvSsb.arealdetaljer
    }),
    arealdetaljerAlle: tabell<void, Record<string, solvSsb.Arealdetaljer>>({
      lag: 'solv',
      navn: 'arealdetaljerAlle',
      tittel: 'Arealklassene for alle kommuner',
      om: 'arealet per arealklasse hos SSB i 2017 og 2024 for alle kommunene, etter kommunenummer, i samme form som arealdetaljer. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Svaret for alle kommunene delt opp per kommune. Avviker kommunens samlede areal med mer enn 0,5 % fra 2017 til 2024, er grensen trolig flyttet.',
      husk: 1,
      etl: solvSsb.arealdetaljerAlle
    }),
    kommuneareal: tabell<void, Record<string, number>>({
      lag: 'solv',
      navn: 'kommuneareal',
      tittel: 'Flaten til kommunene',
      om: 'flaten til hver kommune i km² (land, ferskvann og hav), etter kommunenummer. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring: 'Flaten til hver kommune fra den lagrede filen.',
      husk: 1,
      etl: solvKommune.kommuneareal
    }),
    klasser: tabell<Flis, solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'klasser',
      tittel: 'Dagens klasser per flis',
      om: 'dagens klasse per rute i en flis, kalt med flisen [z, x, y] fra nivå 10: ett kartbilde fra NIBIO. På nivå 10 er ruta 10,6 meter, og det er blokkene tallene regnes av; for noen kommuner ligger de lagret sammen med siden (bronse.klassefil), og da hentes ingenting fra NIBIO. Finere nivåer er den felles sannheten for kartet zoomet inn. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Dagens klasse per rute i fliser på 512 × 512 ruter, ett kartbilde per flis (se Arealklassene). Tallene regnes av blokkene på nivå 10 (10,6 meter), og for 57 kommuner er de lagret sammen med siden. Alle kartlagene tegnes av klassene på nivået kartet viser, også zoomet inn, så hver piksel er den samme klassen i alle lagene.',
      husk: 32,
      nokkel: flisnavn,
      etl: solvGrunnkart.klasser,
      lagret: solvGrunnkart.lagredeKlasser,
      eksempel: flisMidt(PLANNIVA)
    }),
    detaljklasser: tabell<Flis, solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'detaljklasser',
      tittel: 'Detaljklasser per flis',
      om: 'detaljklassen per rute i en flis, kalt med flisen [z, x, y] fra nivå 10, laget av ett kartbilde fra NIBIO (bronse.detaljflis) lest innenfor dagens klasser på det samme nivået (solv.klasser). Tallene regnes på nivå 10 (10,6 meter), og for noen kommuner ligger de blokkene lagret sammen med siden (bronse.detaljfil). Finere nivåer er til kartet zoomet inn. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Detaljklassen per rute i en blokk på 512 × 512 ruter à 10,6 meter. Klassen leses av fargen som for dagens klasser: det det er mest av, når fargen er en blanding. Så leses den innenfor dagens klasse i ruta (solv.klasser): hører den til en annen klasse, blir den «jordbruk, uspesifisert» eller «natur, uspesifisert», så detaljklassene summerer til dagens klasser. De lagrede filene leses med eksakte farger.',
      husk: 64,
      nokkel: flisnavn,
      etl: solvGrunnkart.detaljklasser,
      lagret: solvGrunnkart.lagredeDetaljklasser,
      eksempel: flisMidt(10)
    }),
    klasserUt: tabell<[string, number, number, number], solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'klasserUt',
      tittel: 'Dagens klasser zoomet ut',
      om: 'dagens klasse per piksel i en flis under nivå 10 for kommunen, kalt med [kommunenummer, z, x, y]: kartet zoomet ut. Nøkkel: «nummer/z/x/y».',
      teknisk: true,
      forklaring:
        'Hver piksel er flere ruter på 10,6 meter i kommunens blokker, og får klassen flest av dem har. Utledet av blokkene tallene regnes av, så alle kartlagene zoomet ut viser den samme klassen i hver piksel. Endrer ingen tall.',
      husk: 32,
      nokkel: ([nr, z, x, y]) => `${nr}/${z}/${x}/${y}`,
      etl: solvGrunnkart.klasserUt
    }),
    detaljklasserUt: tabell<[string, number, number, number], solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'detaljklasserUt',
      tittel: 'Detaljklasser zoomet ut',
      om: 'detaljklassen per piksel i en flis under nivå 10 for kommunen, kalt med [kommunenummer, z, x, y]. Nøkkel: «nummer/z/x/y».',
      teknisk: true,
      forklaring:
        'Hver piksel får dagens klasse flest av rutene har, og så detaljklassen flest av rutene med den klassen har, så detaljklassen alltid ligger innenfor dagens klasse også zoomet ut. Endrer ingen tall.',
      husk: 32,
      nokkel: ([nr, z, x, y]) => `${nr}/${z}/${x}/${y}`,
      etl: solvGrunnkart.detaljklasserUt
    }),
    detaljblokker: tabell<string, Flis[]>({
      lag: 'solv',
      navn: 'detaljblokker',
      tittel: 'Blokkene med detaljklasser',
      om: 'blokkene på nivå 10 for kommunen, som [10, x, y]: de samme som for dagens klasser (solv.blokker). De lagrede leses fra filene, de andre hentes fra NIBIO.',
      teknisk: true,
      forklaring: 'Blokkene med detaljklasser for kommunen: de samme blokkene som for dagens klasser.',
      husk: 12,
      etl: solvGrunnkart.detaljblokker
    }),
    blokker: tabell<[string, number], Flis[]>({
      lag: 'solv',
      navn: 'blokker',
      tittel: 'Blokkene i kommunen',
      om: 'blokkene på nivå 10 der kommunen dekker noe av minst én rute, fra kommunens andel i bitene (solv.kommunebiter), kalt med [kommunenummer, nivå]. Nøkkel: «nummer/nivå».',
      teknisk: true,
      forklaring: 'Blokkene der kommunen dekker noe av minst én rute.',
      husk: 12,
      nokkel: ([nr, z]) => `${nr}/${z}`,
      etl: solvGrunnkart.blokker
    }),
    egne: tabell({
      lag: 'solv',
      navn: 'egne',
      tittel: 'Egne områder, tolket',
      om: 'de egne områdene i kommunen med om hver flate er utbygging. Tegnede områder har typen brukeren valgte, og flatene i en opplastet plan får typen etter arealformål og status.',
      forklaring:
        'Hver flate er utbygging eller ikke. Arealformål i 1000- og 2000-serien med status framtidig, eller uten status, er utbygging, som i kommuneplanen. Uten arealformål er alle flatene utbygging. Et tegnet område er utbygging til brukeren sier noe annet.',
      husk: 30,
      brukerstyrt: true,
      etl: solvEgne.egne
    }),
    egneruter: tabell({
      lag: 'solv',
      navn: 'egneruter',
      tittel: 'Egne områder per rute',
      om: 'de egne områdene i kommunen som planen per rute, i samme datamodell som kommuneplanen: utbygging eller ikke, og hvilket område ruta hører til. Over utsnittet rundt alle områdene.',
      forklaring:
        'Flatene legges i planrutenettet etter halvregelen. Overlapper flater i samme område, vinner utbygging. Overlapper områder, gjelder det siste.',
      husk: 6,
      brukerstyrt: true,
      etl: solvEgne.egneruter
    }),
    plandekning: tabell({
      lag: 'solv',
      navn: 'plandekning',
      datasett: DATASETT.utbyggingsareal,
      stotte:
        'Sjekken av om DiBK har kommuneplanen for kommunen. Dekker planen under 15 % av kommunen, finnes ikke datasettet for kommunen.',
      tittel: 'Hvor mye planen dekker',
      om: 'hvor stor del av kommunen kommuneplanen dekker, talt i ruter på 10,6 meter bit for bit, og en rute midt i det planen dekker',
      forklaring:
        'Andelen av rutene på 10,6 meter i kommunen som planen dekker, der en rute er tegnet når den er minst 100 av 255 dekket. Under 15 % regnes som at DiBK ikke har planen, fordi naboplaner stikker litt inn langs grensen.',
      husk: 6,
      etl: solvPlan.plandekning
    }),
    planinfo: tabell({
      lag: 'solv',
      navn: 'planinfo',
      datasett: DATASETT.utbyggingsareal,
      stotte: 'Om DiBK har kommuneplanen, og opplysningene om den. Brukes til å si hvilken plan tallene gjelder.',
      tittel: 'Kommuneplanen',
      om: 'om DiBK har kommuneplanen, hvor stor del av kommunen den dekker, og hvilken plan det er',
      forklaring: 'Om DiBK har kommuneplanen, hvor mye av kommunen den dekker, og hvilken plan det er.',
      usikkerhet: ['Ikke alle kommuner har planen sin hos DiBK. Oslo mangler.'],
      husk: 6,
      etl: solvPlan.planinfo
    }),
    planoversikt: tabell({
      lag: 'solv',
      navn: 'planoversikt',
      datasett: DATASETT.utbyggingsareal,
      stotte:
        'Gjør hentingen raskere: hvor i kommunen planen ligger, så kartbildene bare hentes for blokkene der det er plan.',
      tittel: 'Hvor kommuneplanen ligger',
      om: 'for hver piksel i oversikten over kommuneplanen (85 meter) om noe av planen ligger der. Utbyggingen henter kartbildene fra DiBK bare for blokkene der oversikten har noe, eller rett ved.',
      teknisk: true,
      forklaring:
        'Hvor i kommunen planen ligger, fra oversikten. Kartbildene fra DiBK hentes bare for blokkene der oversikten har noe, i blokken eller én piksel utenfor.',
      husk: 2,
      etl: solvPlan.planoversikt
    }),
    kommuneplanruter: tabell<Flis, Planruter>({
      lag: 'solv',
      navn: 'kommuneplanruter',
      datasett: DATASETT.utbyggingsareal,
      tittel: 'Kommuneplanen per rute',
      om: 'kommuneplanen fra DiBK i én flis som planen per rute, i samme datamodell som egne områder: 1 der planen dekker minst halve ruta. Kalt med flisen [z, x, y]. Lagres ikke: blokkene i utbyggingen lagres, og kartbildet i bronse holder for å lage den på nytt.',
      forklaring:
        'En rute er planlagt utbygging når planen dekker minst halve ruta. Samme datamodell som egne områder.',
      husk: 0,
      nokkel: flisnavn,
      etl: solvPlan.kommuneplanruter,
      eksempel: flisMidt(PLANNIVA)
    }),
    kommunebiter: tabell<string, solvKommune.Kommunebit[]>({
      lag: 'solv',
      navn: 'kommunebiter',
      tittel: 'Kommunen i bitene',
      om: 'bitene kommunen dekker noe av (2048 x 2048 ruter à 10,6 meter), med dekningsandelen per rute som spenn (generelt/dekning.ts), eller hel når hele biten er i kommunen, og målestokken i biten',
      teknisk: true,
      forklaring:
        'Hvor stor del av hver rute som ligger i kommunen, regnet én gang per bit i bakgrunnstråden. En rute langs grensen telles med den delen av den som ligger i kommunen, så ingen rute telles i to kommuner. Brukes av alt som telles i kommunen: dagens klasser, planlagt utbygging, grått areal, inngrepsfri natur og hvor mye planen dekker. For noen kommuner ligger svaret lagret sammen med siden (bronse.andelfil).',
      husk: 3,
      etl: solvKommune.kommunebiter,
      lagret: solvKommune.lagredeKommunebiter
    }),
    inonbit: tabell<[number, Flis], solvInon.Inonsoner>({
      lag: 'solv',
      navn: 'inonbit',
      tittel: 'Inngrepsfri natur per rute',
      om: 'sonen per rute i en bit (2048 x 2048 ruter à 10,6 meter) for et år, kalt med [år, biten]. Nøkkel: «år/z/x/y».',
      forklaring:
        'En rute som er minst halvt dekket, får sonen fargen ligger nærmest: sone 2 (1–3 km fra inngrep), sone 1 (3–5 km) eller villmarkspreget (minst 5 km). Alle årene tolkes likt.',
      husk: 12,
      nokkel: ([aar, tc]) => `${aar}/${flisnavn(tc)}`,
      etl: solvInon.inonbit,
      eksempel: u => (u.midt ? [INON_NYESTE, flisVed(u.midt, BITNIVA)] : null)
    }),
    inon: tabell({
      lag: 'solv',
      navn: 'inon',
      tittel: 'Inngrepsfri natur i kommunen',
      om: 'antall ruter à 10,6 meter per sone innenfor kommunen, og bitene kommunen har ruter i',
      forklaring:
        'Rutene i kommunen telles per sone, bit for bit. En rute langs grensen telles med den delen av den som ligger i kommunen (solv.kommunebiter), og alle er rettet for målestokken i biten.',
      husk: 3,
      etl: solvInon.inon
    }),
    inonAar: tabell<[string, number], solvKommune.Bitruter>({
      lag: 'solv',
      navn: 'inonAar',
      tittel: 'Inngrepsfri natur i kommunen et tidligere år',
      om: 'antall ruter à 10,6 meter per sone innenfor kommunen for et år Miljødirektoratet har status for, kalt med [kommunenummer, år]. Nøkkel: «nummer/år».',
      forklaring:
        'Det samme som for nyeste år (solv.inon), talt i de samme rutene med den samme andelen av hver rute i kommunen, men av kartet for det året.',
      husk: 16,
      nokkel: ([nr, aar]) => `${nr}/${aar}`,
      etl: solvInon.inonAar
    }),
    inonsoner: tabell<Flis, solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'inonsoner',
      tittel: 'Inngrepsfri natur per flis',
      om: 'sonen per piksel i en flis fra nivå 10, kalt med flisen [z, x, y]: 0 uten sone, 1 villmarkspreget, 2 sone 1, 3 sone 2. Til kartet. Nøkkel: flisen som «z/x/y».',
      teknisk: true,
      forklaring:
        'Rutene i bitene tallene regnes av (10,6 meter): på nivå 10 én rute per piksel, og zoomet lenger inn ruta pikselen ligger i, så kartet henter ingenting nytt. Endrer ingen tall.',
      husk: 32,
      nokkel: flisnavn,
      etl: solvInon.inonsoner
    }),
    inonsonerUt: tabell<[string, number, number, number], solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'inonsonerUt',
      tittel: 'Inngrepsfri natur zoomet ut',
      om: 'sonen per piksel i en flis under nivå 10 for kommunen, kalt med [kommunenummer, z, x, y]. Nøkkel: «nummer/z/x/y».',
      teknisk: true,
      forklaring:
        'Hver piksel er flere ruter på 10,6 meter i kommunens biter. Den er villmarkspreget når minst halvparten av rutene er det, ellers sone 1 når minst halvparten er minst 3 km fra inngrep, og ellers sone 2 når minst halvparten er minst 1 km fra inngrep: halvregelen, som for én rute. Endrer ingen tall.',
      husk: 32,
      nokkel: ([nr, z, x, y]) => `${nr}/${z}/${x}/${y}`,
      etl: solvInon.inonsonerUt
    }),
    graabit: tabell<Flis, solvGraa.Graatrinn>({
      lag: 'solv',
      navn: 'graabit',
      tittel: 'Grått areal per rute',
      om: 'trinnet per rute i en bit (2048 x 2048 ruter à 10,6 meter), kalt med biten [8, x, y]. Nøkkel: biten som «z/x/y».',
      forklaring:
        'En rute som er minst halvt dekket, får et trinn etter andel vegetasjon: under 1 %, 1–25, 25–50, 50–75 eller 75–100 %, og grått uten oppgitt andel, som veier, for seg.',
      husk: 12,
      nokkel: flisnavn,
      etl: solvGraa.graabit,
      eksempel: flisMidt(BITNIVA)
    }),
    graa: tabell({
      lag: 'solv',
      navn: 'graa',
      tittel: 'Grått areal i kommunen',
      om: 'antall ruter à 10,6 meter per trinn innenfor kommunen, og bitene kommunen har ruter i',
      forklaring:
        'Rutene i kommunen telles per trinn, bit for bit. En rute langs grensen telles med den delen av den som ligger i kommunen (solv.kommunebiter), og alle er rettet for målestokken i biten.',
      husk: 3,
      etl: solvGraa.graa
    }),
    graatrinn: tabell<Flis, solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'graatrinn',
      tittel: 'Grått areal per flis',
      om: 'trinnet per piksel i en flis fra nivå 10, kalt med flisen [z, x, y]: 0 ikke grått, ellers trinnet 1–6 som i bitene. Til kartet. Nøkkel: flisen som «z/x/y».',
      teknisk: true,
      forklaring:
        'På nivå 10 er det rutene i bitene tallene regnes av (10,6 meter), så kartet henter ingenting nytt. Zoomet lenger inn leses de to kartbildene for flisen med den samme regelen som bitene: en piksel er grå når den er minst halvt dekket. Endrer ingen tall.',
      husk: 32,
      nokkel: flisnavn,
      etl: solvGraa.graatrinn
    }),
    graatrinnUt: tabell<[string, number, number, number], solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'graatrinnUt',
      tittel: 'Grått areal zoomet ut',
      om: 'trinnet per piksel i en flis under nivå 10 for kommunen, kalt med [kommunenummer, z, x, y]. Nøkkel: «nummer/z/x/y».',
      teknisk: true,
      forklaring:
        'Hver piksel er flere ruter på 10,6 meter i kommunens biter. Den er grå når minst halvparten av rutene er grå, halvregelen som for én rute, og får da trinnet flest av de grå rutene har. Endrer ingen tall.',
      husk: 32,
      nokkel: ([nr, z, x, y]) => `${nr}/${z}/${x}/${y}`,
      etl: solvGraa.graatrinnUt
    }),
    planIPunkt: tabell<number[], solvPunkt.Punktflate[]>({
      lag: 'solv',
      navn: 'planIPunkt',
      datasett: DATASETT.utbyggingsareal,
      stotte:
        'Oppslag når man trykker i kartet: flatene i punktet med navnet på arealformål og status. Brukes ikke i tallene.',
      tittel: 'Kommuneplanen i et punkt, tolket',
      om: 'flatene i kommuneplanene i et punkt, med feltene og flaten, og navnet på arealformål og status fra kodelisten. Nøkkel: punktet i hele meter.',
      forklaring:
        'Feltene slik DiBK gir dem, med navnet på arealformål og arealbruksstatus fra kodelistene i Geonorge, og flaten.',
      husk: 20,
      nokkel: kartverket.punktNokkel,
      etl: solvPunkt.planIPunkt
    }),
    grunnkartIPunkt: tabell<number[], solvPunkt.Punktflate[]>({
      lag: 'solv',
      navn: 'grunnkartIPunkt',
      tittel: 'Grunnkartet i et punkt, tolket',
      om: 'feltene i grunnkartet i et punkt, lest av GML-svaret fra NIBIO. Nøkkel: punktet i hele meter.',
      forklaring: 'Feltene slik NIBIO gir dem.',
      husk: 20,
      nokkel: kartverket.punktNokkel,
      etl: solvPunkt.grunnkartIPunkt
    }),
    inonIPunkt: tabell<number[], solvPunkt.Punktflate[]>({
      lag: 'solv',
      navn: 'inonIPunkt',
      tittel: 'Inngrepsfri natur i et punkt, tolket',
      om: 'feltene for sonen i et punkt: id, sone og arealet av sonen. Nøkkel: punktet i hele meter.',
      forklaring: 'Feltene slik Miljødirektoratet gir dem.',
      husk: 20,
      nokkel: kartverket.punktNokkel,
      etl: solvPunkt.inonIPunkt
    }),
    temaegenskaper: tabell<[string, number], solvPunkt.Punktflate[]>({
      lag: 'solv',
      navn: 'temaegenskaper',
      tittel: 'Alle feltene for et område, tolket',
      om: 'alle feltene for ett område i et naturtema, med datoene som datoer. Nøkkel: «tema/OBJECTID».',
      forklaring: 'Feltene slik Miljødirektoratet gir dem, med datoene som datoer.',
      husk: 50,
      nokkel: ([t, id]) => `${t}/${id}`,
      etl: solvPunkt.temaegenskaper
    }),
    verneomrader: tabell({
      lag: 'solv',
      navn: 'verneomrader',
      tittel: 'Verneområder, klippet',
      om: 'verneområdene klippet mot kommunen, med areal og opplysninger',
      forklaring:
        'Flatene klippes mot kommunegrensen, og arealet av hvert område i kommunen regnes ut. Feiler klippingen, regnes arealet med dekningsandelen i ruter på 10,6 meter.',
      husk: 30,
      etl: solvTemaer.verneomrader,
      glemt: (_, nr) => glemMasker('vern/' + nr + '/')
    }),
    villrein: tabell({
      lag: 'solv',
      navn: 'villrein',
      tittel: 'Villreinområder, klippet',
      om: 'villreinområdene klippet mot kommunen, med areal og opplysninger',
      forklaring:
        'Flatene klippes mot kommunegrensen, og arealet av hvert område i kommunen regnes ut. Feiler klippingen, regnes arealet med dekningsandelen i ruter på 10,6 meter.',
      husk: 30,
      etl: solvTemaer.villrein,
      glemt: (_, nr) => glemMasker('rein/' + nr + '/')
    }),
    verdsattNatur: tabell({
      lag: 'solv',
      navn: 'verdsattNatur',
      tittel: 'Lokaliteter med verdsatt natur',
      om: 'lokalitetene med verdsatt natur, uklippet, med areal, verdi og opplysninger',
      forklaring:
        'Lokalitetene leses med verdien og arealet av hele lokaliteten, og sorteres med høyest verdi først og så etter areal. De klippes ikke mot kommunen: det gjør dekningsandelen (solv.verdsattAndel) og kryssingen med utbyggingen.',
      usikkerhet: [
        'Arealet per lokalitet i listen er arealet av hele lokaliteten, også en del som ligger utenfor kommunen. Summene per verdikategori er klippet mot kommunen.'
      ],
      husk: 30,
      etl: solvTemaer.verdsattNatur,
      glemt: (_, nr) => glemMasker('verdi/' + nr + '/')
    }),
    verdsattVurderes: tabell({
      lag: 'solv',
      navn: 'verdsattVurderes',
      tittel: 'Lokaliteter uten fast verdi',
      om: 'lokalitetene med naturtyper som skal vurderes per lokalitet eller per naturtype, eller ikke er gitt verdi, uklippet, med areal og opplysninger.',
      forklaring:
        'Lokalitetene leses som verdsatt natur, med kategorien (per lokalitet, per naturtype eller ikke gitt verdi) i stedet for verdien.',
      usikkerhet: ['Arealet per lokalitet er arealet av hele lokaliteten, også en del som ligger utenfor kommunen.'],
      husk: 30,
      etl: solvTemaer.verdsattVurderes
    }),
    vernAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'vernAndel',
      tittel: 'Verneområdene per rute',
      om: 'verneområdene i kommunen som andel per rute i bitene (2048 x 2048 ruter à 10,6 meter), med arealet',
      forklaring:
        'Hvor stor del av hver rute som ligger i temaet og i kommunen, regnet i bakgrunnstråden med fire delrader per ruterad. Flatene slås sammen i rutene, så der de overlapper, telles arealet én gang. Gir arealet av verneområdene i kommunen, og brukes når de krysses med utbyggingen og detaljklassene.',
      husk: 30,
      etl: solvTemaer.vernAndel
    }),
    verneformAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'verneformAndel',
      tittel: 'Verneområdene per rute, per verneform',
      om: 'verneområdene i kommunen som andel per rute i bitene (2048 x 2048 ruter à 10,6 meter), med én kategori per gruppe av verneformer (nasjonalpark, naturreservat, landskapsvernområde, marint verneområde, artsfredning og annen fredning), og arealet per gruppe',
      forklaring:
        'Som verneområdene per rute, men delt på gruppene av verneformer. Der områder fra ulike grupper overlapper, telles ruta i den første gruppen, så gruppene summerer til det vernede arealet. Brukes når det vernede arealet deles på land og sjø.',
      etterBehov: true,
      husk: 12,
      etl: solvTemaer.verneformAndel
    }),
    villreinAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'villreinAndel',
      tittel: 'Villreinområdene per rute',
      om: 'villreinområdene i kommunen som andel per rute i bitene (2048 x 2048 ruter à 10,6 meter), med arealet',
      forklaring:
        'Hvor stor del av hver rute som ligger i temaet og i kommunen, regnet i bakgrunnstråden med fire delrader per ruterad. Flatene slås sammen i rutene, så der de overlapper, telles arealet én gang. Gir arealet av villreinområdene i kommunen, og brukes når de krysses med utbyggingen, grått areal og inngrepsfri natur.',
      husk: 30,
      etl: solvTemaer.villreinAndel
    }),
    verdsattAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'verdsattAndel',
      tittel: 'Verdsatt natur per rute',
      om: 'verdsatt natur i kommunen som andel per rute i bitene (2048 x 2048 ruter à 10,6 meter), per verdikategori, med arealet',
      forklaring:
        'Hvor stor del av hver rute som ligger i temaet og i kommunen, regnet i bakgrunnstråden med fire delrader per ruterad. Flatene slås sammen i rutene, så der de overlapper, telles arealet én gang. Der lokaliteter overlapper, teller den høyeste verdien, slik kartet viser det. Gir arealet per verdikategori, og brukes når verdsatt natur krysses med utbyggingen.',
      husk: 30,
      etl: solvTemaer.verdsattAndel
    }),
    vurderesAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'vurderesAndel',
      tittel: 'Verdsatt natur uten fast verdi per rute',
      om: 'lokalitetene som skal vurderes per lokalitet eller per naturtype, eller ikke er gitt verdi, som andel per rute i bitene, per kategori, med arealet',
      forklaring:
        'Hvor stor del av hver rute som ligger i temaet og i kommunen, regnet i bakgrunnstråden med fire delrader per ruterad. Flatene slås sammen i rutene, så der de overlapper, telles arealet én gang. Der lokaliteter overlapper, teller «vurderes per lokalitet» først. Gir arealet per kategori.',
      husk: 30,
      etl: solvTemaer.vurderesAndel
    }),
    kartlagtAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'kartlagtAndel',
      tittel: 'Det kartlagte per rute',
      om: 'det som er kartlagt for naturtyper i kommunen som andel per rute i bitene (2048 x 2048 ruter à 10,6 meter), med arealet',
      forklaring:
        'Hvor stor del av hver rute som ligger i temaet og i kommunen, regnet i bakgrunnstråden med fire delrader per ruterad. Flatene slås sammen i rutene, så der de overlapper, telles arealet én gang. Gir arealet som er kartlagt, og hvor mye av planlagt utbygging på natur som ligger utenfor det kartlagte.',
      husk: 30,
      etl: solvTemaer.kartlagtAndel
    }),
    verdsattIKartlagtAndel: tabell<string, solvTemaer.Temaandel>({
      lag: 'solv',
      navn: 'verdsattIKartlagtAndel',
      tittel: 'Verdsatt natur i det kartlagte per rute',
      om: 'verdsatt natur innenfor det kartlagte i kommunen som andel per rute i bitene, per verdikategori, med arealet',
      forklaring:
        'Hvor stor del av hver rute som ligger i temaet og i kommunen, regnet i bakgrunnstråden med fire delrader per ruterad. Flatene slås sammen i rutene, så der de overlapper, telles arealet én gang. Både kommunen og det kartlagte er masker, så bare det som ligger i begge, telles. Gir arealet per verdikategori innenfor det kartlagte.',
      husk: 30,
      etl: solvTemaer.verdsattIKartlagtAndel
    }),
    kartlagt: tabell({
      lag: 'solv',
      navn: 'kartlagt',
      tittel: 'Det kartlagte',
      om: 'det som er kartlagt for naturtyper etter Miljødirektoratets instruks, klippet mot kommunen',
      forklaring:
        'Arealet er dekningsflatene som andel per rute i kommunen (solv.kartlagtAndel), så overlapp telles én gang. Til kartet slås flatene sammen og klippes mot kommunen.',
      usikkerhet: ['Dekningsflatene kan ligge delvis i vann, mens kartleggingsgraden regnes av landarealet.'],
      husk: 30,
      etl: solvTemaer.kartlagt
    }),
    naturoppslag: tabell<string, Omradesok | null>({
      lag: 'solv',
      navn: 'naturoppslag',
      fil: 'solv/temaer.ts',
      tittel: 'Oppslag i områdene',
      om: 'hjelpetabell: områdene i naturtemaene og kommunen som oppslag, til kryssingen med utbyggingen. Nøkkel: tema/kommune/plassen til området, eller kommune/kommune. Lages første gang en rute med planlagt utbygging kan ligge i området.',
      forklaring:
        'Hvert område får et oppslag som gir hvor stor del av en rute som ligger i flaten, med de samme fire delradene som dekningsandelen. Det lages første gang planlagt utbygging kan ligge i området. Det er ingen ruter i oppslaget, så svaret er det samme hvor stort området er.',
      husk: Infinity
    })
  },
  gull: {
    detaljareal: tabell({
      lag: 'gull',
      navn: 'detaljareal',
      tittel: 'Areal per detaljklasse',
      om: 'arealet i km² per detaljklasse i kommunen, av blokkene på 10,6 meter, der en rute langs grensen telles med den delen av den som ligger i kommunen. Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes av tvillingen fra Figma og i sammenligningen for egne områder.',
      forklaring:
        'Arealet per detaljklasse i kommunen fra grunnkartet: barskog, lauvskog og blandingsskog, med tresatt myr og tresatt innmarksbeite for seg, åpen våtmark og de andre økosystemtypene. Er detaljklassene ikke lagret for kommunen, hentes de fra NIBIO, ett kall per blokk.',
      usikkerhet: [
        'Klassen leses av fargen i kartbildet, og i kanten mellom to flater blander NIBIO fargene. Smale flater, som elver og bekker, blir derfor for små.'
      ],
      etterBehov: true,
      husk: 12,
      etl: gullGrunnkart.detaljareal
    }),
    detaljerIVerneomrader: tabell({
      lag: 'gull',
      navn: 'detaljerIVerneomrader',
      tittel: 'Areal per detaljklasse i verneområdene',
      om: 'arealet i km² per detaljklasse innenfor verneområdene i kommunen, av blokkene på 10,6 meter. Hver rute teller med den delen av den som ligger i verneområdene og i kommunen (solv.vernAndel). Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Grunnkartets økosystemtyper i verneområdene: hvor mye av det vernede som er skog, våtmark, fjell, hav og så videre. Der verneområder overlapper, telles arealet én gang. Er detaljklassene ikke lagret for kommunen, hentes de fra NIBIO, ett kall per blokk.',
      etterBehov: true,
      husk: 12,
      etl: gullGrunnkart.detaljerIVerneomrader
    }),
    vernLandSjo: tabell({
      lag: 'gull',
      navn: 'vernLandSjo',
      tittel: 'Vernet areal på land og i sjø',
      om: 'det vernede arealet i kommunen i km² per gruppe av verneformer, alle seks gruppene, på land og i sjø, av blokkene på 10,6 meter i grunnkartet og verneområdene per rute (solv.verneformAndel). Sjø er hav i grunnkartet; land er alt annet, også innsjøer og elver. Lagret for noen kommuner, ellers hentet fra NIBIO.',
      forklaring:
        'Hvor mye av det vernede som ligger på land og hvor mye i sjø, per verneform. Hver rute teller med den delen av den som ligger i verneområdene, og grunnkartet sier om ruta er hav. Der verneområder overlapper, telles arealet én gang. Ruter uten klasse i grunnkartet er ikke med.',
      usikkerhet: [
        'Arealet er talt i ruter på 10,6 meter og kan avvike litt fra arealet av flatene. Grensen mellom land og sjø er grunnkartets, som kan være en annen enn verneområdets egen.'
      ],
      etterBehov: true,
      husk: 12,
      etl: gullGrunnkart.vernLandSjo
    }),
    skog: tabell({
      lag: 'gull',
      navn: 'skog',
      tittel: 'Skog i grunnkartet',
      om: 'skogen i kommunen fra grunnkartet: arealet, andelen av landarealet i grunnkartet, og arealet per treslag og per underlag (fastmark, tresatt myr, tresatt innmarksbeite). Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Skog er økosystemtypen skog i grunnkartet, også tresatt myr og tresatt innmarksbeite. Arealet summeres fra detaljklassene, og andelen er av landarealet i grunnkartet (alt unntatt hav, innsjøer og elver).',
      etterBehov: true,
      husk: 12,
      etl: gullOkosystemer.skog
    }),
    vatmark: tabell({
      lag: 'gull',
      navn: 'vatmark',
      tittel: 'Våtmark i grunnkartet',
      om: 'våtmarken i kommunen fra grunnkartet: åpen våtmark og tresatt myr, samlet og hver for seg, og andelen av landarealet i grunnkartet. Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Våtmark er økosystemtypen våtmark (åpen myr og annen åpen våtmark) og tresatt myr, som skissene regner med i våtmarken. Tresatt myr er dermed både skog og våtmark.',
      etterBehov: true,
      husk: 12,
      etl: gullOkosystemer.vatmark
    }),
    vernetNatur: tabell({
      lag: 'gull',
      navn: 'vernetNatur',
      tittel: 'Naturen i verneområdene',
      om: 'det vernede arealet per økosystemtype i grunnkartet, på land, i sjø og i ferskvann, andelen vernet land av landarealet i grunnkartet, og skogen som er vernet. Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Arealet per detaljklasse innenfor verneområdene, summert til økosystemtypene på nivå 1 og til land, sjø og ferskvann.',
      etterBehov: true,
      husk: 12,
      etl: gullOkosystemer.vernetNatur
    }),
    planPerOkosystem: tabell({
      lag: 'gull',
      navn: 'planPerOkosystem',
      tittel: 'Planlagt utbygging per økosystemtype',
      om: 'natur og jordbruk satt av til utbygging per økosystemtype i grunnkartet, med andelen av typen i kommunen, og våtmarken som er satt av. Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes av tvillingen fra Figma og i sammenligningen for egne områder. Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Planlagt utbygging per detaljklasse, summert til økosystemtypene på nivå 1. Andelen er arealet satt av delt på arealet av typen i kommunen.',
      etterBehov: true,
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullOkosystemer.planPerOkosystem
    }),
    verneformer: tabell({
      lag: 'gull',
      navn: 'verneformer',
      tittel: 'Verneområdene per verneform',
      om: 'verneområdene i kommunen som flater, med gruppen for verneformen (nasjonalpark, naturreservat, landskapsvernområde, marint verneområde, artsfredning og annen fredning). Til kartet over verneformene i tvillingen fra Figma.',
      forklaring:
        'Verneformen slik Miljødirektoratet skriver den, gruppert etter navnet: dyre- og plantefredning er artsfredning, og det som ikke passer i de andre gruppene, som naturminne og biotopvern, er annen fredning.',
      etterBehov: true,
      husk: 12,
      etl: gullTemaer.verneformer
    }),
    verdsattVurderes: tabell({
      lag: 'gull',
      navn: 'verdsattVurderes',
      tittel: 'Verdsatt natur uten fast verdi',
      om: 'lokalitetene som skal vurderes per lokalitet eller per naturtype, eller ikke er gitt verdi: antall og arealet i kommunen per kategori, og flatene til kartet.',
      forklaring:
        'Arealet per kategori regnes som for verdsatt natur, fra dekningsandelen (solv.vurderesAndel), så overlapp telles én gang.',
      usikkerhet: [
        'Kategoriene sier at verdien ikke er satt, ikke at naturen er mindre verdifull. «Ikke gitt verdi» gjelder bare noen få lokaliteter i landet, de fleste med naturtypen «Ikke kartlagt».'
      ],
      etterBehov: true,
      husk: 12,
      etl: gullTemaer.verdsattVurderes
    }),
    villreinPerOmrade: tabell({
      lag: 'gull',
      navn: 'villreinPerOmrade',
      tittel: 'Villreinområdene i kommunen',
      om: 'villreinområdene med delen i kommunen, andelen av landarealet og kommunene området ligger i. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring: 'Hvert villreinområde med arealet i kommunen og andelen av landarealet hos SSB.',
      husk: 12,
      etl: gullTemaer.villreinPerOmrade
    }),
    verdsattPerNaturtype: tabell({
      lag: 'gull',
      navn: 'verdsattPerNaturtype',
      tittel: 'Verdsatt natur per naturtype',
      om: 'lokalitetene i verdsatt natur gruppert per naturtype, alle og bare de med stor eller svært stor verdi: arealet, antall og høyeste verdi. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Lokalitetene gruppert per naturtype. Arealet er summen av lokalitetene, så overlapp telles flere ganger.',
      husk: 12,
      etl: gullTemaer.verdsattPerNaturtype
    }),
    okosystemfordeling: tabell({
      lag: 'gull',
      navn: 'okosystemfordeling',
      tittel: 'Hovedøkosystemer per kommune 2024 (syntetisk)',
      om: 'SYNTETISK: arealet per hovedøkosystem i kommunen i 2024, i samme form som SSBs tabell som publiseres 25. november 2026. SSBs arealklasser for 2024 med en fast nøkkel, havet som resten av kommunens flate, og kyststrender, svaberg og dyner som en fast andel av havet. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Syntetiske tall til SSBs tabell kommer. SSBs arealklasser for 2024 oversettes til hovedøkosystemer med en fast nøkkel. Havet er kommunens flate minus land og ferskvann. Kyststrender, svaberg og dyner er 0,1 % av havet, tatt fra hei og buskmark og lite vegetert mark.',
      usikkerhet: [
        'Syntetiske tall: tommelfingerregler som står i stedet for SSBs tabell til den publiseres, og som bare skal gi riktig størrelsesorden. SSBs tabell bygger på grunnkartet, som kan gi andre tall: i Trondheim er bebygd rundt 10 % større i grunnkartet.'
      ],
      husk: 12,
      etl: gullSyntetisk.okosystemfordeling
    }),
    bebygdEndring: tabell({
      lag: 'gull',
      navn: 'bebygdEndring',
      tittel: 'Endring mellom bebygd og landklassene 2017–2024 (syntetisk)',
      om: 'SYNTETISK: arealet fra hver landklasse til bebygd, og fra bebygd til klassen, fra 2017 til 2024, i samme form som SSBs tabell som publiseres 25. november 2026. Anslått av SSBs arealklasser for de to årene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Syntetiske tall til SSBs tabell kommer. SSBs arealklasser for 2017 og 2024 oversettes til hovedøkosystemer med en fast nøkkel. Økningen i bebygd er summen av økningene i hver bebygd klasse hos SSB, så bebygd går aldri ned. Den tas først fra jordbruket, så langt det gikk ned, og resten fra naturen etter arealet i 2017.',
      usikkerhet: [
        'Syntetiske tall: arealet i to år, ikke målte overganger. SSB skriver at forskjellen mellom årgangene også kommer av bedre kartlegging.'
      ],
      husk: 12,
      etl: gullSyntetisk.bebygdEndring
    }),
    oversiktKort: tabell({
      lag: 'gull',
      navn: 'oversiktKort',
      tittel: 'Kortene på oversikten (syntetisk)',
      om: 'natur, jordbruk og bebygd i 2024 med andelen av landarealet og endringen fra 2017, summert fra de syntetiske tabellene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Hovedøkosystemene summert til natur, jordbruk og bebygd, og endringen mellom bebygd og de andre summert på samme måte.',
      husk: 12,
      etl: gullSyntetisk.oversiktKort
    }),
    nedbygging: tabell({
      lag: 'gull',
      navn: 'nedbygging',
      tittel: 'Nedbygd per landklasse 2017–2024 (syntetisk)',
      om: 'hvor mye av hver landklasse som ble bygget ned fra 2017 til 2024, med arealet i 2024 og andelen av arealet i 2017, og summen for natur og jordbruk, fra de syntetiske tabellene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring: 'Arealet fra hver landklasse til bebygd, med andelen av arealet klassen hadde i 2017.',
      husk: 12,
      etl: gullSyntetisk.nedbygging
    }),
    okosystemregnskap: tabell({
      lag: 'gull',
      navn: 'okosystemregnskap',
      tittel: 'Regnskap per hovedøkosystem 2017–2024 (syntetisk)',
      om: 'SYNTETISK: arealet per hovedøkosystem på land i 2017 (inngående), endringen mot bebygd og arealet i 2024 (utgående), satt opp som et regnskap fra de syntetiske tabellene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Arealet i 2024 med det som gikk til og fra bebygd lagt tilbake gir arealet i 2017. Summen for land er den samme begge år.',
      husk: 12,
      etl: gullSyntetisk.okosystemregnskap
    }),
    okosystemerNorge: tabell<void, gullSyntetisk.OkosystemerNorge>({
      lag: 'gull',
      navn: 'okosystemerNorge',
      tittel: 'Hovedøkosystemer i alle kommuner (syntetisk)',
      om: 'SYNTETISK: de to syntetiske tabellene for alle kommunene i Norge, laget på samme måte som for én kommune, og summen for Norge. Endringen summeres for alle kommuner unntatt de som ikke hadde noe areal i 2017. Ett kall til SSB. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Arealet per hovedøkosystem i 2024 og endringen mellom bebygd og landklassene fra 2017, for hver kommune og for Norge, av SSBs arealklasser for alle kommunene og flaten til hver kommune.',
      usikkerhet: [
        'Syntetiske tall, som tabellene for én kommune. Der grensen er flyttet siden 2017, er endringen mer usikker.'
      ],
      etterBehov: true,
      husk: 1,
      etl: gullSyntetisk.okosystemerNorge
    }),
    sammenligning: tabell({
      lag: 'gull',
      navn: 'sammenligning',
      tittel: 'Kommunen sammenlignet med Norge (syntetisk)',
      om: 'SYNTETISK: kommunens andel av naturen som er bygget ned i Norge, andelen nedbygd natur i kommunen og i Norge, plassen for jordbruk og våtmark som er bygget ned, og skog og våtmark som andel av landarealet, fra de syntetiske tabellene for alle kommunene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Kommunen mot summen for Norge. Plassen er blant kommunene som kan sammenlignes med 2017, der 1 bygget ned mest, etter areal og etter andel av arealet i 2017.',
      etterBehov: true,
      husk: 12,
      etl: gullSyntetisk.sammenligning
    }),
    dagensKlasser: tabell({
      lag: 'gull',
      navn: 'dagensKlasser',
      tittel: 'Dagens klasser',
      om: 'alle blokkene med dagens klasser for kommunen lest, lagret eller hentet fra NIBIO, med om kommunen har lagrede klasser og hvor mange blokker den har. Bes om når kommunen velges, så blokkene er klare for tallene og kartet.',
      forklaring:
        'Dagens klasser for hele kommunen, i blokkene på 10,6 meter. For kommunene med lagrede klasser ligger blokkene ferdig sammen med siden. For de andre hentes kartbildene fra NIBIO når kommunen velges, og blokkene lages med den samme funksjonen.',
      husk: 1,
      etl: gullGrunnkart.dagensKlasser
    }),
    utbredelse: tabell({
      lag: 'gull',
      navn: 'utbredelse',
      tittel: 'Utbredelsen nå',
      om: 'utbredelsen nå: landarealet, og arealet og andelen for hver klasse',
      forklaring: 'Arealet for hver klasse i nyeste år, og andelen av landarealet.',
      husk: 6,
      etl: gullRegnskap.utbredelse
    }),
    endring: tabell({
      lag: 'gull',
      navn: 'endring',
      tittel: 'Endring fra 2017',
      om: 'forskjellen fra 2017 for hver klasse',
      forklaring: 'Forskjellen fra 2017 til nyeste år for hver klasse.',
      husk: 6,
      etl: gullRegnskap.endring
    }),
    oppstilling: tabell({
      lag: 'gull',
      navn: 'oppstilling',
      tittel: 'Regnskapsoppstillingen',
      om: 'regnskapsoppstillingen: areal ved start, netto endring og areal ved slutt',
      forklaring:
        'Utbredelsesregnskapet etter mønster fra FNs standard for naturregnskap (SEEA EA): inngående areal i 2017, netto endring og utgående areal i nyeste år, per klasse og med en sum for landarealet.',
      usikkerhet: [
        'Landarealet er ikke alltid det samme i de to årgangene, så netto endring går ikke alltid i null. Siden sier fra når det skjer.',
        'Bare netto endring per klasse er kjent. Tilvekst og avgang hver for seg, og hva natur ble til, kommer først med SSBs egne tabeller over arealendringer.'
      ],
      husk: 6,
      etl: gullRegnskap.oppstilling
    }),
    landOgVann: tabell({
      lag: 'gull',
      navn: 'landOgVann',
      tittel: 'Land og vann',
      om: 'land, innsjø, elv og hav i kommunens flate',
      forklaring:
        'Hav er kommunens flate minus landareal, innsjø og elv. SSB har klassen 23 «Sjøområde», men den er tom per kommune. Er resten mindre enn 0,5 km² eller 0,5 % av flaten, er det avvik mellom grense og statistikk, og kommunen vises uten hav.',
      husk: 6,
      etl: gullRegnskap.landOgVann
    }),
    kommuneplan: tabell({
      lag: 'gull',
      navn: 'kommuneplan',
      tittel: 'Kommuneplanen',
      om: 'om DiBK har kommuneplanen, og hvilken',
      forklaring: 'Opplysningene om kommuneplanen fra sølv, slik siden viser dem.',
      husk: 6,
      etl: gullPlan.kommuneplan
    }),
    utbygging: tabell<string, Utbygging | null>({
      lag: 'gull',
      navn: 'utbygging',
      tittel: 'Utbyggingen',
      om: 'utbyggingen: kommuneplanen og egne områder lagt oppå dagens klasser, i ruter på 10,6 meter med smale striper tatt bort. Én rad per rute med planlagt utbygging på natur eller jordbruk. Rutenettene er glisne: bare blokkene med noe i finnes. Midtpunktet: alle kryssinger med planlagt utbygging går gjennom den.',
      forklaring:
        'For hver blokk legges planen oppå dagens klasser, rute for rute. Ruter kommunen dekker mindre enn halvparten av, er ikke med. Ruter som i dag er natur eller jordbruk og planlagt utbygging, merkes. Ruter som alt er bebygd eller vann, merkes ikke. Egne områder erstatter kommuneplanen innenfor flatene: som utbygging tar de all natur og alt jordbruk i ruta, og som ikke utbygging fjerner de det planen setter av der. Så tas smale striper ut: først finnes kjernene, ruter med planlagt utbygging på alle fire sider, og så beholdes alt som henger sammen med en kjerne, også bare på skrå. Felt som ikke er bredere enn to ruter, rundt 20 meter, noe sted, faller bort. Med egne områder regnes alt både med og uten dem, så analysene av planlagt utbygging kan regnes for begge planene: den nye, med egne områder, og den gamle, kommuneplanen alene, i hele kommunen eller i ett eget område, med de samme funksjonene.',
      usikkerhet: [
        'Rutenettet overser bebygde flater som er smalere enn en rute, særlig veier. Regelen om smale striper tar bort det meste av dette, men også noe som er reelt: smale felt og nye veier.'
      ],
      husk: 1,
      brukerstyrt: true,
      etl: gullUtbygging.utbygging
    }),
    planAlene: tabell<string, { alene: gullUtbygging.PlanAlene | null }>({
      lag: 'gull',
      navn: 'planAlene',
      fil: 'gull/utbygging.ts',
      tittel: 'Kommuneplanen alene, sist regnet ut',
      om: 'hjelpetabell: kommuneplanen alene ryddet for smale striper, og summen, fra sist utbyggingen ble regnet ut, så den ikke regnes ut på nytt når egne områder endres',
      teknisk: true,
      forklaring:
        'Kommuneplanen alene er den samme uansett egne områder, så den ryddes for smale striper én gang så lenge blokkene med planen er de samme.',
      husk: 2,
      voksende: true
    }),
    radorden: tabell({
      lag: 'gull',
      navn: 'radorden',
      fil: 'gull/temaer.ts',
      tittel: 'Radene i utbyggingen i rekkefølge',
      om: 'hjelpetabell: radene i utbyggingen sortert etter rute, og i rekkefølgen punktnettet gir dem, som kolonnene for alle temaene bruker',
      teknisk: true,
      forklaring: 'Rekkefølgen på radene i utbyggingen, regnet én gang for alle temaene.',
      husk: 2,
      brukerstyrt: true,
      etl: gullTemaer.radorden
    }),
    temaminne: tabell<string, { forrige: gullTemaer.Temakolonne | null }>({
      lag: 'gull',
      navn: 'temaminne',
      fil: 'gull/temaer.ts',
      tittel: 'Kolonnene for temaene, sist regnet ut',
      om: 'hjelpetabell: de siste kolonnene for hvert tema i utbyggingen, så bare nye ruter regnes ut når egne områder endres. Nøkkel: temaet og kommunen, som vern/5001.',
      teknisk: true,
      forklaring:
        'De siste kolonnene for temaet, så andelen bare regnes ut for ruter som ikke var med sist. Andelen i en rute avhenger bare av ruta.',
      husk: 6,
      voksende: true
    }),
    utvalg: tabell({
      lag: 'gull',
      navn: 'utvalg',
      fil: 'gull/utbygging.ts',
      tittel: 'Utvalg av utbyggingen',
      om: 'hjelpetabell: rutene en analyse regnes over, for den nye eller den gamle planen, i hele kommunen eller i ett eget område, med raden i utbyggingen og verdien i planen slått opp én gang per rute. Nøkkelen er utvalget, som 5001, 5001/gammel eller 5001/ny/1.',
      teknisk: true,
      forklaring:
        'Rutene med planlagt utbygging på natur eller jordbruk i den nye eller den gamle planen, i hele kommunen eller i ett eget område. Alle analysene for et utvalg bruker de samme rutene.',
      husk: 8,
      brukerstyrt: true,
      etl: gullUtbygging.utvalg
    }),
    utbyggingsblokker: tabell<string, Map<string, Blokk>>({
      lag: 'gull',
      navn: 'utbyggingsblokker',
      fil: 'gull/utbygging.ts',
      tittel: 'Utbyggingen i blokker',
      om: 'hjelpetabell: utbyggingen i blokker på 512 x 512 ruter, én per flis på nivå 10, så blokkene ikke regnes ut på nytt når egne områder endres',
      teknisk: true,
      forklaring: 'Utbyggingen i blokker på 512 × 512 ruter, så bare blokker med nytt kart regnes ut på nytt.',
      husk: 1,
      voksende: true
    }),
    planlagt: tabell({
      lag: 'gull',
      navn: 'planlagt',
      tittel: 'Planlagt utbygging',
      om: 'natur og jordbruk som planen setter av, med andeler Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'De beholdte rutene telles for natur og jordbruk og regnes om til areal. Prosenten er andelen av rutene som i dag er natur, eller jordbruk, i det samme rutenettet. Tallet med smale striper står i parentes.',
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullPlan.planlagt
    }),
    planlagtPerDetaljklasse: tabell({
      lag: 'gull',
      navn: 'planlagtPerDetaljklasse',
      tittel: 'Planlagt utbygging per detaljklasse',
      om: 'natur og jordbruk satt av til utbygging, fordelt på detaljklassene i grunnkartet: hver rute får den detaljklassen av riktig slag det er mest av i ruta. Summen er den samme som i gull.plansum. Lagret for noen kommuner, ellers hentet fra NIBIO. Brukes av tvillingen fra Figma og i sammenligningen for egne områder. Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Planlagt utbygging per økosystemtype i grunnkartet: hvor mye av naturen som settes av, er skog, våtmark, tresatt myr og så videre. Hver rute med planlagt utbygging får den typen det er mest av i ruta, så summen er den samme som natur og jordbruk satt av. Er detaljklassene ikke lagret for kommunen, hentes de fra NIBIO, ett kall per blokk.',
      etterBehov: true,
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullPlan.planlagtPerDetaljklasse
    }),
    plansum: tabell({
      lag: 'gull',
      navn: 'plansum',
      tittel: 'Planlagt utbygging, kort',
      om: 'natur og jordbruk satt av i km², til oversikten og regnskapet',
      husk: 6,
      brukerstyrt: true,
      etl: gullPlan.plansum
    }),
    inon: tabell({
      lag: 'gull',
      navn: 'inon',
      tittel: 'Inngrepsfri natur',
      om: 'inngrepsfri natur: arealet samlet og per sone, og andelen av landarealet',
      forklaring:
        'Antall ruter per sone regnes om til areal, avrundet til nærmeste 10 dekar som SSBs tall, og andelen av landarealet regnes ut.',
      usikkerhet: ['Arealet gjelder alt innenfor sonene, også innsjøer, mens andelen regnes av landarealet.'],
      husk: 6,
      etl: gullInon.inon
    }),
    inonIVillrein: tabell({
      lag: 'gull',
      navn: 'inonIVillrein',
      tittel: 'Inngrepsfri natur i villreinområdene',
      om: 'inngrepsfri natur innenfor villreinområdene i kommunen: arealet samlet og per sone, og andelen av villreinområdene. Begge arealene telles i de samme bitene. null uten villreinområder. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Hver rute teller med den delen av den som ligger i villreinområdene og i kommunen (solv.villreinAndel), og sonen kommer fra bildet av inngrepsfri natur. Andelen er inngrepsfri natur av villreinområdene i kommunen.',
      husk: 12,
      etl: gullInon.inonIVillrein
    }),
    inonUtvikling: tabell({
      lag: 'gull',
      navn: 'inonUtvikling',
      tittel: 'Inngrepsfri natur over tid',
      om: 'inngrepsfri natur i kommunen for hvert år Miljødirektoratet har status for (1988, 2008, 2013, 2018 og 2023): arealet per sone og samlet, andelen av landarealet, og endringen per periode, også for inngrepsnær natur',
      forklaring:
        'Hvert år telles på samme måte og i de samme rutene som nyeste år, av Miljødirektoratets kart for det året. Endringen i inngrepsnær natur er det inngrepsfri natur mister. Regnes først når siden for inngrepsfri natur vises, fordi den henter fire ganger så mange bilder.',
      usikkerhet: [
        'Alle årene er fra Miljødirektoratets utgave fra april 2024, og kan sammenlignes. Neste status gjelder 2028, og kan endre tallene for de tidligere årene.',
        'Den første perioden er 20 år (1988 til 2008), de andre fem.',
        'Inngrep med feil byggeår hos dataeierne kan gi feil utvikling noen steder, ifølge Miljødirektoratet.'
      ],
      etterBehov: true,
      husk: 6,
      etl: gullInon.inonUtvikling
    }),
    inonIVillreinUtvikling: tabell({
      lag: 'gull',
      navn: 'inonIVillreinUtvikling',
      tittel: 'Inngrepsfri natur i villreinområdene over tid',
      om: 'inngrepsfri natur innenfor villreinområdene i kommunen for hvert år Miljødirektoratet har status for: arealet per sone og samlet, og andelen av villreinområdene. null uten villreinområder. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Som inngrepsfri natur i villreinområdene (gull.inonIVillrein), for hvert år, i de samme rutene med den samme andelen av hver rute. Villreinområdene er dagens.',
      usikkerhet: ['Villreinområdene er dagens grenser for alle årene.'],
      etterBehov: true,
      husk: 6,
      etl: gullInon.inonIVillreinUtvikling
    }),
    graaIVillrein: tabell({
      lag: 'gull',
      navn: 'graaIVillrein',
      tittel: 'Grått areal i villreinområdene',
      om: 'grått areal innenfor villreinområdene i kommunen: arealet og andelen av villreinområdene. Begge arealene telles i de samme bitene. null uten villreinområder. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Hver rute teller med den delen av den som ligger i villreinområdene og i kommunen (solv.villreinAndel), og trinnet kommer fra bildet av grått areal. Alle trinnene er grått areal, uansett andel vegetasjon. Andelen er grått areal av villreinområdene i kommunen.',
      usikkerhet: [
        'Grått areal er areal som er tatt i bruk, ikke bare bygninger. Små inngrep under rutestørrelsen kommer ikke med.'
      ],
      etterBehov: true,
      husk: 12,
      etl: gullGraa.graaIVillrein
    }),
    gronneArealer: tabell({
      lag: 'gull',
      navn: 'gronneArealer',
      tittel: 'Grønne arealer i bebyggelse',
      om: 'grått areal med minst halvparten vegetasjon, fra laget «andel med vegetasjon» i kartet over grå arealer: arealet, og andelen av det grå arealet og av landarealet. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring: 'Summen av de to øverste trinnene i gull.graa (50–75 og 75–100 % vegetasjon).',
      usikkerhet: [
        'Andelen vegetasjon gjelder hver flate i kartet over grå arealer, så en flate med 60 % vegetasjon telles helt med.'
      ],
      etterBehov: true,
      husk: 12,
      etl: gullGraa.gronneArealer
    }),
    graakryss: tabell({
      lag: 'gull',
      navn: 'graakryss',
      tittel: 'Grått areal krysset med utbyggingen',
      om: 'utbyggingen krysset med grått areal: planlagt utbygging på land, også der det alt er bebygd, og grønt i bebygd område Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Midtpunktet i hver rute med planlagt utbygging på land slås opp i bildet av grått areal. Her er alle ruter med, også der det alt er bebygd og i smale striper. Grønt i bebygd område er ruter som er bebygd i grunnkartet, men ikke grå.',
      usikkerhet: [
        'Totalen for planlagt utbygging på land er større enn tallet for planlagt utbygging på natur og jordbruk, fordi den også tar med ruter som alt er bebygd, og smale striper.'
      ],
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullGraa.graakryss
    }),
    graa: tabell({
      lag: 'gull',
      navn: 'graa',
      tittel: 'Grått areal',
      om: 'grått areal: arealet samlet og per trinn, og andelen av landarealet',
      forklaring:
        'Antall ruter per trinn regnes om til areal, avrundet til nærmeste 10 dekar som SSBs tall, og andelen av landarealet regnes ut.',
      usikkerhet: ['Grått betyr ikke ledig. Kartet skiller ikke et boligområde i bruk fra en nedlagt industritomt.'],
      husk: 6,
      etl: gullGraa.graa
    }),
    graaIPlan: tabell({
      lag: 'gull',
      navn: 'graaIPlan',
      tittel: 'Grått areal i planen',
      om: 'planlagt utbygging på grått areal, og grønt i bebygd område Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Planlagt utbygging på grått areal, på grått areal med minst halvparten vegetasjon (trinnene fra 50 % og opp), og på grønt i bebygd område.',
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullGraa.graaIPlan
    }),
    verneomrader: tabell({
      lag: 'gull',
      navn: 'verneomrader',
      tittel: 'Verneområder',
      om: 'verneområdene i kommunen: listen, arealet og andelen av landarealet',
      forklaring:
        'Arealet i kommunen er verneområdene slått sammen (solv.vernAndel), så der to områder overlapper, telles overlappet én gang. Andelen er regnet av landarealet. Arealet per område i listen er hele området i kommunen.',
      usikkerhet: [
        'Verneområder kan ligge i sjø og innsjøer, men andelen regnes av landarealet. I kystkommuner kan den bli høy, og over 100 %, for eksempel på Frøya.'
      ],
      husk: 6,
      etl: gullTemaer.verneomrader
    }),
    utbyggingIVerneomrader: tabell({
      lag: 'gull',
      navn: 'utbyggingIVerneomrader',
      tittel: 'Utbyggingen i verneområder',
      om: 'kolonnene for verneområdene i utbyggingen: hvor stor del av hver rad som ligger i verneområdene, samlet og per område',
      forklaring:
        'For hver rute med planlagt utbygging: hvor stor del av ruta som ligger i temaet og i kommunen, fra dekningsandelen i sølv (der områder overlapper, telles delen én gang), og hvor stor del som ligger i hvert område, regnet med de samme fire delradene i flaten til området. Det gir kolonner i utbyggingen.',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVerneomrader
    }),
    verneomraderIPlan: tabell({
      lag: 'gull',
      navn: 'verneomraderIPlan',
      tittel: 'Verneområder i planen',
      om: 'planlagt utbygging innenfor verneområdene, samlet og per område: summene over kolonnene Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Delene av rutene summeres, rettet for målestokken, og regnes om til areal: samlet og for verdsatt natur per verdikategori, der overlapp telles én gang, og per område, der hvert område teller sin del. Et område regnes som berørt når utbyggingen dekker minst en halv rute av det. Ruter i smale striper telles for seg.',
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullTemaer.verneomraderIPlan
    }),
    villrein: tabell({
      lag: 'gull',
      navn: 'villrein',
      tittel: 'Villreinområder',
      om: 'villreinområdene i kommunen: listen, arealet og andelen av landarealet',
      forklaring:
        'Arealet i kommunen er villreinområdene slått sammen (solv.villreinAndel), så der to områder overlapper, telles overlappet én gang. Andelen er regnet av landarealet. Arealet per område i listen er hele området i kommunen.',
      husk: 6,
      etl: gullTemaer.villrein
    }),
    utbyggingIVillrein: tabell({
      lag: 'gull',
      navn: 'utbyggingIVillrein',
      tittel: 'Utbyggingen i villreinområder',
      om: 'kolonnene for villreinområdene i utbyggingen: hvor stor del av hver rad som ligger i villreinområdene, samlet og per område',
      forklaring:
        'For hver rute med planlagt utbygging: hvor stor del av ruta som ligger i temaet og i kommunen, fra dekningsandelen i sølv (der områder overlapper, telles delen én gang), og hvor stor del som ligger i hvert område, regnet med de samme fire delradene i flaten til området. Det gir kolonner i utbyggingen.',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVillrein
    }),
    villreinIPlan: tabell({
      lag: 'gull',
      navn: 'villreinIPlan',
      tittel: 'Villreinområder i planen',
      om: 'planlagt utbygging innenfor villreinområdene, samlet og per område: summene over kolonnene Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Delene av rutene summeres, rettet for målestokken, og regnes om til areal: samlet og for verdsatt natur per verdikategori, der overlapp telles én gang, og per område, der hvert område teller sin del. Et område regnes som berørt når utbyggingen dekker minst en halv rute av det. Ruter i smale striper telles for seg.',
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullTemaer.villreinIPlan
    }),
    verdsattNatur: tabell({
      lag: 'gull',
      navn: 'verdsattNatur',
      tittel: 'Verdsatt natur',
      om: 'verdsatt natur i kommunen: lokalitetene, arealet samlet og per verdikategori, og andelen av landarealet',
      forklaring:
        'Arealet samlet og per verdikategori fra dekningsandelen i sølv (solv.verdsattAndel), der overlapp telles én gang og den høyeste verdien teller, antall lokaliteter per kategori, og andelen av landarealet.',
      husk: 6,
      etl: gullTemaer.verdsattNatur
    }),
    verdsattNaturIKartlagt: tabell({
      lag: 'gull',
      navn: 'verdsattNaturIKartlagt',
      tittel: 'Verdsatt natur i det kartlagte',
      om: 'verdsatt natur per verdikategori innenfor det kartlagte',
      forklaring:
        'Verdsatt natur per verdikategori innenfor det kartlagte, fra dekningsandelen med både kommunen og det kartlagte som masker (solv.verdsattIKartlagtAndel).',
      husk: 30,
      etl: gullTemaer.verdsattNaturIKartlagt
    }),
    verdsattNaturKartlagt: tabell({
      lag: 'gull',
      navn: 'verdsattNaturKartlagt',
      tittel: 'Kartleggingen',
      om: 'kartleggingen: hvor mye som er kartlagt, og helhetsbildet med verdsatt natur i det kartlagte og resten',
      forklaring:
        'Kartleggingsgraden er det kartlagte arealet delt på landarealet fra SSB, og vises som høyst 100 %. Helhetsbildet deler landarealet i kartlagt og ikke kartlagt, og viser verdsatt natur per verdi i hver del.',
      usikkerhet: [
        'Det kartlagte er ikke et tilfeldig utvalg av kommunen, så andelen verdsatt natur der kan ikke overføres til resten. Utenfor det kartlagte betyr «ingen registrert» at det ikke er lett, ikke at naturen mangler verdi.'
      ],
      husk: 6,
      etl: gullTemaer.verdsattNaturKartlagt
    }),
    utbyggingIVerdsattNatur: tabell({
      lag: 'gull',
      navn: 'utbyggingIVerdsattNatur',
      tittel: 'Utbyggingen i verdsatt natur',
      om: 'kolonnene for verdsatt natur i utbyggingen: hvor stor del av hver rad som ligger i verdsatt natur, per verdikategori og per lokalitet',
      forklaring:
        'For hver rute med planlagt utbygging: hvor stor del av ruta som ligger i temaet og i kommunen, fra dekningsandelen i sølv (der områder overlapper, telles delen én gang), og hvor stor del som ligger i hvert område, regnet med de samme fire delradene i flaten til området. Det gir kolonner i utbyggingen.',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVerdsattNatur
    }),
    verdsattNaturIPlan: tabell({
      lag: 'gull',
      navn: 'verdsattNaturIPlan',
      tittel: 'Verdsatt natur i planen',
      om: 'planlagt utbygging i verdsatt natur: per verdikategori og de berørte lokalitetene, summert over kolonnene Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Delene av rutene summeres, rettet for målestokken, og regnes om til areal: samlet og for verdsatt natur per verdikategori, der overlapp telles én gang, og per område, der hvert område teller sin del. Et område regnes som berørt når utbyggingen dekker minst en halv rute av det. Ruter i smale striper telles for seg.',
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullTemaer.verdsattNaturIPlan
    }),
    utbyggingUtenforKartlagt: tabell({
      lag: 'gull',
      navn: 'utbyggingUtenforKartlagt',
      tittel: 'Utbygging utenfor det kartlagte',
      om: 'planlagt utbygging på natur, og hvor mye av den som ligger utenfor det kartlagte for naturtyper Nøkkelen er utvalget av utbyggingen: 5001 for den nye planen i hele kommunen, og 5001/gammel, 5001/ny/1 og så videre for den gamle planen og for egne områder (gull/utbygging.ts).',
      forklaring:
        'Rutene med planlagt utbygging på natur, uten smale striper, deles i kartlagt og ikke kartlagt: den delen av ruta som ligger i kommunen, men ikke i det kartlagte (solv.kartlagtAndel), er ikke kartlagt.',
      husk: 40,
      brukerstyrt: true,
      gammelFast: true,
      etl: gullTemaer.utbyggingUtenforKartlagt
    }),
    egneRader: tabell({
      lag: 'gull',
      navn: 'egneRader',
      tittel: 'Egne områder mot kommuneplanen',
      om: 'sammenligningen mellom den gamle planen (kommuneplanen alene) og den nye (med egne områder), for hele kommunen og hvert område',
      forklaring:
        'De samme analysene som for kommuneplanen regnes for den gamle og den nye planen, i hele kommunen og i hvert eget område: natur og jordbruk satt av, grått areal, verneområder, villreinområder, verdsatt natur samlet og per verdi, natur som ikke er kartlagt, og hvor mange områder som berøres. Radene viser den gamle planen, den nye og forskjellen. For hvert område telles også hva som ligger der i dag.',
      usikkerhet: [
        'Lastes kommuneplanen selv opp, kan tabellen vise små forskjeller som bare kommer av at flatene legges i rutenettet på en annen måte enn bildene fra DiBK.'
      ],
      husk: 6,
      brukerstyrt: true,
      etl: gullEgne.egneRader
    }),
    egneOkosystemer: tabell({
      lag: 'gull',
      navn: 'egneOkosystemer',
      tittel: 'Egne områder mot kommuneplanen, per økosystemtype',
      om: 'planlagt utbygging per økosystemtype i grunnkartet i den gamle og den nye planen, for hele kommunen og hvert eget område. For seg, fordi grunnkartet med detaljklassene kan ta tid å hente.',
      forklaring:
        'Planlagt utbygging per økosystemtype, regnet på samme måte for den gamle og den nye planen, i hele kommunen og i hvert eget område. Radene viser den gamle planen, den nye og forskjellen.',
      etterBehov: true,
      husk: 6,
      brukerstyrt: true,
      etl: gullEgne.egneOkosystemer
    })
  }
};
/* ETL-filene, med stien under src/data. Katalogen grupperer tabellene etter filen ETL-funksjonen står i: i bronse er det kilden, i sølv
   og gull innholdet. ETL-funksjonen heter det samme som tabellen, så den slås opp med navnet (bare funksjonserklæringer finnes mens
   filene lastes). Står den ikke i noen av filene her, eller heter den noe annet, stopper siden når den lastes. */
const ETL_FILER: [string, object][] = [
  ['bronse/kartverket.ts', kartverket],
  ['bronse/ssb.ts', ssb],
  ['bronse/nibio-grunnkart.ts', nibioGrunnkart],
  ['bronse/nibio-graa.ts', nibioGraa],
  ['bronse/dibk-kommuneplan.ts', dibk],
  ['bronse/mdir-inon.ts', mdirInon],
  ['bronse/mdir-naturtema.ts', mdirNatur],
  ['solv/kommune.ts', solvKommune],
  ['solv/ssb.ts', solvSsb],
  ['solv/grunnkart.ts', solvGrunnkart],
  ['solv/kommuneplan.ts', solvPlan],
  ['solv/inon.ts', solvInon],
  ['solv/graa.ts', solvGraa],
  ['solv/temaer.ts', solvTemaer],
  ['solv/egne.ts', solvEgne],
  ['solv/punkt.ts', solvPunkt],
  ['gull/regnskap.ts', gullRegnskap],
  ['gull/planlagt.ts', gullPlan],
  ['gull/grunnkart.ts', gullGrunnkart],
  ['gull/utbygging.ts', gullUtbygging],
  ['gull/inon.ts', gullInon],
  ['gull/okosystemer.ts', gullOkosystemer],
  ['gull/syntetisk.ts', gullSyntetisk],
  ['gull/graa.ts', gullGraa],
  ['gull/temaer.ts', gullTemaer],
  ['gull/egne.ts', gullEgne]
];
for (const lag of Object.values(katalog))
  for (const t of Object.values(lag) as Tabell<unknown, unknown>[]) {
    if (!t.etl) continue;
    const funnet = ETL_FILER.find(([, modul]) => (modul as Record<string, unknown>)[t.navn] === t.etl);
    if (!funnet) throw new Error(`fant ikke ETL-funksjonen ${t.navn}() for ${t.lag}.${t.navn} i ETL-filene`);
    t.fil = funnet[0];
  }

/* Maskene til et tema i en kommune glemmes når områdene glemmes */
const glemMasker = (start: string) => glem(katalog.solv.naturoppslag, k => k.startsWith(start));

/* Tabellene for hvert naturtema, etter id, til siden og kartet som er felles for temaene: områdene i sølv, og i gull temaet,
   planlagt utbygging i det, og for verdsatt natur kartleggingen og planlagt utbygging utenfor det kartlagte */
export interface Tematabeller {
  omrader: Tabell<string, solvTemaer.Temaomrader>;
  tall: Tabell<string, gullTemaer.Temaet>;
  iPlan: Tabell<string, gullTemaer.TemaIPlan | null>;
  kartlagt: Tabell<string, gullTemaer.Kartleggingen> | null;
  utenforKartlagt: Tabell<string, gullTemaer.UtenforKartlagt | null> | null;
}
export const TEMATABELLER: Record<string, Tematabeller> = {
  vern: {
    omrader: katalog.solv.verneomrader,
    tall: katalog.gull.verneomrader,
    iPlan: katalog.gull.verneomraderIPlan,
    kartlagt: null,
    utenforKartlagt: null
  },
  rein: {
    omrader: katalog.solv.villrein,
    tall: katalog.gull.villrein,
    iPlan: katalog.gull.villreinIPlan,
    kartlagt: null,
    utenforKartlagt: null
  },
  verdi: {
    omrader: katalog.solv.verdsattNatur,
    tall: katalog.gull.verdsattNatur,
    iPlan: katalog.gull.verdsattNaturIPlan,
    kartlagt: katalog.gull.verdsattNaturKartlagt,
    utenforKartlagt: katalog.gull.utbyggingUtenforKartlagt
  }
};
