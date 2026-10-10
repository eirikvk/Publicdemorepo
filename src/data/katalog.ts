/* Katalogen: ETL-pipelinen, som en liste over tabeller i tre lag, slik Unity Catalog har katalog.skjema.tabell. Hver tabell er en
   ETL-funksjon i bronse, sølv eller gull, med samme navn som tabellen: katalog.solv.inon er inon() i solv/inon.ts. Man kaller
   tabellen med nøkkelen, som regel kommunenummeret: katalog.gull.verneomrader('5001').

   Hvor dataene kommer fra, ser man i ETL-funksjonen selv: den kaller katalogen etter det den bygger på. Åpner man
   gull.verneomrader, ser man at den kaller solv.verneomrader, og der at den kaller bronse.verneomrader, og så videre ned til kilden.

   Svarene huskes i cachen (cache.ts). Her står bare hvor mange nøkler som huskes for hver tabell (husk), og hva den er (om). Svar fra
   kildene og tolkingen av dem er store og huskes for noen få kommuner. Gull er små tabeller og huskes for flere. Tabeller uten
   ETL-funksjon fyller datamotoren selv (data/motor/), fordi de bygges opp mens kartet flyttes.

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
import * as solvPlan from './solv/planrutenett.ts';
import * as solvSsb from './solv/ssb.ts';
import * as solvTemaer from './solv/temaer.ts';
import type { Fylke } from './solv/felles.ts';
import type { Blokk, Rutenettet } from './solv/planrutenett.ts';
import type { Maske } from './solv/temaer.ts';
import type { Oversikt } from './solv/grunnkart.ts';
import type { Oversiktsregister } from './bronse/nibio-grunnkart.ts';
import * as gullEgne from './gull/egne.ts';
import * as gullGraa from './gull/graa.ts';
import * as gullInon from './gull/inon.ts';
import * as gullPlan from './gull/planlagt.ts';
import * as gullRegnskap from './gull/regnskap.ts';
import * as gullTemaer from './gull/temaer.ts';

/* Det sammensatte kartet: lerretet (c) med klassene i rene farger, meter per piksel, utsnittet det dekker, flisene som er lagt inn
   (som «nivå/x/y»), og det samme som Oversikt (ov), til kartet og utregningene */
export interface Samling {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  res: number;
  ext: [number, number, number, number];
  har: Set<string>;
  ov: Oversikt;
}
const URL_NOKKEL = 'Nøkkel: adressen.';

