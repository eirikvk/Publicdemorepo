/* Sølv, felles standard: det alle kildene gjøres om til, så de kan brukes sammen. Koordinatsystemet er UTM sone 33 (EPSG:25833),
   arealer er i km² i terrenget, og rutenett følger Kartverkets flisnett eller legges over kommunen. Her ligger rutenettene,
   tersklene, målestokken i UTM og arealet av en flate. Filen bruker verken nettleseren, kartet eller sidens tilstand, så den kan
   kjøres i Node. METODE.md forklarer tersklene.

   Flatene og utsnittene er i meter i UTM33, i formen som er beskrevet i generelt/geometri.ts. En kommune er { koord, ext }:
   flerflaten og utsnittet. */
import { areal, utsnitt, type Flerflate, type Utsnitt } from '../generelt/geometri.ts';

/* En flis i flisnettet: [nivå, x, y] */
export type Flis = [number, number, number];
/* Et rutenett lagt over et utsnitt: utsnittet rutene dekker (u), meter per rute (res), og bredde og høyde i ruter */
export interface Rutebilde {
  u: Utsnitt;
  res: number;
  w: number;
  h: number;
}
/* Piksler i et bilde: rød, grønn, blå og dekning (alfa) fra 0 til 255, fire tall per piksel */
export type Piksler = ArrayLike<number>;
/* En kommune i listen over kommuner: nummer, navn, og avgrensningsboksen [vest, sør, øst, nord] i grader hvis den er kjent */
export interface Kommune {
  nr: string;
  navn: string;
  boks: number[] | null;
}
/* Et fylke med kommunene sine */
export interface Fylke {
  nr: string;
  navn: string;
  kommuner: Kommune[];
}

/* Koordinatsystemet alt gjøres om til: UTM sone 33 (EPSG:25833), som dataene er laget i. */
export const UTM = 'EPSG:25833';

/* Kartverkets flisnett for UTM33: origo og meter per piksel på hvert nivå. Kartet og analysene bruker det samme nettet. */
export const ORIGO = [-2500000, 9045984],
  OPPLOSNINGER = Array.from({ length: 19 }, (_, z) => 21664 / 2 ** z);
const FLIS = 256; /* piksler per flis i flisnettet */

/* Utsnittet til flisen [z, x, y] i flisnettet. Regnes ut i samme rekkefølge som OpenLayers gjør (getTileCoordExtent), så
   utsnittene, og dermed adressene til kartbildene, blir nøyaktig de samme som kartet ber om. */
export const flisUtsnitt = ([z, x, y]: Flis): Utsnitt => {
  const r = OPPLOSNINGER[z],
    minX = ORIGO[0] + x * FLIS * r,
    minY = ORIGO[1] - (y + 1) * FLIS * r;
  return [minX, minY, minX + FLIS * r, minY + FLIS * r];
};
/* Flisene på nivå z som dekker utsnittet e, som [z, x, y], kolonne for kolonne. Samme regel som OpenLayers (forEachTileCoord):
   et punkt på grensen mellom to fliser hører til flisen etter, og tallene rundes til fem desimaler først. */
