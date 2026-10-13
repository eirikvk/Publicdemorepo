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
   en ETL-funksjon fyller underveis (gull.utbyggingsblokker og solv.naturmaske). Det sammensatte kartet (solv.sammensatt) har en
   ETL-funksjon, men er voksende: datamotoren legger inn nye fliser etter hvert som de hentes.

   ETL-funksjonene skal være vanlige funksjonserklæringer (export async function), ikke piler: katalogen og ETL-filene bruker hverandre,
   og bare funksjonserklæringer finnes før filene er ferdig lastet. */
import { glem, tabell, type Kildeinfo, type Tabell, type Utgangspunkt } from './cache.ts';
import * as dibk from './bronse/dibk-kommuneplan.ts';
import * as kartverket from './bronse/kartverket.ts';
import * as mdirInon from './bronse/mdir-inon.ts';
import * as mdirNatur from './bronse/mdir-naturtema.ts';
import * as mdirNaturskog from './bronse/mdir-naturskog.ts';
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
import * as solvTemaer from './solv/temaer.ts';
import { PLANNIVA, flisVed, flisnavn, type Fylke, type Flis, type Planruter } from './solv/felles.ts';
import * as solvEgne from './solv/egne.ts';
import type { Egetinn } from './solv/egne.ts';
import type { Maske } from './solv/temaer.ts';
import type { Samling } from './solv/grunnkart.ts';
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
   kontrollert mot Geonorge og data.norge.no 11. oktober 2026, naturskog 13. oktober (produktarket på Geonorge). Brukes av tabellene
   i bronse (kilde) til infoknappene og METODE.md. */
export const KILDE = {
  kartverket: {
    navn: 'Kartverket',
    datasett: 'Administrative enheter, kommuner (Kommuneinfo-API-et)',
    adresse: 'https://kartkatalog.geonorge.no/metadata/041f1e6e-bdbc-4091-b48f-8a5990f3cc5b',
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
  },
  naturskog: {
    navn: 'Miljødirektoratet',
    datasett: 'Naturskog (v1)',
    adresse: 'https://data.norge.no/datasets/faf40899-a6fe-38ce-9419-c4849530a98b',
    lisens: 'NLOD 2.0'
  }
} satisfies Record<string, Kildeinfo>;

