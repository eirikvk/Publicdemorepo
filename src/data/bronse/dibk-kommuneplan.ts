/* Bronse for DiBK, den nasjonale tjenesten for kommuneplaner (WMS), laget kparealformalomrade. Siden henter bare flatene med
   arealformål i 1000- og 2000-serien (bebyggelse og anlegg, samferdselsanlegg og teknisk infrastruktur) og arealbruksstatus 2
   (framtidig), som kartbilder. */
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import {
  BILDE_PLANDEKNING,
  PLANOVERSIKT_NIVA,
  PLANOVERSIKT,
  flisUtsnitt,
  flisrammen,
  rutenett,
  type Flis,
  type Kommune
} from '../solv/felles.ts';
import type { Planopplysninger } from '../solv/kommuneplan.ts';
import { KOMMUNEPLAN as PLAN } from './endepunkter.ts';
import { hent, lagHenter } from './henting.ts';
import { kommunen } from './kartverket.ts';
import { wmsBilde, wmsOppslag, wmsPunkt } from './wms.ts';

const planSom = (v: string) =>
  `<PropertyIsLike wildCard="*" singleChar="?" escapeChar="!"><PropertyName>arealformål</PropertyName><Literal>${v}</Literal></PropertyIsLike>`;
const PLANFILTER = `<Filter xmlns="http://www.opengis.net/ogc"><And><PropertyIsEqualTo><PropertyName>arealbruksstatus</PropertyName><Literal>2</Literal></PropertyIsEqualTo><Or>${planSom('1*')}${planSom('2*')}</Or></And></Filter>`;
/* Flatene hentes med en egen stil som bare fyller dem, uten kantstrek. DiBKs standardstil tegner en strek rundt hver flate, og den
   er like bred i piksler uansett målestokk. Med ruter på 21 meter la streken rundt en fjerdedel til arealet i et testområde. */
const PLANSTIL =
  '<?xml version="1.0" encoding="UTF-8"?><StyledLayerDescriptor version="1.0.0" xmlns="http://www.opengis.net/sld"><NamedLayer><Name>kparealformalomrade</Name><UserStyle><FeatureTypeStyle><Rule><PolygonSymbolizer><Fill><CssParameter name="fill">#000000</CssParameter></Fill></PolygonSymbolizer></Rule></FeatureTypeStyle></UserStyle></NamedLayer></StyledLayerDescriptor>';
/* Adressen til et kartbilde på w x h piksler av utsnittet u i UTM33, med de planlagte flatene fylt i svart. Kartflisene er 512 x 512
   med fargetabell (png8). Oversikten er et vanlig PNG, for i png8 forsvinner piksler som en liten flate bare dekker en bit av. */
export const kommuneplanUrl = (u: Utsnitt, w = 512, h = 512, format = 'image/png8') =>
  wmsBilde(PLAN, u, w, h, {
    layers: 'kparealformalomrade',
    sld_body: PLANSTIL,
    format,
    transparent: 'true',
    filter: PLANFILTER
  });
/* Kartbildene hentes gjennom en egen kø */
export const hentKommuneplanFlis = lagHenter('DiBK', 'Kommuneplan');

/* Sjekken av om kommunen har plan: ett lite bilde av hele planlaget over utsnittet u, med w x h ruter, i DiBKs egen stil. Utsnittet
   sendes med én desimal. */
const DEKNING = { layers: 'kparealformalomrade', styles: 'polygon' };
export const hentPlandekning = (k: Kommune, u: Utsnitt, w: number, h: number) =>
  hent(
    'DiBK',
    `Dekning av kommuneplan for ${k.navn}`,
    wmsBilde(PLAN, u, w, h, { ...DEKNING, format: 'image/png8', transparent: 'true' }, 1),
    false,
    true
  );
