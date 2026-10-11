/* Katalogen: ETL-pipelinen, som en liste over tabeller i tre lag, slik Unity Catalog har katalog.skjema.tabell. Hver tabell er en
   ETL-funksjon i bronse, sølv eller gull, med samme navn som tabellen: katalog.solv.inon er inon() i solv/inon.ts. Man kaller
   tabellen med nøkkelen, som regel kommunenummeret: katalog.gull.verneomrader('5001').

   Hvor dataene kommer fra, ser man i ETL-funksjonen selv: den kaller katalogen etter det den bygger på. Åpner man
   gull.verneomrader, ser man at den kaller solv.verneomrader, og der at den kaller bronse.verneomrader, og så videre ned til kilden.

   Svarene huskes i cachen (cache.ts). Her står bare et kort, lesbart navn (tittel), hva tabellen er (om), og hvor mange nøkler som huskes (husk). Svar fra
   kildene og tolkingen av dem er store og huskes for noen få kommuner. Gull er små tabeller og huskes for flere. Tabeller merket
   brukerstyrt bygger på det brukeren gjør, og regnes ut på nytt når datamotoren sier fra om at det er endret.
   Tabeller uten ETL-funksjon er kildene fra brukeren, som datamotoren fyller (bronse.egne og solv.sammensatt), og hjelpetabeller som
   en ETL-funksjon fyller underveis (gull.utbyggingsblokker og solv.naturmaske).

   ETL-funksjonene skal være vanlige funksjonserklæringer (export async function), ikke piler: katalogen og ETL-filene bruker hverandre,
   og bare funksjonserklæringer finnes før filene er ferdig lastet. */
import { glem, tabell, type Tabell } from './cache.ts';
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
import * as solvSsb from './solv/ssb.ts';
import * as solvTemaer from './solv/temaer.ts';
import { flisnavn, type Fylke, type Flis, type Planruter } from './solv/felles.ts';
import * as solvEgne from './solv/egne.ts';
import type { Egetinn } from './solv/egne.ts';
import type { Maske } from './solv/temaer.ts';
import type { Samling } from './solv/grunnkart.ts';
import type { Oversiktsregister } from './bronse/nibio-grunnkart.ts';
import * as gullEgne from './gull/egne.ts';
import * as gullGraa from './gull/graa.ts';
import * as gullInon from './gull/inon.ts';
import * as gullPlan from './gull/planlagt.ts';
import * as gullRegnskap from './gull/regnskap.ts';
import * as gullTemaer from './gull/temaer.ts';
import * as gullUtbygging from './gull/utbygging.ts';
import type { Blokk, Utbygging } from './gull/utbygging.ts';

const URL_NOKKEL = 'Nøkkel: adressen.';