export const katalog = {
  bronse: {
    kommuner: tabell<void, Fylke[]>({
      lag: 'bronse',
      navn: 'kommuner',
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
      tittel: 'Kommunegrensen',
      om: 'kommunegrensen fra Kartverket som GeoJSON',
      forklaring: 'Kommunegrensen fra Kartverket.',
      kilde: KILDE.kartverket,
      husk: 6,
      etl: kartverket.kommunegrense
    }),
    bakgrunnsflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'bakgrunnsflis',
      tittel: 'Bakgrunnskartet',
      om: 'fliser av Kartverkets topografiske kart i gråtoner, kalt med flisen [z, x, y]. Lagres ikke: kartet holder de ferdige flisene selv, og nettleseren har sin egen hurtigbuffer.',
      husk: 0,
      nokkel: flisnavn,
      etl: kartverket.bakgrunnsflis,
      eksempel: flisMidt()
    }),
    kommuneIPunkt: tabell<number[], { kommunenummer: string }>({
      lag: 'bronse',
      navn: 'kommuneIPunkt',
      tittel: 'Kommune i et punkt',
      om: 'hvilken kommune et punkt i kartet ligger i, fra Kartverket, når man trykker utenfor valgt kommune. Nøkkel: punktet i hele meter.',
      husk: 20,
      nokkel: kartverket.punktNokkel,
      etl: kartverket.kommuneIPunkt
    }),
    planIPunkt: tabell<number[], unknown>({
      lag: 'bronse',
      navn: 'planIPunkt',
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
      tittel: 'Arealtall fra SSB',
      om: 'arealet per klasse i nyeste år fra SSB, som JSON-stat',
      forklaring:
        'Arealet i km² per arealklasse for kommunen i nyeste år. SSBs nye API (PxWebApi v2) brukes først, og det eldre (v0) hvis det nye ikke svarer. De to gir samme tall.',
      kilde: KILDE.ssb,
      husk: 6,
      etl: ssb.arealtall
    }),
    arealtidsserie: tabell({
      lag: 'bronse',
      navn: 'arealtidsserie',
      tittel: 'Arealtall fra SSB for 2017',
      om: 'arealet per klasse fra 2017 fra SSB, som JSON-stat',
      forklaring:
        'Det samme fra 2017 og fram, med SSBs sammenslåtte tidsserier (kodelisten agg_KommSummer). Da gjelder tallene for 2017 dagens kommune også der kommuner er slått sammen.',
      kilde: KILDE.ssb,
      husk: 6,
      etl: ssb.arealtidsserie
    }),
    arealdetaljer: tabell({
      lag: 'bronse',
      navn: 'arealdetaljer',
      tittel: 'Arealklassene fra SSB, hver for seg',
      om: 'arealet fra 2017 for hver av SSBs arealklasser for seg, som JSON-stat. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Det samme som arealtidsserie, men med hver arealklasse for seg i stedet for summert: bebygd per formål, fulldyrka og ikke fulldyrka jord, skog per treslag og resten av naturen per klasse.',
      kilde: KILDE.ssb,
      husk: 6,
      etl: ssb.arealdetaljer
    }),
    grunnkartflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'grunnkartflis',
      tittel: 'Kartbilder av grunnkartet',
      om: 'kartbilder av dagens arealklasser fra NIBIO, 512 x 512 piksler, kalt med flisen [z, x, y]. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Kartbilder av dagens arealklasser fra NIBIOs grunnkart for arealanalyse, 512 × 512 piksler per flis, med egen stil uten kantstrek (se Arealklassene).',
      kilde: KILDE.grunnkart,
      husk: 400,
      nokkel: flisnavn,
      etl: nibioGrunnkart.grunnkartflis
    }),
    planniva: tabell<void, number>({
      lag: 'bronse',
      navn: 'planniva',
      fil: 'motor/plan.ts',
      tittel: 'Rutestørrelse',
      om: 'nivået i flisnettet utbyggingen regnes på, slik brukeren har valgt under Tekniske valg: 9 (ruter på 21 meter, som er standard) eller 10 (10,6 meter). Datamotoren fyller den. Tom betyr standard.',
      forklaring:
        'Rutestørrelsen brukeren har valgt under Tekniske valg: 21 meter (nivå 9 i flisnettet, som er standard) eller 10,6 meter (nivå 10, et forsøk). På 10 meter hentes også kommuneplanen fra DiBK på nivå 10, med fire ganger så mange kall, og egne områder legges i det samme rutenettet. Alt annet er likt, også regelen om smale striper, som da tar bort felt smalere enn rundt 20 meter i stedet for 40.',
      husk: 1
    }),
    detaljflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'detaljflis',
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
      tittel: 'Register over lagrede klasser',
      om: 'kommunene som har dagens klasser lagret sammen med siden, og blokkene på nivå 9 for hver',
      teknisk: true,
      forklaring: 'Kommunene som har dagens klasser lagret sammen med siden, og blokkene for hver.',
      husk: 1,
      etl: nibioGrunnkart.klasseregister
    }),
    klassefil: tabell<Flis, ArrayBuffer | null>({
      lag: 'bronse',
      navn: 'klassefil',
      tittel: 'Lagrede klasser per blokk',
      om: 'dagens klasser i en blokk på nivå 9 eller 10 slik de er lagret sammen med siden, som PNG med fargetabell, kalt med blokken [z, x, y]. null når blokken ikke er lagret. Nøkkel: blokken som «z/x/y».',
      teknisk: true,
      forklaring:
        'Dagens klasser i en blokk slik de er lagret sammen med siden. Det er svaret fra solv.klasser, laget på forhånd med den samme funksjonen (verktoy/klasser.ts), så ingenting må hentes fra NIBIO.',
      husk: 1024,
      nokkel: flisnavn,
      etl: nibioGrunnkart.klassefil
    }),
    plandekning: tabell({
      lag: 'bronse',
      navn: 'plandekning',
      tittel: 'Bilde av kommuneplanen over kommunen',
      om: 'ett lite bilde av hele kommuneplanen fra DiBK over kommunen',
      forklaring:
        'Et lite bilde av kommuneplanen over hele kommunen, som viser hvor stor del av kommunen planen dekker.',
      kilde: KILDE.dibk,
      husk: 6,
      etl: dibk.plandekning
    }),
    planopplysninger: tabell({
      lag: 'bronse',
      navn: 'planopplysninger',
      tittel: 'Opplysninger om kommuneplanen',
      om: 'hvilken kommuneplan DiBK har, slått opp midt i det planen dekker',
      forklaring:
        'Hvilken kommuneplan DiBK har: plan-id, hvem som har levert den, og når den ble kopiert til DiBK. Slått opp midt i det planen dekker.',
      kilde: KILDE.dibk,
      husk: 6,
      etl: dibk.planopplysninger
    }),
    planoversikt: tabell({
      lag: 'bronse',
      navn: 'planoversikt',
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
      tittel: 'Kartbilder av kommuneplanen',
      om: 'kartbilder av kommuneplanen fra DiBK, 512 x 512 piksler, kalt med flisen [z, x, y]. Nøkkel: flisen som «z/x/y».',
      forklaring:
        'Kartbilder av kommuneplanen fra DiBKs nasjonale tjeneste for kommuneplaner, laget kparealformalomrade, 512 × 512 piksler per flis. Bare flater med arealformål i 1000- og 2000-serien (bebyggelse og anlegg, samferdselsanlegg og teknisk infrastruktur) og arealbruksstatus 2 (framtidig), fylt og uten kantstrek.',
      usikkerhet: [
        'Kommuneplanens arealdel viser hva som er satt av, ikke hva som blir bygd. Reguleringsplaner er ikke med.'
      ],
      kilde: KILDE.dibk,
      husk: 400,
      nokkel: flisnavn,
      etl: dibk.planflis
    }),
    naturskogflis: tabell<[mdirNaturskog.Naturskoglag, Flis], ArrayBuffer>({
      lag: 'bronse',
      navn: 'naturskogflis',
      tittel: 'Kartbilder av naturskog',
      om: 'kartbilder av et lag i Miljødirektoratets kart over naturskog (v1), 512 x 512 piksler, kalt med [lag, flisen]. Bare til visning i kartet, foreløpig bare i tvillingen fra Figma. Nøkkel: «lag/z/x/y».',
      forklaring:
        'Kartbilder fra Miljødirektoratets kart over naturskog, versjon 1: naturskogsnærhet, eller skog etablert før 1940 som ikke er flatehogd. Bare til visning; ingen tall bygger på dem.',
      kilde: KILDE.naturskog,
      husk: 200,
      nokkel: ([l, tc]) => `${l}/${flisnavn(tc)}`,
      etl: mdirNaturskog.naturskogflis
    }),
    inonbilde: tabell({
      lag: 'bronse',
      navn: 'inonbilde',
      tittel: 'Bilde av inngrepsfri natur',
      om: 'bildet av inngrepsfri natur over hele kommunen fra Miljødirektoratet, som PNG',
      forklaring:
        'Ett bilde av hele kommunen fra laget status (nyeste status, 2023), i kommunebildenes rutenett og uten glatting av kantene.',
      kilde: KILDE.inon,
      husk: 6,
      etl: mdirInon.inonbilde
    }),
    graabilder: tabell({
      lag: 'bronse',
      navn: 'graabilder',
      tittel: 'Bilder av grått areal',
      om: 'de to bildene av grått areal over hele kommunen fra NIBIO, som PNG',
      forklaring:
        'To bilder av hele kommunen i kommunebildenes rutenett, med egen stil uten kantstrek: alt grått areal, og flatene med oppgitt andel vegetasjon. Stilen tegner trinn n i rødt med styrken 51 · n, så trinnet kan leses av fargen. Bildene hentes hver for seg, fordi fargene blandes langs kantene i ett bilde.',
      usikkerhet: [
        'Kartet er en testversjon. Andel bygninger er ikke brukt, fordi tjenesten oppga 0 for alle flater som ble slått opp.'
      ],
      kilde: KILDE.graa,
      husk: 6,
      etl: nibioGraa.graabilder
    }),
    graaflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'graaflis',
      tittel: 'Kartbilder av grått areal',
      om: 'kartbilder av grått areal fra NIBIO, 512 x 512 piksler, kalt med flisen [z, x, y]. Nøkkel: flisen som «z/x/y».',
      husk: 400,
      nokkel: flisnavn,
      etl: nibioGraa.graaflis
    }),
    verneomrader: tabell({
      lag: 'bronse',
      navn: 'verneomrader',
      tittel: 'Verneområder',
      om: 'verneområdene i kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Verneområdene fra tjenesten vern, lag 0, der kommunenummeret står i egenskapen for kommune. Flatene hentes som GeoJSON i UTM33, forenklet med 5 meter. Gir tjenesten ikke alle i ett svar, hentes resten side for side.',
      kilde: KILDE.vern,
      husk: 0,
      etl: mdirNatur.verneomrader
    }),
    villrein: tabell({
      lag: 'bronse',
      navn: 'villrein',
      tittel: 'Villreinområder',
      om: 'villreinområdene i kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Leveområdene for villrein fra tjenesten villrein, lag 1, der kommunenummeret står i egenskapen for kommune. Flatene hentes som GeoJSON i UTM33, forenklet med 20 meter. Gir tjenesten ikke alle i ett svar, hentes resten side for side.',
      kilde: KILDE.villrein,
      husk: 0,
      etl: mdirNatur.villrein
    }),
    verdsattNatur: tabell({
      lag: 'bronse',
      navn: 'verdsattNatur',
      tittel: 'Verdsatt natur',
      om: 'naturtyper med verdi i kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Naturtyper med verdikategori svært stor, stor, middels eller noe verdi fra tjenesten naturtyper_kuverdi, lag 0, der kommunenummeret står i egenskapen for kommune. Flatene hentes som GeoJSON i UTM33, forenklet med 5 meter. Gir tjenesten ikke alle i ett svar, hentes resten side for side.',
      kilde: KILDE.verdsatt,
      husk: 0,
      etl: mdirNatur.verdsattNatur
    }),
    kartlagt: tabell({
      lag: 'bronse',
      navn: 'kartlagt',
      tittel: 'Kartlagt for naturtyper',
      om: 'dekningsflatene for naturtypekartlegging rundt kommunen fra Miljødirektoratet, som GeoJSON. Lagres ikke: sølv lagrer det som trengs.',
      forklaring:
        'Dekningsflatene for naturtypekartlegging etter Miljødirektoratets instruks fra tjenesten naturtyper_nin, lag 1: alt innenfor utsnittet rundt kommunen, forenklet med 10 meter. Gir tjenesten ikke alle i ett svar, hentes resten side for side.',
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
        'Egne områder brukeren tegner i kartet, eller en GeoJSON-fil i samme format som DiBKs nedlasting av plandata. Filen leses i nettleseren og sendes ingen steder. Projeksjonen leses fra filen. Mangler den, gjettes grader eller den UTM-sonen som legger planen nærmest kommunen. Tegnede områder under 400 m² avvises.',
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
        'Kommunegrensen i UTM sone 33, og kommunens flate i km², rettet for målestokken i UTM (se Felles grunnlag).',
      husk: 6,
      etl: solvKommune.grense
    }),
    arealtall: tabell({
      lag: 'solv',
      navn: 'arealtall',
      tittel: 'Arealtall per klasse',
      om: 'arealet per klasse i nyeste år, med landareal, innsjø og elv',
      forklaring:
        'SSBs arealklasser summeres til bebygd, jordbruk og natur (se Arealklassene), og innsjø og elv tas ut for seg. Landarealet er summen av de tre klassene på land.',
      husk: 6,
      etl: solvSsb.arealtall
    }),
    historie: tabell({
      lag: 'solv',
      navn: 'historie',
      tittel: 'Arealtall i 2017 og nå',
      om: 'arealet per klasse i 2017 og i nyeste år',
      forklaring:
        'Arealet per klasse i 2017 og i nyeste år, summert på samme måte. Avviker kommunens samlede areal med mer enn 0,5 % mellom årgangene, er grensen trolig flyttet, og årgangene sammenlignes ikke.',
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
    klasser: tabell<Flis, solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'klasser',
      tittel: 'Dagens klasser per blokk',
      om: 'dagens klasse per rute i en blokk, kalt med blokken [z, x, y]: på nivå 9 er ruta 21 meter, laget av de fire kartbildene fra NIBIO som dekker blokken, og på nivå 10 er ruta 10,6 meter og blokken ett kartbilde. For noen kommuner ligger svaret lagret sammen med siden (bronse.klassefil), og da hentes ingenting fra NIBIO. Nøkkel: blokken som «z/x/y».',
      forklaring:
        'Dagens klasse per rute i en blokk på 512 × 512 ruter (se Arealklassene). På 21 meter er den laget av de fire kartbildene fra NIBIO som dekker blokken, og på 10,6 meter av ett. For 42 kommuner ligger svaret lagret sammen med siden. For de andre, og for en lagret blokk som ikke kan leses, lages det av kartbildene når kommunen velges.',
      husk: 0,
      nokkel: flisnavn,
      etl: solvGrunnkart.klasser,
      lagret: solvGrunnkart.lagredeKlasser,
      eksempel: flisMidt(PLANNIVA)
    }),
    detaljklasser: tabell<Flis, solvGrunnkart.Klasser>({
      lag: 'solv',
      navn: 'detaljklasser',
      tittel: 'Detaljklasser per blokk',
      om: 'detaljklassen per rute i en blokk på nivå 10 (10,6 meter), kalt med blokken [10, x, y], laget av ett kartbilde fra NIBIO (bronse.detaljflis). For noen kommuner ligger svaret lagret sammen med siden (bronse.detaljfil). Nøkkel: blokken som «z/x/y».',
      forklaring:
        'Detaljklassen per rute i en blokk på 512 × 512 ruter à 10,6 meter. Klassen leses av fargen som for dagens klasser: det det er mest av, når fargen er en blanding. Foreløpig lagret bare for Trondheim.',
      husk: 64,
      nokkel: flisnavn,
      etl: solvGrunnkart.detaljklasser,
      lagret: solvGrunnkart.lagredeDetaljklasser,
      eksempel: flisMidt(10)
    }),
    detaljblokker: tabell<string, Flis[]>({
      lag: 'solv',
      navn: 'detaljblokker',
      tittel: 'Blokkene med detaljklasser',
      om: 'blokkene på nivå 10 med lagrede detaljklasser for kommunen, som [10, x, y], fra registeret (bronse.detaljregister). Tom når kommunen ikke har lagrede detaljklasser.',
      teknisk: true,
      forklaring: 'Blokkene der detaljklassene er lagret sammen med siden, for kommunen.',
      husk: 12,
      etl: solvGrunnkart.detaljblokker
    }),
    blokker: tabell<[string, number], Flis[]>({
      lag: 'solv',
      navn: 'blokker',
      tittel: 'Blokkene i kommunen',
      om: 'blokkene på nivå 9 eller 10 der kommunen har minst én rute, etter halvregelen, kalt med [kommunenummer, nivå]. For kommunene med lagrede klasser står listen i registeret (bronse.klasseregister). Nøkkel: «nummer/nivå».',
      teknisk: true,
      forklaring:
        'Blokkene der kommunen har minst én rute, etter halvregelen. For kommunene med lagrede klasser står listen i registeret.',
      husk: 12,
      nokkel: ([nr, z]) => `${nr}/${z}`,
      etl: solvGrunnkart.blokker,
      lagret: solvGrunnkart.lagredeBlokker
    }),
    klassekart: tabell<string, solvGrunnkart.Oversikt>({
      lag: 'solv',
      navn: 'klassekart',
      tittel: 'Dagens klasser satt sammen av blokkene',
      om: 'dagens klasser for kommunen zoomet ut, satt sammen av blokkene (solv.klasser), med høyst 2048 piksler på lengste side. Lages for alle kommuner: av de lagrede blokkene, eller av kartbildene fra NIBIO, som da hentes for hele kommunen.',
      teknisk: true,
      forklaring: 'Dagens klasser for hele kommunen zoomet ut, satt sammen av blokkene, til kartet.',
      husk: 1,
      etl: solvGrunnkart.klassekart
    }),
    sammensatt: tabell<string, Samling>({
      lag: 'solv',
      navn: 'sammensatt',
      tittel: 'Sammensatt kart',
      om: 'dagens klasser satt sammen av kartbildene fra NIBIO som er hentet. Kartet viser det mens blokkene for hele kommunen hentes, og tallene bygger på det når blokkene ikke kan lages. Datamotoren legger inn nye fliser etter hvert som de hentes.',
      forklaring:
        'Dagens klasser satt sammen av kartbildene som er hentet, flis for flis. Kartet viser det mens blokkene hentes. Tallene bygger bare på det når blokkene ikke kan lages, og gjelder da den delen av kommunen brukeren har sett på i kartet. En piksel leses når den er minst 100 av 255 dekket, og får klassen det er mest av.',
      usikkerhet: [
        'Kan ikke blokkene hentes fra NIBIO, er bare den delen av kommunen nettleseren har hentet kart for, med, og det sammensatte kartet er grovere enn rutene på 21 meter i store kommuner. Siden sier fra når det gjelder.'
      ],
      husk: 4,
      voksende: true,
      etl: solvGrunnkart.sammensatt
    }),
    egne: tabell({
      lag: 'solv',
      navn: 'egne',
      tittel: 'Egne områder, tolket',
      om: 'de egne områdene i kommunen med om hver flate er utbygging. Tegnede områder har typen brukeren valgte, og flatene i en opplastet plan får typen etter arealformål og status.',
      forklaring:
        'Hver flate er utbygging eller ikke. I en opplastet fil er arealformål i 1000- og 2000-serien med status framtidig, eller uten status, utbygging, slik som for kommuneplanen. Andre flater med arealformål er ikke utbygging. Har filen ingen arealformål, er alle flatene utbygging. Et tegnet område er utbygging, og kan settes til ikke utbygging.',
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
        'Flatene legges i planrutenettet etter halvregelen, i samme datamodell som kommuneplanen. Der flater i samme område overlapper, vinner utbygging. Der områder overlapper, gjelder det siste.',
      husk: 6,
      brukerstyrt: true,
      etl: solvEgne.egneruter
    }),
    plandekning: tabell({
      lag: 'solv',
      navn: 'plandekning',
      tittel: 'Hvor mye planen dekker',
      om: 'hvor stor del av kommunen kommuneplanen dekker, og rutene med plan',
      forklaring:
        'Hvor stor del av kommunen kommuneplanen dekker, fra bildet over hele kommunen. Langs grensen stikker naboenes planer litt inn, så under 15 % regnes som at DiBK ikke har kommuneplanen.',
      husk: 6,
      etl: solvPlan.plandekning
    }),
    planinfo: tabell({
      lag: 'solv',
      navn: 'planinfo',
      tittel: 'Kommuneplanen',
      om: 'om DiBK har kommuneplanen, hvor stor del av kommunen den dekker, og hvilken plan det er',
      forklaring:
        'Om DiBK har kommuneplanen for kommunen, hvor stor del av kommunen den dekker, og hvilken plan det er.',
      usikkerhet: ['Ikke alle kommuner har planen sin hos DiBK. Oslo mangler.'],
      husk: 6,
      etl: solvPlan.planinfo
    }),
    planoversikt: tabell({
      lag: 'solv',
      navn: 'planoversikt',
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
      tittel: 'Kommuneplanen per rute',
      om: 'kommuneplanen fra DiBK i én flis som planen per rute, i samme datamodell som egne områder: 1 der planen dekker minst halve ruta. Kalt med flisen [z, x, y]. Lagres ikke: blokkene i utbyggingen lagres, og kartbildet i bronse holder for å lage den på nytt.',
      forklaring:
        'Kommuneplanen per rute: en rute er planlagt utbygging når planen dekker minst halve ruta. Samme datamodell som egne områder.',
      husk: 0,
      nokkel: flisnavn,
      etl: solvPlan.kommuneplanruter,
      eksempel: flisMidt(PLANNIVA)
    }),
    inon: tabell({
      lag: 'solv',
      navn: 'inon',
      tittel: 'Inngrepsfri natur per rute',
      om: 'sonen per rute i bildet av kommunen, og antall ruter per sone innenfor kommunen',
      forklaring:
        'Hver rute som er minst halvt dekket, får sonen fargen ligger nærmest: sone 2 (1–3 km fra inngrep), sone 1 (3–5 km) eller villmarkspreget (5 km eller mer). Rutene innenfor kommunegrensen telles per sone.',
      husk: 3,
      etl: solvInon.inon
    }),
    graa: tabell({
      lag: 'solv',
      navn: 'graa',
      tittel: 'Grått areal per rute',
      om: 'trinnet per rute i bildet av kommunen, og antall ruter per trinn innenfor kommunen',
      forklaring:
        'Hver rute får et trinn etter andel vegetasjon i flaten: under 1 %, 1–25 %, 25–50 %, 50–75 % eller 75–100 %. Grått areal uten oppgitt andel, som veier, er et eget trinn. En rute er grå når den er minst halvt dekket. Rutene innenfor kommunen telles per trinn.',
      husk: 3,
      etl: solvGraa.graa
    }),
    planIPunkt: tabell<number[], solvPunkt.Punktflate[]>({
      lag: 'solv',
      navn: 'planIPunkt',
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
        'Hver flate klippes mot kommunegrensen, og arealet av det som ligger i kommunen, regnes ut. Feiler klippingen, tegnes flaten i et rutenett og klippes mot kommunen der, og arealet regnes av dekningen.',
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
        'Hver flate klippes mot kommunegrensen, og arealet av det som ligger i kommunen, regnes ut. Feiler klippingen, tegnes flaten i et rutenett og klippes mot kommunen der, og arealet regnes av dekningen.',
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
        'Lokalitetene sorteres med høyest verdi først, og så etter areal, så en rute med planlagt utbygging der lokaliteter overlapper, regnes til den høyeste. Har to lokaliteter samme verdi og samme areal, avgjør rekkefølgen fra tjenesten.',
      usikkerhet: [
        'Arealet per lokalitet i listen er arealet av hele lokaliteten, også en del som ligger utenfor kommunen. Summene per verdikategori er klippet mot kommunen.'
      ],
      husk: 30,
      etl: solvTemaer.verdsattNatur,
      glemt: (_, nr) => glemMasker('verdi/' + nr + '/')
    }),
    verdsattNaturAreal: tabell({
      lag: 'solv',
      navn: 'verdsattNaturAreal',
      tittel: 'Arealet av verdsatt natur',
      om: 'arealet av verdsatt natur i kommunen, samlet og per verdikategori',
      forklaring:
        'Flatene tegnes i et rutenett over kommunen, én tegning per verdikategori, der alle flater med minst den verdien tegnes som én form og klippes mot kommunen. Forskjellen mellom tegningene gir arealet per kategori. Der lokaliteter overlapper, teller den høyeste verdien, slik kartet også viser det, så ingenting telles to ganger.',
      husk: 30,
      etl: solvTemaer.verdsattNaturAreal
    }),
    kartlagt: tabell({
      lag: 'solv',
      navn: 'kartlagt',
      tittel: 'Det kartlagte',
      om: 'det som er kartlagt for naturtyper etter Miljødirektoratets instruks, klippet mot kommunen',
      forklaring: 'Dekningsflatene slås sammen og klippes mot kommunen.',
      usikkerhet: ['Dekningsflatene kan ligge delvis i vann, mens kartleggingsgraden regnes av landarealet.'],
      husk: 30,
      etl: solvTemaer.kartlagt,
      glemt: (_, nr) => glemMasker('kartlagt/' + nr)
    }),
    naturmaske: tabell<string, Maske | null>({
      lag: 'solv',
      navn: 'naturmaske',
      fil: 'solv/temaer.ts',
      tittel: 'Masker for områdene',
      om: 'hjelpetabell: områdene i naturtemaene og det kartlagte som masker i et rutenett, til kryssingen med utbyggingen. Nøkkel: tema/kommune/plassen til området. Lages første gang en rute med planlagt utbygging treffer området.',
      forklaring:
        'Hvert område, og det kartlagte, får en maske: et lite rutenett med dekningen per rute. Masken lages første gang en rute med planlagt utbygging treffer området.',
      husk: Infinity
    })
  },
  gull: {
    detaljareal: tabell({
      lag: 'gull',
      navn: 'detaljareal',
      tittel: 'Areal per detaljklasse',
      om: 'arealet i km² per detaljklasse i kommunen, av blokkene på 10,6 meter klippet til kommunen etter halvregelen. Bare for kommunene med lagrede detaljklasser, ellers null. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Arealet per detaljklasse i kommunen fra grunnkartet: barskog, lauvskog og blandingsskog, med tresatt myr og tresatt innmarksbeite for seg, åpen våtmark og de andre økosystemtypene. Bare for kommuner der detaljklassene er lagret.',
      usikkerhet: [
        'Klassen leses av fargen i kartbildet, og i kanten mellom to flater blander NIBIO fargene. Smale flater, som elver og bekker, blir derfor for små.'
      ],
      husk: 12,
      etl: gullGrunnkart.detaljareal
    }),
    detaljerIVerneomrader: tabell({
      lag: 'gull',
      navn: 'detaljerIVerneomrader',
      tittel: 'Areal per detaljklasse i verneområdene',
      om: 'arealet i km² per detaljklasse innenfor verneområdene i kommunen, av blokkene på 10,6 meter. Ruter teller når verneområdene dekker minst halve ruta. Bare for kommunene med lagrede detaljklasser, ellers null. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Grunnkartets økosystemtyper i verneområdene: hvor mye av det vernede som er skog, våtmark, fjell, hav og så videre. Der verneområder overlapper, telles arealet én gang. Bare for kommuner der detaljklassene er lagret.',
      husk: 12,
      etl: gullGrunnkart.detaljerIVerneomrader
    }),
    skog: tabell({
      lag: 'gull',
      navn: 'skog',
      tittel: 'Skog i grunnkartet',
      om: 'skogen i kommunen fra grunnkartet: arealet, andelen av landarealet i grunnkartet, og arealet per treslag og per underlag (fastmark, tresatt myr, tresatt innmarksbeite). Bare for kommunene med lagrede detaljklasser. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Skog er økosystemtypen skog i grunnkartet, også tresatt myr og tresatt innmarksbeite. Arealet summeres fra detaljklassene, og andelen er av landarealet i grunnkartet (alt unntatt hav, innsjøer og elver).',
      husk: 12,
      etl: gullOkosystemer.skog
    }),
    vatmark: tabell({
      lag: 'gull',
      navn: 'vatmark',
      tittel: 'Våtmark i grunnkartet',
      om: 'våtmarken i kommunen fra grunnkartet: åpen våtmark og tresatt myr, samlet og hver for seg, og andelen av landarealet i grunnkartet. Bare for kommunene med lagrede detaljklasser. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Våtmark er økosystemtypen våtmark (åpen myr og annen åpen våtmark) og tresatt myr, som skissene regner med i våtmarken. Tresatt myr er dermed både skog og våtmark.',
      husk: 12,
      etl: gullOkosystemer.vatmark
    }),
    vernetNatur: tabell({
      lag: 'gull',
      navn: 'vernetNatur',
      tittel: 'Naturen i verneområdene',
      om: 'det vernede arealet per økosystemtype i grunnkartet, på land, i sjø og i ferskvann, andelen vernet land av landarealet i grunnkartet, og skogen som er vernet. Bare for kommunene med lagrede detaljklasser. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Arealet per detaljklasse innenfor verneområdene, summert til økosystemtypene på nivå 1 og til land, sjø og ferskvann.',
      husk: 12,
      etl: gullOkosystemer.vernetNatur
    }),
    planPerOkosystem: tabell({
      lag: 'gull',
      navn: 'planPerOkosystem',
      tittel: 'Planlagt utbygging per økosystemtype',
      om: 'natur og jordbruk satt av til utbygging per økosystemtype i grunnkartet, med andelen av typen i kommunen, og våtmarken som er satt av. Bare for kommunene med lagrede detaljklasser. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Planlagt utbygging per detaljklasse, summert til økosystemtypene på nivå 1. Andelen er arealet satt av delt på arealet av typen i kommunen.',
      husk: 6,
      brukerstyrt: true,
      etl: gullOkosystemer.planPerOkosystem
    }),
    vernPerVerneform: tabell({
      lag: 'gull',
      navn: 'vernPerVerneform',
      tittel: 'Vernet areal per verneform',
      om: 'det vernede arealet i kommunen per verneform fra Miljødirektoratet. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring: 'Arealet av verneområdene i kommunen summert per verneform.',
      husk: 12,
      etl: gullTemaer.vernPerVerneform
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
    grunnkartAreal: tabell({
      lag: 'gull',
      navn: 'grunnkartAreal',
      tittel: 'Arealet per klasse i grunnkartet',
      om: 'arealet i km² per klasse i grunnkartet for kommunen (bebygd, jordbruk, natur, hav, innsjø og elv), talt i bildet av dagens klasser zoomet ut. Henter ingenting i tillegg. Bare for valgt kommune.',
      forklaring:
        'Arealet per klasse i grunnkartet, talt i bildet av dagens klasser for hele kommunen, som kartet alt viser. En piksel teller når den er minst halvt dekket.',
      husk: 1,
      brukerstyrt: true,
      etl: gullGrunnkart.grunnkartAreal
    }),
    okosystemfordeling: tabell({
      lag: 'gull',
      navn: 'okosystemfordeling',
      tittel: 'Hovedøkosystemer per kommune 2024 (syntetisk)',
      om: 'SYNTETISK: arealet per hovedøkosystem i kommunen i 2024, i samme form som SSBs tabell som publiseres 25. november 2026. Grunnkartets areal for bebygd, jordbruk, natur og vann, delt videre etter andelene i SSBs arealklasser for 2024. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Syntetiske tall til SSBs tabell kommer. Bebygd, jordbruk, natur og vann er grunnkartets areal. Jordbruket og naturen deles på hovedøkosystemene etter andelene i SSBs arealklasser for 2024, med en fast nøkkel.',
      usikkerhet: [
        'Syntetiske tall: en tommelfingerregel som står i stedet for SSBs tabell til den publiseres. Kyststrender, svaberg og dyner kan ikke skilles ut og blir 0.'
      ],
      husk: 1,
      brukerstyrt: true,
      etl: gullSyntetisk.okosystemfordeling
    }),
    bebygdEndring: tabell({
      lag: 'gull',
      navn: 'bebygdEndring',
      tittel: 'Endring mellom bebygd og landklassene 2017–2024 (syntetisk)',
      om: 'SYNTETISK: arealet fra hver landklasse til bebygd, og fra bebygd til klassen, fra 2017 til 2024, i samme form som SSBs tabell som publiseres 25. november 2026. Anslått av SSBs arealklasser for de to årene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Syntetiske tall til SSBs tabell kommer. SSBs arealklasser for 2017 og 2024 oversettes til hovedøkosystemer med en fast nøkkel, og økningen i bebygd fordeles på landklassene som gikk ned, i forhold til hvor mye hver gikk ned.',
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
      husk: 1,
      brukerstyrt: true,
      etl: gullSyntetisk.oversiktKort
    }),
    nedbygging: tabell({
      lag: 'gull',
      navn: 'nedbygging',
      tittel: 'Nedbygd per landklasse 2017–2024 (syntetisk)',
      om: 'hvor mye av hver landklasse som ble bygget ned fra 2017 til 2024, med arealet i 2024 og andelen av arealet i 2017, og summen for natur og jordbruk, fra de syntetiske tabellene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring: 'Arealet fra hver landklasse til bebygd, med andelen av arealet klassen hadde i 2017.',
      husk: 1,
      brukerstyrt: true,
      etl: gullSyntetisk.nedbygging
    }),
    okosystemregnskap: tabell({
      lag: 'gull',
      navn: 'okosystemregnskap',
      tittel: 'Regnskap per hovedøkosystem 2017–2024 (syntetisk)',
      om: 'SYNTETISK: arealet per hovedøkosystem på land i 2017 (inngående), endringen mot bebygd og arealet i 2024 (utgående), satt opp som et regnskap fra de syntetiske tabellene. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Arealet i 2024 med det som gikk til og fra bebygd lagt tilbake gir arealet i 2017. Summen for land er den samme begge år.',
      husk: 1,
      brukerstyrt: true,
      etl: gullSyntetisk.okosystemregnskap
    }),
    dagensKlasser: tabell({
      lag: 'gull',
      navn: 'dagensKlasser',
      tittel: 'Dagens klasser',
      om: 'dagens klasser for kommunen, på tvers av de to kildene i sølv: blokkene for hele kommunen, lagret eller hentet fra NIBIO, og det sammensatte kartet av det som er hentet når blokkene ikke kan lages. Utbyggingen, kartet og sidene leser dagens klasser herfra. Bare for valgt kommune, så den ikke holder på bilder sølv har sluppet.',
      forklaring:
        'Dagens klasser for hele kommunen, satt sammen av blokkene. For kommunene med lagrede klasser ligger blokkene ferdig sammen med siden. For de andre hentes kartbildene fra NIBIO når kommunen velges, og blokkene lages med den samme funksjonen. Kan ikke blokkene lages, brukes det sammensatte kartet av det som er hentet.',
      husk: 1,
      brukerstyrt: true,
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
      om: 'utbyggingen: kommuneplanen og egne områder lagt oppå dagens klasser, i ruter på 21 meter (eller 10,6 meter, valgt under Tekniske valg) med smale striper tatt bort. Én rad per rute med planlagt utbygging på natur eller jordbruk. Rutenettene er glisne: bare blokkene med noe i finnes. Midtpunktet: alle kryssinger med planlagt utbygging går gjennom den.',
      forklaring:
        'For hver blokk legges planen oppå dagens klasser, rute for rute. Ruter kommunen dekker mindre enn halvparten av, er ikke med. Ruter som i dag er natur eller jordbruk og planlagt utbygging, merkes. Ruter som alt er bebygd eller vann, merkes ikke. Egne områder erstatter kommuneplanen innenfor flatene: som utbygging tar de all natur og alt jordbruk i ruta, og som ikke utbygging fjerner de det planen setter av der. Så tas smale striper ut: først finnes kjernene, ruter med planlagt utbygging på alle fire sider, og så beholdes alt som henger sammen med en kjerne, også bare på skrå. Felt som ikke er bredere enn rundt 40 meter noe sted, faller bort. Ruter som ikke er hentet, regnes som naboer, så felt ikke skrelles av langs kanten av det som er hentet. Med egne områder regnes alt både med og uten dem.',
      usikkerhet: [
        'Rutenettet overser bebygde flater som er smalere enn en rute, særlig veier. Regelen om smale striper tar bort det meste av dette, men også noe som er reelt: smale felt og nye veier.'
      ],
      husk: 1,
      brukerstyrt: true,
      etl: gullUtbygging.utbygging
    }),
    utbyggingsblokker: tabell<string, Map<string, Blokk>>({
      lag: 'gull',
      navn: 'utbyggingsblokker',
      fil: 'gull/utbygging.ts',
      tittel: 'Utbyggingen i blokker',
      om: 'hjelpetabell: utbyggingen i blokker på 512 x 512 ruter, én per flis på nivå 9, så bare blokker med nytt kart regnes ut på nytt',
      teknisk: true,
      forklaring: 'Utbyggingen i blokker på 512 × 512 ruter, så bare blokker med nytt kart regnes ut på nytt.',
      husk: 1,
      voksende: true
    }),
    planlagt: tabell({
      lag: 'gull',
      navn: 'planlagt',
      tittel: 'Planlagt utbygging',
      om: 'natur og jordbruk som planen setter av, med andeler',
      forklaring:
        'De beholdte rutene telles for natur og jordbruk og regnes om til areal. Prosenten er andelen av rutene som i dag er natur, eller jordbruk, i det samme rutenettet. Tallet med smale striper står i parentes.',
      husk: 6,
      brukerstyrt: true,
      etl: gullPlan.planlagt
    }),
    planlagtPerDetaljklasse: tabell({
      lag: 'gull',
      navn: 'planlagtPerDetaljklasse',
      tittel: 'Planlagt utbygging per detaljklasse',
      om: 'natur og jordbruk satt av til utbygging, fordelt på detaljklassene i grunnkartet: hver rute får den detaljklassen av riktig slag det er mest av i ruta. Summen er den samme som i gull.plansum. Bare for kommunene med lagrede detaljklasser, ellers null. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Planlagt utbygging per økosystemtype i grunnkartet: hvor mye av naturen som settes av, er skog, våtmark, tresatt myr og så videre. Hver rute med planlagt utbygging får den typen det er mest av i ruta, så summen er den samme som natur og jordbruk satt av. Bare for kommuner der detaljklassene er lagret.',
      husk: 6,
      brukerstyrt: true,
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
      om: 'inngrepsfri natur innenfor villreinområdene i kommunen: arealet samlet og per sone, og andelen av villreinområdene. Begge arealene telles i rutenettet for inngrepsfri natur. null uten villreinområder. Brukes foreløpig bare av tvillingen fra Figma.',
      forklaring:
        'Villreinområdene tegnes i det samme rutenettet som inngrepsfri natur. Rutene som er minst halvt dekket av villreinområdene, telles, og av dem rutene som ligger i en sone for inngrepsfri natur. Andelen er inngrepsfri natur av villreinområdene i kommunen.',
      husk: 12,
      etl: gullInon.inonIVillrein
    }),
    graakryss: tabell({
      lag: 'gull',
      navn: 'graakryss',
      tittel: 'Grått areal krysset med utbyggingen',
      om: 'utbyggingen krysset med grått areal: planlagt utbygging på land, også der det alt er bebygd, og grønt i bebygd område',
      forklaring:
        'Midtpunktet i hver rute med planlagt utbygging på land slås opp i bildet av grått areal. Her er alle ruter med, også der det alt er bebygd og i smale striper. Grønt i bebygd område er ruter som er bebygd i grunnkartet, men ikke grå.',
      usikkerhet: [
        'Totalen for planlagt utbygging på land er større enn tallet for planlagt utbygging på natur og jordbruk, fordi den også tar med ruter som alt er bebygd, og smale striper.'
      ],
      husk: 6,
      brukerstyrt: true,
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
      om: 'planlagt utbygging på grått areal, og grønt i bebygd område',
      forklaring:
        'Planlagt utbygging på grått areal, på grått areal med minst halvparten vegetasjon (trinnene fra 50 % og opp), og på grønt i bebygd område.',
      husk: 6,
      brukerstyrt: true,
      etl: gullGraa.graaIPlan
    }),
    verneomrader: tabell({
      lag: 'gull',
      navn: 'verneomrader',
      tittel: 'Verneområder',
      om: 'verneområdene i kommunen: listen, arealet og andelen av landarealet',
      forklaring: 'Arealet i kommunen er summen av områdene, og andelen er regnet av landarealet.',
      usikkerhet: [
        'Verneområder kan ligge i sjø og innsjøer, men andelen regnes av landarealet. I kystkommuner kan den bli høy, og over 100 %, for eksempel på Frøya.',
        'Overlapper to områder, telles overlappet to ganger i summen.'
      ],
      husk: 6,
      etl: gullTemaer.verneomrader
    }),
    utbyggingIVerneomrader: tabell({
      lag: 'gull',
      navn: 'utbyggingIVerneomrader',
      tittel: 'Utbyggingen i verneområder',
      om: 'kolonnen for verneområdene i utbyggingen: hvilket område hver rad ligger i',
      forklaring:
        'Midtpunktet i hver rute med planlagt utbygging slås opp i maskene. Ruta hører til området når masken er minst halvt dekket der, og til det første området den treffer, så den telles én gang per tema. Det gir en kolonne i utbyggingen: hvilket område hver rute ligger i.',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVerneomrader
    }),
    verneomraderIPlan: tabell({
      lag: 'gull',
      navn: 'verneomraderIPlan',
      tittel: 'Verneområder i planen',
      om: 'planlagt utbygging innenfor verneområdene, samlet og per område: summene over kolonnen',
      forklaring:
        'Rutene summeres per område, og for verdsatt natur per verdikategori, og regnes om til areal. Ruter i smale striper telles for seg.',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.verneomraderIPlan
    }),
    villrein: tabell({
      lag: 'gull',
      navn: 'villrein',
      tittel: 'Villreinområder',
      om: 'villreinområdene i kommunen: listen, arealet og andelen av landarealet',
      forklaring: 'Arealet i kommunen er summen av områdene, og andelen er regnet av landarealet.',
      usikkerhet: ['Overlapper to områder, telles overlappet to ganger i summen.'],
      husk: 6,
      etl: gullTemaer.villrein
    }),
    utbyggingIVillrein: tabell({
      lag: 'gull',
      navn: 'utbyggingIVillrein',
      tittel: 'Utbyggingen i villreinområder',
      om: 'kolonnen for villreinområdene i utbyggingen: hvilket område hver rad ligger i',
      forklaring:
        'Midtpunktet i hver rute med planlagt utbygging slås opp i maskene. Ruta hører til området når masken er minst halvt dekket der, og til det første området den treffer, så den telles én gang per tema. Det gir en kolonne i utbyggingen: hvilket område hver rute ligger i.',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVillrein
    }),
    villreinIPlan: tabell({
      lag: 'gull',
      navn: 'villreinIPlan',
      tittel: 'Villreinområder i planen',
      om: 'planlagt utbygging innenfor villreinområdene, samlet og per område: summene over kolonnen',
      forklaring:
        'Rutene summeres per område, og for verdsatt natur per verdikategori, og regnes om til areal. Ruter i smale striper telles for seg.',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.villreinIPlan
    }),
    verdsattNatur: tabell({
      lag: 'gull',
      navn: 'verdsattNatur',
      tittel: 'Verdsatt natur',
      om: 'verdsatt natur i kommunen: lokalitetene, arealet samlet og per verdikategori, og andelen av landarealet',
      forklaring:
        'Arealet samlet og per verdikategori fra rutenettet i sølv, antall lokaliteter per kategori, og andelen av landarealet.',
      husk: 6,
      etl: gullTemaer.verdsattNatur
    }),
    verdsattNaturIKartlagt: tabell({
      lag: 'gull',
      navn: 'verdsattNaturIKartlagt',
      tittel: 'Verdsatt natur i det kartlagte',
      om: 'verdsatt natur per verdikategori innenfor det kartlagte',
      forklaring:
        'Verdsatt natur per verdikategori innenfor det kartlagte, med det samme rutenettet som arealet per kategori.',
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
      om: 'kolonnen for verdsatt natur i utbyggingen: hvilket område hver rad ligger i',
      forklaring:
        'Midtpunktet i hver rute med planlagt utbygging slås opp i maskene. Ruta hører til området når masken er minst halvt dekket der, og til det første området den treffer, så den telles én gang per tema. Det gir en kolonne i utbyggingen: hvilket område hver rute ligger i.',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVerdsattNatur
    }),
    verdsattNaturIPlan: tabell({
      lag: 'gull',
      navn: 'verdsattNaturIPlan',
      tittel: 'Verdsatt natur i planen',
      om: 'planlagt utbygging i verdsatt natur: per verdikategori og de berørte lokalitetene, summert over kolonnen',
      forklaring:
        'Rutene summeres per område, og for verdsatt natur per verdikategori, og regnes om til areal. Ruter i smale striper telles for seg.',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.verdsattNaturIPlan
    }),
    utbyggingUtenforKartlagt: tabell({
      lag: 'gull',
      navn: 'utbyggingUtenforKartlagt',
      tittel: 'Utbygging utenfor det kartlagte',
      om: 'planlagt utbygging på natur, og hvor mye av den som ligger utenfor det kartlagte for naturtyper',
      forklaring:
        'Rutene med planlagt utbygging på natur, uten smale striper, deles i kartlagt og ikke kartlagt ved å slå opp midtpunktet i masken for det kartlagte.',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingUtenforKartlagt
    }),
    egneRader: tabell({
      lag: 'gull',
      navn: 'egneRader',
      tittel: 'Egne områder mot kommuneplanen',
      om: 'sammenligningen mellom kommuneplanen og egne områder, for hele kommunen og hvert område',
      forklaring:
        'For hvert område telles hva som ligger der i dag, hva planen alene tar, og hva som tas med egne områder. Radene viser kommuneplanen alene, tallet med egne områder og forskjellen, for natur, jordbruk, grått areal, verneområder, villreinområder, verdsatt natur per verdi og natur som ikke er kartlagt.',
      usikkerhet: [
        'Lastes kommuneplanen selv opp, kan tabellen vise små forskjeller som bare kommer av at flatene legges i rutenettet på en annen måte enn bildene fra DiBK.'
      ],
      husk: 6,
      brukerstyrt: true,
      etl: gullEgne.egneRader
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
  ['bronse/mdir-naturskog.ts', mdirNaturskog],
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
const glemMasker = (start: string) => glem(katalog.solv.naturmaske, k => k.startsWith(start));

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