const fem = (n: number) => Math.round(n * 1e5) / 1e5;
export const fliserI = (e: Utsnitt, z: number): Flis[] => {
  const r = OPPLOSNINGER[z],
    x0 = Math.floor(fem((e[0] - ORIGO[0]) / r / FLIS)),
    y0 = Math.floor(fem((ORIGO[1] - e[3]) / r / FLIS)),
    x1 = Math.ceil(fem((e[2] - ORIGO[0]) / r / FLIS)) - 1,
    y1 = Math.ceil(fem((ORIGO[1] - e[1]) / r / FLIS)) - 1,
    ut: Flis[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ut.push([z, x, y]);
  return ut;
};

/* Groveste flisnivå NIBIO tegner grunnkartet i: 512 piksler per flis gir 10,6 meter per piksel, innenfor grensen på 1:50 000.
   Zoomet lenger ut brukes blokkene satt sammen eller det sammensatte kartet. */
export const FLISNIVA = 10;

/* Bitene: inngrepsfri natur og grått areal hentes og tolkes i biter, flisene på nivå 8 med 2048 x 2048 ruter. Ruta er da den samme
   som i flisene på nivå 10, 10,6 meter, uansett hvor stor kommunen er, og en bit dekker nøyaktig 4 x 4 slike fliser. En bit hentes
   som ett bilde, og nabokommuner deler bitene langs grensen. */
export const BITNIVA = FLISNIVA - 2,
  BIT = 2048;
/* Rutenettet i biten tc: utsnittet, 10,6 meter per rute, og 2048 x 2048 ruter */
export const bitRuter = (tc: Flis): Rutebilde => {
  const u = flisUtsnitt(tc);
  return { u, res: (u[2] - u[0]) / BIT, w: BIT, h: BIT };
};
/* Biten punktet p [øst, nord] ligger i, og bitene som dekker utsnittet e */
export const bitVed = (p: number[]): Flis => flisVed(p, BITNIVA);
export const biterI = (e: Utsnitt) => fliserI(e, BITNIVA);
/* Biten flisen tc på nivå 8 eller finere ligger i */
export const bitAv = (tc: Flis): Flis => [BITNIVA, tc[1] >> (tc[0] - BITNIVA), tc[2] >> (tc[0] - BITNIVA)];

/* Rutenettet for utbyggingen: planlagt utbygging, dagens klasser og alt som krysses med dem, regnes i flisene på nivå 10 med 512
   ruter per flis, 10,6 meter, i alle kommuner. */
export const PLANNIVA = FLISNIVA,
  RUTE_M = OPPLOSNINGER[PLANNIVA] / 2 /* 10,58 meter */,
  RUTE = RUTE_M ** 2 / 1e6; /* km² per rute, 0,112 dekar */
/* Nivået oversikten over hvor kommuneplanen ligger, er lagt i (solv.planoversikt). Den bestemmer bare hvilke fliser som hentes, ikke
   tallene. */
export const PLANOVERSIKT_NIVA = 9;
/* Meter langs siden av en rute og km² per rute i rutenettet på nivå z, med 512 ruter per flis */
export const ruteM = (z: number) => OPPLOSNINGER[z] / 2,
  ruteKm2 = (z: number) => ruteM(z) ** 2 / 1e6;

/* Terskler. Dekningen av en piksel er alfa, fra 0 (tom) til 255 (helt dekket). */
export const HALV = 128; /* halvregelen: en rute teller når en flate dekker minst halve ruta */
export const SYNLIG = 100; /* en piksel i et kartbilde regnes som tegnet når den er minst så dekket. Resten er tomt. */
export const PLAN_FINNES = 0.15; /* kommuneplanen regnes som tilgjengelig når planlaget dekker minst 15 % av kommunen */
export const GRENSE_FLYTTET = 0.005; /* avviker kommunens samlede areal mer enn 0,5 % mellom to årganger, er grensen flyttet */
export const HAV_MIN_KM2 = 0.5,
  HAV_MIN_ANDEL = 0.005; /* rest mindre enn dette er avvik mellom grense og statistikk, ikke hav */
export const EGET_MIN_M2 = 400; /* minste tegnede område som regnes ut */

/* Rutenett for bildene som hentes for hele kommunen: [høyst antall ruter på lengste side, minste rute i meter] */
export const BILDE_PLANDEKNING: [number, number] = [256, 0]; /* sjekken av om kommunen har kommuneplan */
export const PLANOVERSIKT = 4; /* oversikten over hvor kommuneplanen ligger: én piksel per 4 x 4 ruter på nivå 9 (85 meter) */

/* Rutenett over et utsnitt e: høyst maks ruter på lengste side, og ruter på minst `minst` meter. u er utsnittet rutene dekker,
   som kan være litt større enn e. */
export const rutenett = (e: Utsnitt, maks: number, minst = 0): Rutebilde => {
  const res = Math.max(minst, Math.max(e[2] - e[0], e[3] - e[1]) / maks),
    w = Math.ceil((e[2] - e[0]) / res),
    h = Math.ceil((e[3] - e[1]) / res);
  return { res, w, h, u: [e[0], e[3] - h * res, e[0] + w * res, e[3]] };
};

/* Areal i kartet og i terrenget: i UTM er flater litt større i kartet, og mer jo lenger øst eller vest for sonens midtlinje.
   Gir kvadratmeter i kartet per kvadratkilometer i terrenget, regnet midt i utsnittet. Arealer i km² er areal / m2PerKm2(utsnitt). */
export const m2PerKm2 = (e: Utsnitt) => {
  const k = 0.9996 * (1 + ((e[0] + e[2]) / 2 - 500000) ** 2 / (2 * 6.38e6 ** 2));
  return k * k * 1e6;
};

/* Arealet av en flerflate i km² i terrenget. e er utsnittet målestokken regnes midt i, til vanlig flatens eget utsnitt. */
export const arealKm2 = (koord: Flerflate, e: Utsnitt = utsnitt(koord)) => areal(koord) / m2PerKm2(e);

/* Navnet på flisen [z, x, y], som «z/x/y», og flisen fra navnet */
export const flisnavn = (tc: Flis) => tc.join('/');
export const flisAvNavn = (n: string) => n.split('/').map(Number) as Flis;
/* Flisen på nivå z som punktet p [øst, nord] ligger i */
export const flisVed = (p: number[], z: number): Flis => [
  z,
  Math.floor((p[0] - ORIGO[0]) / (FLIS * OPPLOSNINGER[z])),
  Math.floor((ORIGO[1] - p[1]) / (FLIS * OPPLOSNINGER[z]))
];

/* Plasseringen av et rutenett i flisnettet: nivå, første kolonne og rad, og bredden i ruter */
export interface Plassering {
  z: number;
  cx0: number;
  cy0: number;
  w: number;
}
/* Planen per rute, datamodellen i sølv for begge kildene til planen: kommuneplanen fra DiBK (solv.kommuneplanruter) og egne
   områder fra brukeren (solv.egneruter). Kildene står uendret og hver for seg. Gull avgjør hvilken som gjelder hvor
   (gull/utbygging.ts). Et rutenett plassert i flisnettet med høyden h, og per rute:
     plan:   0 ingenting, 1 utbygging, 2 ikke utbygging
     omrade: hvilket område ruta hører til (1, 2 og så videre), når kilden har områder */
export interface Planruter extends Plassering {
  h: number;
  plan: Uint8Array;
  omrade?: Uint8Array;
}
/* Midtpunktet av rute i i utbyggingen R, i meter */
export const ruteX = (R: Plassering, i: number) => ORIGO[0] + (R.cx0 + (i % R.w) + 0.5) * (OPPLOSNINGER[R.z] / 2);
export const ruteY = (R: Plassering, i: number) =>
  ORIGO[1] - (R.cy0 + Math.floor(i / R.w) + 0.5) * (OPPLOSNINGER[R.z] / 2);

/* Utsnittet til flisene på nivå z som dekker utsnittet e: første kolonne og rad (x0, y0), antall (nx, ny), og utsnittet de dekker
   til sammen (u) */
export function flisrammen(e: Utsnitt, z: number) {
  const F = fliserI(e, z),
    x0 = Math.min(...F.map(t => t[1])),
    y0 = Math.min(...F.map(t => t[2])),
    nx = Math.max(...F.map(t => t[1])) - x0 + 1,
    ny = Math.max(...F.map(t => t[2])) - y0 + 1,
    a = flisUtsnitt([z, x0, y0]),
    b = flisUtsnitt([z, x0 + nx - 1, y0 + ny - 1]);
  return { x0, y0, nx, ny, u: [a[0], b[1], b[2], a[3]] as Utsnitt };
}