/* Opplysningene om kommuneplanen for kommunen k i ruta (i, j) i det samme bildet: { id, vert, kopiert }, der vert er hvem som har
   levert planen og kopiert datoen den ble kopiert til DiBK, som [år, måned, dag]. null hvis ruta ikke har en plan fra kommunen. */
export const hentPlaninfo = (
  k: Kommune,
  u: Utsnitt,
  w: number,
  h: number,
  i: number,
  j: number
): Promise<Planopplysninger | null> =>
  hent(
    'DiBK',
    `Opplysninger om kommuneplanen for ${k.navn}`,
    wmsOppslag(
      PLAN,
      u,
      w,
      h,
      i,
      j,
      { ...DEKNING, query_layers: 'kparealformalomrade', info_format: 'application/json', feature_count: '5' },
      1
    ),
    true
  ).then(svar => {
    const f = ((svar as { features?: { properties?: Record<string, string> }[] }).features || [])
      .map(x => x.properties || {})
      .find(x => x['arealplanId.kommunenummer'] === k.nr);
    if (!f) return null;
    const d = /^(\d{4})-(\d\d)-(\d\d)/.exec(f['kopidata.kopidato'] || '');
    return {
      id: f['arealplanId.planidentifikasjon'],
      vert: f['kopidata.originalDatavert'] || '',
      kopiert: d ? [d[1], d[2], d[3]] : null
    };
  });

/* Tabellen bronse.planflis: kartbildet av kommuneplanen for flisen tc [z, x, y] i flisnettet */
export async function planflis(tc: Flis): Promise<ArrayBuffer> {
  return hentKommuneplanFlis(kommuneplanUrl(flisUtsnitt(tc)));
}
/* Tabellen bronse.planoversikt: ett bilde av kommuneplanen med samme utvalg og stil som kartbildene, over flisene på nivå 9 som
   dekker kommunen nr, med én piksel per PLANOVERSIKT x PLANOVERSIKT ruter. Brukes til å hente kartbildene bare der det er plan. */
export async function planoversikt(nr: string): Promise<ArrayBuffer> {
  const R = flisrammen((await katalog.solv.grense(nr)).ext, PLANOVERSIKT_NIVA),
    s = 512 / PLANOVERSIKT;
  return hent(
    'DiBK',
    `Oversikt over kommuneplanen for ${(await kommunen(nr)).navn}`,
    kommuneplanUrl(R.u, R.nx * s, R.ny * s, 'image/png'),
    false,
    true
  );
}
/* Tabellen bronse.plandekning: ett lite bilde av hele planlaget over kommunen */
export async function plandekning(nr: string): Promise<ArrayBuffer> {
  const R = rutenett((await katalog.solv.grense(nr)).ext, ...BILDE_PLANDEKNING);
  return hentPlandekning(await kommunen(nr), R.u, R.w, R.h);
}
/* Tabellen bronse.planopplysninger: hvilken plan kommunen har, slått opp i én rute midt i det planen dekker. null når planen ikke
   finnes, eller ruta ikke har en plan fra kommunen. */
export async function planopplysninger(nr: string): Promise<Planopplysninger | null> {
  const D = await katalog.solv.plandekning(nr);
  if (!D.finnes) return null;
  const q = D.treff[D.treff.length >> 1];
  return hentPlaninfo(await kommunen(nr), D.u, D.w, D.h, q % D.w, Math.floor(q / D.w));
}

/* Tabellen bronse.planIPunkt: flatene i kommuneplanene i punktet p [øst, nord], med egenskapene og flaten, som GeoJSON. Til
   detaljene ved trykk i kartet. Alle arealformål er med, ikke bare utbygging. */
export async function planIPunkt(p: number[]): Promise<unknown> {
  return hent(
    'DiBK',
    'Kommuneplanen i et punkt',
    wmsPunkt(PLAN, p, {
      layers: 'kparealformalomrade',
      query_layers: 'kparealformalomrade',
      styles: '',
      info_format: 'application/json',
      feature_count: '10'
    })
  );
}