export const katalog = {
  bronse: {
    kommuner: tabell<void, Fylke[]>({
      lag: 'bronse',
      navn: 'kommuner',
      tittel: 'Fylker og kommuner',
      om: 'fylkene og kommunene, sortert etter navn',
      husk: 1,
      etl: kartverket.kommuner
    }),
    kommunegrense: tabell({
      lag: 'bronse',
      navn: 'kommunegrense',
      tittel: 'Kommunegrensen',
      om: 'kommunegrensen fra Kartverket som GeoJSON',
      husk: 6,
      etl: kartverket.kommunegrense
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
    arealtall: tabell({
      lag: 'bronse',
      navn: 'arealtall',
      tittel: 'Arealtall fra SSB',
      om: 'arealet per klasse i nyeste år fra SSB, som JSON-stat',
      husk: 6,
      etl: ssb.arealtall
    }),
    arealtidsserie: tabell({
      lag: 'bronse',
      navn: 'arealtidsserie',
      tittel: 'Arealtall fra SSB for 2017',
      om: 'arealet per klasse fra 2017 fra SSB, som JSON-stat',
      husk: 6,
      etl: ssb.arealtidsserie
    }),
    oversiktsregister: tabell<void, Oversiktsregister | null>({
      lag: 'bronse',
      navn: 'oversiktsregister',
      tittel: 'Register over oversiktsbilder',
      om: 'kommunene som har lagret oversiktsbilde, og utsnittet hvert bilde dekker',
      husk: 1,
      etl: nibioGrunnkart.oversiktsregister
    }),
    oversiktsbilde: tabell({
      lag: 'bronse',
      navn: 'oversiktsbilde',
      tittel: 'Oversiktsbilde av kommunen',
      om: 'det lagrede oversiktsbildet av kommunen, som PNG',
      husk: 6,
      etl: nibioGrunnkart.oversiktsbilde
    }),
    grunnkartflis: tabell({
      lag: 'bronse',
      navn: 'grunnkartflis',
      tittel: 'Kartbilder av grunnkartet',
      om: 'kartbilder av dagens arealklasser fra NIBIO, 512 x 512 piksler. ' + URL_NOKKEL,
      husk: 400,
      etl: nibioGrunnkart.grunnkartflis
    }),
    plandekning: tabell({
      lag: 'bronse',
      navn: 'plandekning',
      tittel: 'Bilde av kommuneplanen over kommunen',
      om: 'ett lite bilde av hele kommuneplanen fra DiBK over kommunen',
      husk: 6,
      etl: dibk.plandekning
    }),
    planopplysninger: tabell({
      lag: 'bronse',
      navn: 'planopplysninger',
      tittel: 'Opplysninger om kommuneplanen',
      om: 'hvilken kommuneplan DiBK har, slått opp midt i det planen dekker',
      husk: 6,
      etl: dibk.planopplysninger
    }),
    planflis: tabell<Flis, ArrayBuffer>({
      lag: 'bronse',
      navn: 'planflis',
      tittel: 'Kartbilder av kommuneplanen',
      om: 'kartbilder av kommuneplanen fra DiBK, 512 x 512 piksler, kalt med flisen [z, x, y]. ' + URL_NOKKEL,
      husk: 400,
      nokkel: dibk.planflisAdresse,
      etl: dibk.planflis
    }),
    inonbilde: tabell({
      lag: 'bronse',
      navn: 'inonbilde',
      tittel: 'Bilde av inngrepsfri natur',
      om: 'bildet av inngrepsfri natur over hele kommunen fra Miljødirektoratet, som PNG',
      husk: 6,
      etl: mdirInon.inonbilde
    }),
    graabilder: tabell({
      lag: 'bronse',
      navn: 'graabilder',
      tittel: 'Bilder av grått areal',
      om: 'de to bildene av grått areal over hele kommunen fra NIBIO, som PNG',
      husk: 6,
      etl: nibioGraa.graabilder
    }),
    graaflis: tabell({
      lag: 'bronse',
      navn: 'graaflis',
      tittel: 'Kartbilder av grått areal',
      om: 'kartbilder av grått areal fra NIBIO, 512 x 512 piksler. ' + URL_NOKKEL,
      husk: 400,
      etl: nibioGraa.graaflis
    }),
    verneomrader: tabell({
      lag: 'bronse',
      navn: 'verneomrader',
      tittel: 'Verneområder',
      om: 'verneområdene i kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.verneomrader
    }),
    villrein: tabell({
      lag: 'bronse',
      navn: 'villrein',
      tittel: 'Villreinområder',
      om: 'villreinområdene i kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.villrein
    }),
    verdsattNatur: tabell({
      lag: 'bronse',
      navn: 'verdsattNatur',
      tittel: 'Verdsatt natur',
      om: 'naturtyper med verdi i kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.verdsattNatur
    }),
    kartlagt: tabell({
      lag: 'bronse',
      navn: 'kartlagt',
      tittel: 'Kartlagt for naturtyper',
      om: 'dekningsflatene for naturtypekartlegging rundt kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.kartlagt
    }),
    egne: tabell<string, Egetinn[]>({
      lag: 'bronse',
      navn: 'egne',
      fil: 'motor/egne.ts',
      tittel: 'Egne områder',
      om: 'egne områder brukeren har tegnet eller lastet opp i kommunen, slik brukeren laget dem: tegnede områder med typen brukeren valgte, og opplastede planer med arealformål og status per flate, i UTM33. En kilde fra brukeren, som datamotoren fyller.',
      husk: 30
    })
  },
  solv: {
    grense: tabell({
      lag: 'solv',
      navn: 'grense',
      tittel: 'Kommunegrensen',
      om: 'kommunegrensen som flerflate i UTM33, med utsnitt og flate i km²',
      husk: 6,
      etl: solvKommune.grense
    }),
    arealtall: tabell({
      lag: 'solv',
      navn: 'arealtall',
      tittel: 'Arealtall per klasse',
      om: 'arealet per klasse i nyeste år, med landareal, innsjø og elv',
      husk: 6,
      etl: solvSsb.arealtall
    }),
    historie: tabell({
      lag: 'solv',
      navn: 'historie',
      tittel: 'Arealtall i 2017 og nå',
      om: 'arealet per klasse i 2017 og i nyeste år',
      husk: 6,
      etl: solvSsb.historie
    }),
    oversikt: tabell({
      lag: 'solv',
      navn: 'oversikt',
      tittel: 'Oversiktsbildet',
      om: 'det lagrede oversiktsbildet med utsnittet det dekker og meter per piksel',
      husk: 6,
      etl: solvGrunnkart.oversikt
    }),
    oversiktLest: tabell({
      lag: 'solv',
      navn: 'oversiktLest',
      tittel: 'Oversiktsbildet lest inn',
      om: 'det lagrede oversiktsbildet lest inn som bilde, til dagens klasser zoomet ut',
      husk: 1,
      etl: solvGrunnkart.oversiktLest
    }),
    sammensatt: tabell<string, Samling>({
      lag: 'solv',
      navn: 'sammensatt',
      fil: 'motor/grunnkart.ts',
      tittel: 'Sammensatt kart',
      om: 'dagens klasser satt sammen av kartbildene som er hentet, for kommuner uten lagret oversiktsbilde. En kilde fra brukeren: det er kartet brukeren har sett på, og datamotoren fyller det.',
      husk: 4,
      voksende: true
    }),
    egne: tabell({
      lag: 'solv',
      navn: 'egne',
      tittel: 'Egne områder, tolket',
      om: 'de egne områdene i kommunen med om hver flate er utbygging. Tegnede områder har typen brukeren valgte, og flatene i en opplastet plan får typen etter arealformål og status.',
      husk: 30,
      brukerstyrt: true,
      etl: solvEgne.egne
    }),
    egneruter: tabell({
      lag: 'solv',
      navn: 'egneruter',
      tittel: 'Egne områder per rute',
      om: 'de egne områdene i kommunen som planen per rute, i samme datamodell som kommuneplanen: utbygging eller ikke, og hvilket område ruta hører til. Over utsnittet rundt alle områdene.',
      husk: 6,
      brukerstyrt: true,
      etl: solvEgne.egneruter
    }),
    plandekning: tabell({
      lag: 'solv',
      navn: 'plandekning',
      tittel: 'Hvor mye planen dekker',
      om: 'hvor stor del av kommunen kommuneplanen dekker, og rutene med plan',
      husk: 6,
      etl: solvPlan.plandekning
    }),
    planinfo: tabell({
      lag: 'solv',
      navn: 'planinfo',
      tittel: 'Kommuneplanen',
      om: 'om DiBK har kommuneplanen, hvor stor del av kommunen den dekker, og hvilken plan det er',
      husk: 6,
      etl: solvPlan.planinfo
    }),
    kommuneplanruter: tabell<Flis, Planruter>({
      lag: 'solv',
      navn: 'kommuneplanruter',
      tittel: 'Kommuneplanen per rute',
      om: 'kommuneplanen fra DiBK i én flis som planen per rute, i samme datamodell som egne områder: 1 der planen dekker minst halve ruta. Kalt med flisen [z, x, y].',
      husk: 40,
      nokkel: flisnavn,
      etl: solvPlan.kommuneplanruter
    }),
    inon: tabell({
      lag: 'solv',
      navn: 'inon',
      tittel: 'Inngrepsfri natur per rute',
      om: 'sonen per rute i bildet av kommunen, og antall ruter per sone innenfor kommunen',
      husk: 3,
      etl: solvInon.inon
    }),
    graa: tabell({
      lag: 'solv',
      navn: 'graa',
      tittel: 'Grått areal per rute',
      om: 'trinnet per rute i bildet av kommunen, og antall ruter per trinn innenfor kommunen',
      husk: 3,
      etl: solvGraa.graa
    }),
    verneomrader: tabell({
      lag: 'solv',
      navn: 'verneomrader',
      tittel: 'Verneområder, klippet',
      om: 'verneområdene klippet mot kommunen, med areal og opplysninger',
      husk: 30,
      etl: solvTemaer.verneomrader,
      glemt: (_, nr) => glemMasker('vern/' + nr + '/')
    }),
    villrein: tabell({
      lag: 'solv',
      navn: 'villrein',
      tittel: 'Villreinområder, klippet',
      om: 'villreinområdene klippet mot kommunen, med areal og opplysninger',
      husk: 30,
      etl: solvTemaer.villrein,
      glemt: (_, nr) => glemMasker('rein/' + nr + '/')
    }),
    verdsattNatur: tabell({
      lag: 'solv',
      navn: 'verdsattNatur',
      tittel: 'Lokaliteter med verdsatt natur',
      om: 'lokalitetene med verdsatt natur, uklippet, med areal, verdi og opplysninger',
      husk: 30,
      etl: solvTemaer.verdsattNatur,
      glemt: (_, nr) => glemMasker('verdi/' + nr + '/')
    }),
    verdsattNaturAreal: tabell({
      lag: 'solv',
      navn: 'verdsattNaturAreal',
      tittel: 'Arealet av verdsatt natur',
      om: 'arealet av verdsatt natur i kommunen, samlet og per verdikategori',
      husk: 30,
      etl: solvTemaer.verdsattNaturAreal
    }),
    kartlagt: tabell({
      lag: 'solv',
      navn: 'kartlagt',
      tittel: 'Det kartlagte',
      om: 'det som er kartlagt for naturtyper etter Miljødirektoratets instruks, klippet mot kommunen',
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
      husk: Infinity
    })
  },
  gull: {
    utbredelse: tabell({
      lag: 'gull',
      navn: 'utbredelse',
      tittel: 'Utbredelsen nå',
      om: 'utbredelsen nå: landarealet, og arealet og andelen for hver klasse',
      husk: 6,
      etl: gullRegnskap.utbredelse
    }),
    endring: tabell({
      lag: 'gull',
      navn: 'endring',
      tittel: 'Endring fra 2017',
      om: 'forskjellen fra 2017 for hver klasse',
      husk: 6,
      etl: gullRegnskap.endring
    }),
    oppstilling: tabell({
      lag: 'gull',
      navn: 'oppstilling',
      tittel: 'Regnskapsoppstillingen',
      om: 'regnskapsoppstillingen: areal ved start, netto endring og areal ved slutt',
      husk: 6,
      etl: gullRegnskap.oppstilling
    }),
    landOgVann: tabell({
      lag: 'gull',
      navn: 'landOgVann',
      tittel: 'Land og vann',
      om: 'land, innsjø, elv og hav i kommunens flate',
      husk: 6,
      etl: gullRegnskap.landOgVann
    }),
    kommuneplan: tabell({
      lag: 'gull',
      navn: 'kommuneplan',
      tittel: 'Kommuneplanen',
      om: 'om DiBK har kommuneplanen, og hvilken',
      husk: 6,
      etl: gullPlan.kommuneplan
    }),
    utbygging: tabell<string, Utbygging | null>({
      lag: 'gull',
      navn: 'utbygging',
      tittel: 'Utbyggingen',
      om: 'utbyggingen: kommuneplanen og egne områder lagt oppå dagens klasser, i ruter på 21 meter med smale striper tatt bort. Én rad per rute med planlagt utbygging på natur eller jordbruk. Midtpunktet: alle kryssinger med planlagt utbygging går gjennom den.',
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
      husk: 1,
      voksende: true
    }),
    planlagt: tabell({
      lag: 'gull',
      navn: 'planlagt',
      tittel: 'Planlagt utbygging',
      om: 'natur og jordbruk som planen setter av, med andeler',
      husk: 6,
      brukerstyrt: true,
      etl: gullPlan.planlagt
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
      husk: 6,
      etl: gullInon.inon
    }),
    graakryss: tabell({
      lag: 'gull',
      navn: 'graakryss',
      tittel: 'Grått areal krysset med utbyggingen',
      om: 'utbyggingen krysset med grått areal: planlagt utbygging på land, også der det alt er bebygd, og grønt i bebygd område',
      husk: 6,
      brukerstyrt: true,
      etl: gullGraa.graakryss
    }),
    graa: tabell({
      lag: 'gull',
      navn: 'graa',
      tittel: 'Grått areal',
      om: 'grått areal: arealet samlet og per trinn, og andelen av landarealet',
      husk: 6,
      etl: gullGraa.graa
    }),
    graaIPlan: tabell({
      lag: 'gull',
      navn: 'graaIPlan',
      tittel: 'Grått areal i planen',
      om: 'planlagt utbygging på grått areal, og grønt i bebygd område',
      husk: 6,
      brukerstyrt: true,
      etl: gullGraa.graaIPlan
    }),
    verneomrader: tabell({
      lag: 'gull',
      navn: 'verneomrader',
      tittel: 'Verneområder',
      om: 'verneområdene i kommunen: listen, arealet og andelen av landarealet',
      husk: 6,
      etl: gullTemaer.verneomrader
    }),
    utbyggingIVerneomrader: tabell({
      lag: 'gull',
      navn: 'utbyggingIVerneomrader',
      tittel: 'Utbyggingen i verneområder',
      om: 'kolonnen for verneområdene i utbyggingen: hvilket område hver rad ligger i',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVerneomrader
    }),
    verneomraderIPlan: tabell({
      lag: 'gull',
      navn: 'verneomraderIPlan',
      tittel: 'Verneområder i planen',
      om: 'planlagt utbygging innenfor verneområdene, samlet og per område: summene over kolonnen',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.verneomraderIPlan
    }),
    villrein: tabell({
      lag: 'gull',
      navn: 'villrein',
      tittel: 'Villreinområder',
      om: 'villreinområdene i kommunen: listen, arealet og andelen av landarealet',
      husk: 6,
      etl: gullTemaer.villrein
    }),
    utbyggingIVillrein: tabell({
      lag: 'gull',
      navn: 'utbyggingIVillrein',
      tittel: 'Utbyggingen i villreinområder',
      om: 'kolonnen for villreinområdene i utbyggingen: hvilket område hver rad ligger i',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVillrein
    }),
    villreinIPlan: tabell({
      lag: 'gull',
      navn: 'villreinIPlan',
      tittel: 'Villreinområder i planen',
      om: 'planlagt utbygging innenfor villreinområdene, samlet og per område: summene over kolonnen',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.villreinIPlan
    }),
    verdsattNatur: tabell({
      lag: 'gull',
      navn: 'verdsattNatur',
      tittel: 'Verdsatt natur',
      om: 'verdsatt natur i kommunen: lokalitetene, arealet samlet og per verdikategori, og andelen av landarealet',
      husk: 6,
      etl: gullTemaer.verdsattNatur
    }),
    verdsattNaturIKartlagt: tabell({
      lag: 'gull',
      navn: 'verdsattNaturIKartlagt',
      tittel: 'Verdsatt natur i det kartlagte',
      om: 'verdsatt natur per verdikategori innenfor det kartlagte',
      husk: 30,
      etl: gullTemaer.verdsattNaturIKartlagt
    }),
    verdsattNaturKartlagt: tabell({
      lag: 'gull',
      navn: 'verdsattNaturKartlagt',
      tittel: 'Kartleggingen',
      om: 'kartleggingen: hvor mye som er kartlagt, og helhetsbildet med verdsatt natur i det kartlagte og resten',
      husk: 6,
      etl: gullTemaer.verdsattNaturKartlagt
    }),
    utbyggingIVerdsattNatur: tabell({
      lag: 'gull',
      navn: 'utbyggingIVerdsattNatur',
      tittel: 'Utbyggingen i verdsatt natur',
      om: 'kolonnen for verdsatt natur i utbyggingen: hvilket område hver rad ligger i',
      husk: 1,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingIVerdsattNatur
    }),
    verdsattNaturIPlan: tabell({
      lag: 'gull',
      navn: 'verdsattNaturIPlan',
      tittel: 'Verdsatt natur i planen',
      om: 'planlagt utbygging i verdsatt natur: per verdikategori og de berørte lokalitetene, summert over kolonnen',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.verdsattNaturIPlan
    }),
    utbyggingUtenforKartlagt: tabell({
      lag: 'gull',
      navn: 'utbyggingUtenforKartlagt',
      tittel: 'Utbygging utenfor det kartlagte',
      om: 'planlagt utbygging på natur, og hvor mye av den som ligger utenfor det kartlagte for naturtyper',
      husk: 6,
      brukerstyrt: true,
      etl: gullTemaer.utbyggingUtenforKartlagt
    }),
    egneRader: tabell({
      lag: 'gull',
      navn: 'egneRader',
      tittel: 'Egne områder mot kommuneplanen',
      om: 'sammenligningen mellom kommuneplanen og egne områder, for hele kommunen og hvert område',
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
  ['solv/kommune.ts', solvKommune],
  ['solv/ssb.ts', solvSsb],
  ['solv/grunnkart.ts', solvGrunnkart],
  ['solv/kommuneplan.ts', solvPlan],
  ['solv/inon.ts', solvInon],
  ['solv/graa.ts', solvGraa],
  ['solv/temaer.ts', solvTemaer],
  ['solv/egne.ts', solvEgne],
  ['gull/regnskap.ts', gullRegnskap],
  ['gull/planlagt.ts', gullPlan],
  ['gull/utbygging.ts', gullUtbygging],
  ['gull/inon.ts', gullInon],
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