export const katalog = {
  bronse: {
    kommuner: tabell<void, Fylke[]>({
      lag: 'bronse',
      navn: 'kommuner',
      om: 'fylkene og kommunene, sortert etter navn',
      husk: 1,
      etl: kartverket.kommuner
    }),
    kommunegrense: tabell({
      lag: 'bronse',
      navn: 'kommunegrense',
      om: 'kommunegrensen fra Kartverket som GeoJSON',
      husk: 6,
      etl: kartverket.kommunegrense
    }),
    arealtall: tabell({
      lag: 'bronse',
      navn: 'arealtall',
      om: 'arealet per klasse i nyeste år fra SSB, som JSON-stat',
      husk: 6,
      etl: ssb.arealtall
    }),
    arealtidsserie: tabell({
      lag: 'bronse',
      navn: 'arealtidsserie',
      om: 'arealet per klasse fra 2017 fra SSB, som JSON-stat',
      husk: 6,
      etl: ssb.arealtidsserie
    }),
    oversiktsregister: tabell<void, Oversiktsregister | null>({
      lag: 'bronse',
      navn: 'oversiktsregister',
      om: 'kommunene som har lagret oversiktsbilde, og utsnittet hvert bilde dekker',
      husk: 1,
      etl: nibioGrunnkart.oversiktsregister
    }),
    oversiktsbilde: tabell({
      lag: 'bronse',
      navn: 'oversiktsbilde',
      om: 'det lagrede oversiktsbildet av kommunen, som PNG',
      husk: 6,
      etl: nibioGrunnkart.oversiktsbilde
    }),
    grunnkartflis: tabell({
      lag: 'bronse',
      navn: 'grunnkartflis',
      om: 'kartbilder av dagens arealklasser fra NIBIO, 512 x 512 piksler. ' + URL_NOKKEL,
      husk: 400,
      etl: nibioGrunnkart.grunnkartflis
    }),
    plandekning: tabell({
      lag: 'bronse',
      navn: 'plandekning',
      om: 'ett lite bilde av hele kommuneplanen fra DiBK over kommunen',
      husk: 6,
      etl: dibk.plandekning
    }),
    planopplysninger: tabell({
      lag: 'bronse',
      navn: 'planopplysninger',
      om: 'hvilken kommuneplan DiBK har, slått opp midt i det planen dekker',
      husk: 6,
      etl: dibk.planopplysninger
    }),
    planflis: tabell({
      lag: 'bronse',
      navn: 'planflis',
      om: 'kartbilder av kommuneplanen fra DiBK, 512 x 512 piksler. ' + URL_NOKKEL,
      husk: 400,
      etl: dibk.planflis
    }),
    inonbilde: tabell({
      lag: 'bronse',
      navn: 'inonbilde',
      om: 'bildet av inngrepsfri natur over hele kommunen fra Miljødirektoratet, som PNG',
      husk: 6,
      etl: mdirInon.inonbilde
    }),
    graabilder: tabell({
      lag: 'bronse',
      navn: 'graabilder',
      om: 'de to bildene av grått areal over hele kommunen fra NIBIO, som PNG',
      husk: 6,
      etl: nibioGraa.graabilder
    }),
    graaflis: tabell({
      lag: 'bronse',
      navn: 'graaflis',
      om: 'kartbilder av grått areal fra NIBIO, 512 x 512 piksler. ' + URL_NOKKEL,
      husk: 400,
      etl: nibioGraa.graaflis
    }),
    verneomrader: tabell({
      lag: 'bronse',
      navn: 'verneomrader',
      om: 'verneområdene i kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.verneomrader
    }),
    villrein: tabell({
      lag: 'bronse',
      navn: 'villrein',
      om: 'villreinområdene i kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.villrein
    }),
    verdsattNatur: tabell({
      lag: 'bronse',
      navn: 'verdsattNatur',
      om: 'naturtyper med verdi i kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.verdsattNatur
    }),
    kartlagt: tabell({
      lag: 'bronse',
      navn: 'kartlagt',
      om: 'dekningsflatene for naturtypekartlegging rundt kommunen fra Miljødirektoratet, som GeoJSON',
      husk: 6,
      etl: mdirNatur.kartlagt
    })
  },
  solv: {
    grense: tabell({
      lag: 'solv',
      navn: 'grense',
      om: 'kommunegrensen som flerflate i UTM33, med utsnitt og flate i km²',
      husk: 6,
      etl: solvKommune.grense
    }),
    arealtall: tabell({
      lag: 'solv',
      navn: 'arealtall',
      om: 'arealet per klasse i nyeste år, med landareal, innsjø og elv',
      husk: 6,
      etl: solvSsb.arealtall
    }),
    historie: tabell({
      lag: 'solv',
      navn: 'historie',
      om: 'arealet per klasse i 2017 og i nyeste år',
      husk: 6,
      etl: solvSsb.historie
    }),
    oversikt: tabell({
      lag: 'solv',
      navn: 'oversikt',
      om: 'det lagrede oversiktsbildet med utsnittet det dekker og meter per piksel',
      husk: 6,
      etl: solvGrunnkart.oversikt
    }),
    oversiktLest: tabell({
      lag: 'solv',
      navn: 'oversiktLest',
      om: 'det lagrede oversiktsbildet lest inn som bilde, til dagens klasser zoomet ut',
      husk: 1,
      etl: solvGrunnkart.oversiktLest
    }),
    sammensatt: tabell<string, Samling>({
      lag: 'solv',
      navn: 'sammensatt',
      om: 'dagens klasser satt sammen av kartbildene som er hentet, for kommuner uten lagret oversiktsbilde. Fylles av datamotoren.',
      husk: 4,
      voksende: true
    }),
    plandekning: tabell({
      lag: 'solv',
      navn: 'plandekning',
      om: 'hvor stor del av kommunen kommuneplanen dekker, og rutene med plan',
      husk: 6,
      etl: solvPlan.plandekning
    }),
    planinfo: tabell({
      lag: 'solv',
      navn: 'planinfo',
      om: 'om DiBK har kommuneplanen, hvor stor del av kommunen den dekker, og hvilken plan det er',
      husk: 6,
      etl: solvPlan.planinfo
    }),
    planblokker: tabell<string, Map<string, Blokk>>({
      lag: 'solv',
      navn: 'planblokker',
      om: 'planrutenettet i blokker på 512 x 512 ruter, én per flis på nivå 9. Fylles av datamotoren.',
      husk: 1,
      voksende: true
    }),
    planrutenett: tabell<string, Rutenettet>({
      lag: 'solv',
      navn: 'planrutenett',
      om: 'kommuneplanen og egne områder lagt oppå dagens klasser, med smale striper tatt bort. Regnes ut av datamotoren, på nytt når det kommer mer kart eller egne områder endres.',
      husk: 1,
      endrerGull: true
    }),
    inon: tabell({
      lag: 'solv',
      navn: 'inon',
      om: 'sonen per rute i bildet av kommunen, og antall ruter per sone innenfor kommunen',
      husk: 3,
      etl: solvInon.inon
    }),
    graa: tabell({
      lag: 'solv',
      navn: 'graa',
      om: 'trinnet per rute i bildet av kommunen, og antall ruter per trinn innenfor kommunen',
      husk: 3,
      etl: solvGraa.graa
    }),
    verneomrader: tabell({
      lag: 'solv',
      navn: 'verneomrader',
      om: 'verneområdene klippet mot kommunen, med areal og opplysninger',
      husk: 30,
      etl: solvTemaer.verneomrader,
      glemt: (_, nr) => glemMasker('vern/' + nr + '/')
    }),
    villrein: tabell({
      lag: 'solv',
      navn: 'villrein',
      om: 'villreinområdene klippet mot kommunen, med areal og opplysninger',
      husk: 30,
      etl: solvTemaer.villrein,
      glemt: (_, nr) => glemMasker('rein/' + nr + '/')
    }),
    verdsattNatur: tabell({
      lag: 'solv',
      navn: 'verdsattNatur',
      om: 'lokalitetene med verdsatt natur, uklippet, med areal, verdi og opplysninger',
      husk: 30,
      etl: solvTemaer.verdsattNatur,
      glemt: (_, nr) => glemMasker('verdi/' + nr + '/')
    }),
    verdsattNaturAreal: tabell({
      lag: 'solv',
      navn: 'verdsattNaturAreal',
      om: 'arealet av verdsatt natur i kommunen, samlet og per verdikategori',
      husk: 30,
      etl: solvTemaer.verdsattNaturAreal
    }),
    kartlagt: tabell({
      lag: 'solv',
      navn: 'kartlagt',
      om: 'det som er kartlagt for naturtyper etter Miljødirektoratets instruks, klippet mot kommunen',
      husk: 30,
      etl: solvTemaer.kartlagt,
      endrerGull: true,
      glemt: (_, nr) => glemMasker('kartlagt/' + nr)
    }),
    verdsattNaturIKartlagt: tabell({
      lag: 'solv',
      navn: 'verdsattNaturIKartlagt',
      om: 'verdsatt natur per verdikategori innenfor det kartlagte',
      husk: 30,
      etl: solvTemaer.verdsattNaturIKartlagt,
      endrerGull: true
    }),
    naturmaske: tabell<string, Maske | null>({
      lag: 'solv',
      navn: 'naturmaske',
      om: 'områdene i naturtemaene og det kartlagte som masker i et rutenett, til kryssingen med planrutenettet. Nøkkel: tema/kommune/plassen til området. Lages første gang en rute med planlagt utbygging treffer området.',
      husk: Infinity
    })
  },
  gull: {
    utbredelse: tabell({
      lag: 'gull',
      navn: 'utbredelse',
      om: 'utbredelsen nå: landarealet, og arealet og andelen for hver klasse',
      husk: 6,
      etl: gullRegnskap.utbredelse
    }),
    endring: tabell({
      lag: 'gull',
      navn: 'endring',
      om: 'forskjellen fra 2017 for hver klasse',
      husk: 6,
      etl: gullRegnskap.endring
    }),
    oppstilling: tabell({
      lag: 'gull',
      navn: 'oppstilling',
      om: 'regnskapsoppstillingen: areal ved start, netto endring og areal ved slutt',
      husk: 6,
      etl: gullRegnskap.oppstilling
    }),
    landOgVann: tabell({
      lag: 'gull',
      navn: 'landOgVann',
      om: 'land, innsjø, elv og hav i kommunens flate',
      husk: 6,
      etl: gullRegnskap.landOgVann
    }),
    kommuneplan: tabell({
      lag: 'gull',
      navn: 'kommuneplan',
      om: 'om DiBK har kommuneplanen, og hvilken',
      husk: 6,
      etl: gullPlan.kommuneplan
    }),
    planlagt: tabell({
      lag: 'gull',
      navn: 'planlagt',
      om: 'natur og jordbruk som planen setter av, med andeler',
      husk: 6,
      etl: gullPlan.planlagt
    }),
    plansum: tabell({
      lag: 'gull',
      navn: 'plansum',
      om: 'natur og jordbruk satt av i km², til oversikten og regnskapet',
      husk: 6,
      etl: gullPlan.plansum
    }),
    inon: tabell({
      lag: 'gull',
      navn: 'inon',
      om: 'inngrepsfri natur: arealet samlet og per sone, og andelen av landarealet',
      husk: 6,
      etl: gullInon.inon
    }),
    graakryss: tabell({
      lag: 'gull',
      navn: 'graakryss',
      om: 'planlagt utbygging krysset med grått areal',
      husk: 6,
      etl: gullGraa.graakryss
    }),
    graa: tabell({
      lag: 'gull',
      navn: 'graa',
      om: 'grått areal: arealet samlet og per trinn, andelen av landarealet, og planlagt utbygging på grått areal',
      husk: 6,
      etl: gullGraa.graa
    }),
    verneomrader: tabell({
      lag: 'gull',
      navn: 'verneomrader',
      om: 'verneområdene: arealet, listen, og planlagt utbygging innenfor',
      husk: 6,
      etl: gullTemaer.verneomrader
    }),
    villrein: tabell({
      lag: 'gull',
      navn: 'villrein',
      om: 'villreinområdene: arealet, listen, og planlagt utbygging innenfor',
      husk: 6,
      etl: gullTemaer.villrein
    }),
    verdsattNatur: tabell({
      lag: 'gull',
      navn: 'verdsattNatur',
      om: 'verdsatt natur: arealet per verdikategori, kartleggingen, de berørte lokalitetene og planlagt utbygging innenfor',
      husk: 6,
      etl: gullTemaer.verdsattNatur
    }),
    egneRader: tabell({
      lag: 'gull',
      navn: 'egneRader',
      om: 'sammenligningen mellom kommuneplanen og egne områder, for hele kommunen og hvert område',
      husk: 6,
      etl: gullEgne.egneRader
    })
  }
};
/* Maskene til et tema i en kommune glemmes når områdene glemmes */
const glemMasker = (start: string) => glem(katalog.solv.naturmaske, k => k.startsWith(start));

/* Tabellene for hvert naturtema, etter id: områdene i sølv og det sidene viser i gull */
export const TEMATABELLER: Record<
  string,
  { omrader: Tabell<string, solvTemaer.Temaomrader>; tall: Tabell<string, gullTemaer.Naturtemaet> }
> = {
  vern: { omrader: katalog.solv.verneomrader, tall: katalog.gull.verneomrader },
  rein: { omrader: katalog.solv.villrein, tall: katalog.gull.villrein },
  verdi: { omrader: katalog.solv.verdsattNatur, tall: katalog.gull.verdsattNatur }
};
