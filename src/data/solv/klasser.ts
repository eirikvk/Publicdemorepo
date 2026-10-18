/* Sølv, felles standard: arealklassene. Inndelingen i bebygd, jordbruk og natur, med koblingen til SSBs arealklasser og
   grunnkartets økosystemtyper, og tolkingen av fargene i kartbildene fra NIBIO. Nederst detaljklassene, som deler de samme klassene
   videre. */
import { SYNLIG, type Piksler } from './felles.ts';

/* Klassene, med id: bebygd, jordbruk og natur på land, og hav, innsjø og elv */
export type KlasseId = 'beb' | 'jor' | 'nat' | 'hav' | 'inn' | 'elv';
/* En klasse på land: [id, navn, økosystemtyper i grunnkartet, arealklasser i SSB] */
export type Landklasse = [id: KlasseId, navn: string, okosystemtyper: string[], ssb: string[]];
/* En klasse i vann: [id, navn, økosystemtyper i grunnkartet, arealklassen i SSB hvis den finnes] */
export type Vannklasse = [id: KlasseId, navn: string, okosystemtyper: string[], ssb?: string];

/* De tre klassene på land: [id, navn, økosystemtyper i grunnkartet (okosystemtypeniva1), arealklasser i SSB tabell 09594] */
export const KL: Landklasse[] = [
  [
    'beb',
    'Bebygd',
    ['bebygdOpparbeidetAreal'],
    ['01', '02', '03', '04', '05', '06', '07', '08-09', '10-11', '12-13', '14']
  ],
  ['jor', 'Jordbruk', ['dyrketmark', 'grasmark'], ['15-16']],
  [
    'nat',
    'Natur',
    ['skog', 'heiBuskmark', 'liteVegetertMark', 'vatmark', 'kyststrenderSvabergDyner'],
    ['17', '18', '19', '20', '21', '24']
  ]
];
/* Vann fargelegges i kartet slik grunnkartet gjør, men telles ikke som natur. Innsjø og elv har egne tall hos SSB. */
export const VANN: Vannklasse[] = [
  ['hav', 'Hav', ['hav']],
  ['inn', 'Innsjø', ['innsjoerVannmagasiner'], '22.01'],
  ['elv', 'Elv', ['elverBekkerKanaler'], '22.02']
];
export const ALLE: (Landklasse | Vannklasse)[] = [...KL, ...VANN],
  BEB = 0,
  JOR = 1,
  NAT = 2; /* plass i ALLE: 0 bebygd, 1 jordbruk, 2 natur, deretter hav, innsjø og elv */

/* Hovedøkosystemene i grunnkartet (økosystemtypene på nivå 1), i rekkefølgen tabellene bruker: koden i grunnkartet, navnet, og
   klassen blant dagens seks. De syntetiske tabellene som står i stedet for SSBs tabeller til de kommer, bruker dem (gull/syntetisk.ts). */
export const HOVEDOKOSYSTEMER: { kode: string; navn: string; gruppe: KlasseId }[] = [
  { kode: 'bebygdOpparbeidetAreal', navn: 'Bebygd og opparbeidet areal', gruppe: 'beb' },
  { kode: 'dyrketmark', navn: 'Dyrket mark', gruppe: 'jor' },
  { kode: 'grasmark', navn: 'Grasmark', gruppe: 'jor' },
  { kode: 'skog', navn: 'Skog', gruppe: 'nat' },
  { kode: 'heiBuskmark', navn: 'Hei og buskmark', gruppe: 'nat' },
  { kode: 'liteVegetertMark', navn: 'Lite vegetert mark', gruppe: 'nat' },
  { kode: 'vatmark', navn: 'Våtmark', gruppe: 'nat' },
  { kode: 'kyststrenderSvabergDyner', navn: 'Kyststrender, svaberg og dyner', gruppe: 'nat' },
  { kode: 'innsjoerVannmagasiner', navn: 'Innsjøer og vannmagasiner', gruppe: 'inn' },
  { kode: 'elverBekkerKanaler', navn: 'Elver, bekker og kanaler', gruppe: 'elv' },
  { kode: 'hav', navn: 'Hav', gruppe: 'hav' }
];
/* Den faste nøkkelen fra SSBs arealklasser (tabell 09594) til hovedøkosystemene. Bebygd (01–14) er bebygd, fulldyrka jord er dyrket
   mark, ikke fulldyrka jord er grasmark, skog er skog, åpen fastmark er hei og buskmark, åpen myr er våtmark, og bart fjell og snø og
   is er lite vegetert mark, innsjø og tjern er innsjøer og vannmagasiner, og elv er elver, bekker og kanaler. Uklassifisert ubebygd
   område (24) gir null. Kyststrender, svaberg og dyner og hav har ingen egen klasse hos SSB. */
export function ssbTilHovedokosystem(k: { kode: string; klasse: string }): string | null {
  if (k.klasse === 'beb') return 'bebygdOpparbeidetAreal';
  if (k.kode === '15') return 'dyrketmark';
  if (k.kode === '16') return 'grasmark';
  if (k.kode.startsWith('17.')) return 'skog';
  if (k.kode === '18') return 'heiBuskmark';
  if (k.kode === '19') return 'vatmark';
  if (k.kode === '20' || k.kode === '21') return 'liteVegetertMark';
  if (k.kode === '22.01') return 'innsjoerVannmagasiner';
  if (k.kode === '22.02') return 'elverBekkerKanaler';
  return null;
}

/* Fargene NIBIO bes tegne hver klasse i. De seks er valgt slik at en blanding av to klasser (pikslene i kanten mellom to flater) ikke
   kan forveksles med en blanding av to andre. */
export const DATAFARGE: Record<KlasseId, number[]> = {
  beb: [255, 0, 0],
  jor: [0, 255, 0],
  nat: [0, 0, 255],
  hav: [255, 128, 255],
  inn: [0, 128, 255],
  elv: [255, 128, 128]
};

/* Fargetabellen for dagens klasser per rute (klasserIFlis): plass 0 er ukjent og gjennomsiktig, og plass 1–6 er klassene i ALLE i de
   rene fargene. De lagrede klassene er bilder med denne fargetabellen (solv.klasser). */
export const KLASSETABELL = [[0, 0, 0], ...ALLE.map(([id]) => DATAFARGE[id])];

/* Tolking av fargene. I kanten mellom to flater blander tjenesten fargene. Hver farge tolkes derfor som en blanding av de to klassene
   den ligger nærmest linjen mellom: klasse A, klasse B og hvor mye av A (0–255). Oppslaget regnes ut én gang, for 32 nivåer per
   fargekanal. */
export const BLANDING = (() => {
  const A = new Uint8Array(32768),
    B = new Uint8Array(32768),
    T = new Uint8Array(32768),
    P = ALLE.map(([id]) => DATAFARGE[id]);
  for (let q = 0; q < 32768; q++) {
    const p = [((q >> 10) * 255) / 31, (((q >> 5) & 31) * 255) / 31, ((q & 31) * 255) / 31];
    let best = Infinity;
    for (let a = 0; a < P.length; a++)
      for (let b = a + 1; b < P.length; b++) {
        let dd = 0,
          pd = 0;
        for (let k = 0; k < 3; k++) {
          const d = P[a][k] - P[b][k];
          dd += d * d;
          pd += (p[k] - P[b][k]) * d;
        }
        const t = Math.max(0, Math.min(1, pd / dd));
        let e = 0;
        for (let k = 0; k < 3; k++) {
          const d = p[k] - P[b][k] - t * (P[a][k] - P[b][k]);
          e += d * d;
        }
        if (e < best) {
          best = e;
          A[q] = a;
          B[q] = b;
          T[q] = Math.round(t * 255);
        }
      }
  }
  return { A, B, T };
})();
/* Plassen til en farge i oppslaget */
export const fargeNr = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
/* Klassen det er mest av i en piksel: plass i ALLE */
export const klasseAv = (r: number, g: number, b: number) => {
  const q = fargeNr(r, g, b);
  return BLANDING.T[q] >= 128 ? BLANDING.A[q] : BLANDING.B[q];
};
/* Dagens klasse per rute i en flis, fra kartbildet K fra NIBIO (piksler i de rene fargene): 0 der bildet er tomt (mindre dekket enn
   SYNLIG), ellers plassen i ALLE pluss én: 1 bebygd, 2 jordbruk, 3 natur, 4–6 vann */
export function klasserIFlis(K: Piksler): Uint8Array {
  const kl = new Uint8Array(K.length / 4);
  for (let i = 0, q = 0; i < K.length; i += 4, q++)
    if (K[i + 3] >= SYNLIG) kl[q] = klasseAv(K[i], K[i + 1], K[i + 2]) + 1;
  return kl;
}

/* Detaljklassene: de samme klassene, men med skogen delt etter treslag (barskog, lauvskog og blandingsskog) og underlag (tresatt
   myr og tresatt innmarksbeite for seg), jordbruket delt i dyrket mark og grasmark, og naturen ellers etter økosystemtype. Til
   sammen 19 klasser, i ett kartbilde per flis. Foreløpig bare til tvillingen fra Figma. Dagens klasser over, som hovedsiden bruker,
   er ikke endret.
   NIBIO tegner hver klasse i en egen farge (DETALJFARGE), i bilder med 24 bit farge. Hver farge leses som blandingen av de to
   klassene den ligger nærmest, som for dagens klasser. Sammenlignet med en tegning uten blanding (SVG) gir det samme areal for de
   seks klassene, og innenfor ±3 % for de store detaljklassene (se METODE.md). */
/* Treslaget som dominerer i skogen, og underlaget: vanlig skog, tresatt myr eller tresatt innmarksbeite */
export type Treslag = 'bar' | 'lauv' | 'bland';
export type Underlag = 'vanlig' | 'myr' | 'beite';
/* En detaljklasse: id, navn, klassen den hører til blant dagens seks (gruppe), og økosystemtypen i grunnkartet
   (okosystemtypeniva1). Skogen har også treslag og underlag. rest er restklassene, som ikke finnes hos NIBIO (se under). */
export interface Detaljklasse {
  id: string;
  navn: string;
  gruppe: KlasseId;
  okosystem: string;
  treslag?: Treslag;
  underlag?: Underlag;
  rest?: boolean;
}
const TRESLAG: [Treslag, string][] = [
    ['bar', 'Barskog'],
    ['lauv', 'Lauvskog'],
    ['bland', 'Blandingsskog']
  ],
  UNDERLAG: [Underlag, string][] = [
    ['vanlig', ''],
    ['myr', ' på myr'],
    ['beite', ' på innmarksbeite']
  ];
/* Restklassene: jordbruk eller natur i dagens klasser, der kartbildet med detaljklasser viser en klasse fra en annen av dagens
   klasser, som i kanten mellom to flater, eller ingenting. Slik ligger detaljklassen alltid innenfor dagens klasse i ruta, og
   detaljklassene summerer til dagens klasser. Koden er ikke en økosystemtype i grunnkartet. */
export const RESTOKOSYSTEMER: { kode: string; navn: string; gruppe: KlasseId }[] = [
  { kode: 'jordbrukUspesifisert', navn: 'Jordbruk, uspesifisert', gruppe: 'jor' },
  { kode: 'naturUspesifisert', navn: 'Natur, uspesifisert', gruppe: 'nat' }
];
/* De 19 klassene fra NIBIO, i rekkefølgen fargene er valgt for, og til slutt de to restklassene */
export const DETALJKLASSER: Detaljklasse[] = [
  { id: 'beb', navn: 'Bebygd og opparbeidet', gruppe: 'beb', okosystem: 'bebygdOpparbeidetAreal' },
  { id: 'dyrket', navn: 'Dyrket mark', gruppe: 'jor', okosystem: 'dyrketmark' },
  { id: 'gras', navn: 'Grasmark', gruppe: 'jor', okosystem: 'grasmark' },
  ...TRESLAG.flatMap(([treslag, tnavn]) =>
    UNDERLAG.map(([underlag, unavn]) => ({
      id: `skog-${treslag}-${underlag}`,
      navn: tnavn + unavn,
      gruppe: 'nat' as KlasseId,
      okosystem: 'skog',
      treslag,
      underlag
    }))
  ),
  { id: 'hei', navn: 'Hei og buskmark', gruppe: 'nat', okosystem: 'heiBuskmark' },
  { id: 'lite', navn: 'Lite vegetert mark', gruppe: 'nat', okosystem: 'liteVegetertMark' },
  { id: 'vat', navn: 'Åpen våtmark', gruppe: 'nat', okosystem: 'vatmark' },
  { id: 'kyst', navn: 'Kyststrender, svaberg og dyner', gruppe: 'nat', okosystem: 'kyststrenderSvabergDyner' },
  { id: 'elv', navn: 'Elver og bekker', gruppe: 'elv', okosystem: 'elverBekkerKanaler' },
  { id: 'inn', navn: 'Innsjøer', gruppe: 'inn', okosystem: 'innsjoerVannmagasiner' },
  { id: 'hav', navn: 'Hav', gruppe: 'hav', okosystem: 'hav' },
  ...RESTOKOSYSTEMER.map(o => ({
    id: o.gruppe + '-rest',
    navn: o.navn,
    gruppe: o.gruppe,
    okosystem: o.kode,
    rest: true
  }))
];
/* Navnene på treslagene og underlagene som egne grupper, i rekkefølgen sidene viser dem */
export const TRESLAGNAVN: [Treslag, string][] = [
  ['bar', 'Barskog'],
  ['bland', 'Blandingsskog'],
  ['lauv', 'Lauvskog']
];
export const UNDERLAGNAVN: [Underlag, string][] = [
  ['vanlig', 'Skog på fastmark'],
  ['myr', 'Tresatt myr'],
  ['beite', 'Tresatt innmarksbeite']
];
/* Gruppene av detaljklassene som svarene bygger på. Skog er økosystemtypen skog, også tresatt myr og tresatt innmarksbeite.
   Våtmark er økosystemtypen våtmark (åpen myr og annen åpen våtmark) og tresatt myr, som skissene regner med i våtmarken; tresatt
   myr er dermed både skog og våtmark. Land er alt unntatt hav, innsjøer og elver. Økosystemtypen på nivå 1 har skogen samlet. */
export const erSkog = (k: Detaljklasse) => !!k.treslag;
export const erVatmark = (k: Detaljklasse) => k.id === 'vat' || k.underlag === 'myr';
export const erLand = (k: Detaljklasse) => k.gruppe === 'beb' || k.gruppe === 'jor' || k.gruppe === 'nat';

/* Fargene NIBIO bes tegne klassene i, i samme rekkefølge. Valgt ved å prøve: for hvert par av klasser som grenser til hverandre i
   testflisene, skal blandingen ligge langt fra blandingene av alle andre par. */
export const DETALJFARGE: number[][] = [
  [191, 0, 191],
  [255, 64, 0],
  [51, 0, 0],
  [0, 64, 128],
  [153, 102, 255],
  [255, 153, 51],
  [0, 102, 102],
  [102, 255, 51],
  [191, 255, 191],
  [64, 255, 191],
  [51, 204, 0],
  [204, 255, 0],
  [255, 51, 153],
  [255, 204, 255],
  [0, 64, 255],
  [204, 204, 153],
  [102, 204, 102],
  [64, 0, 64],
  [204, 153, 153]
];
/* Fargetabellen for de lagrede detaljklassene: plass 0 er ukjent og gjennomsiktig, plass 1–19 er klassene fra NIBIO, og plass 20
   og 21 restklassene, i to gråtoner ingen av de andre har. De lagrede filene leses med eksakte farger (detaljfilIFlis). */
export const DETALJTABELL = [[0, 0, 0], ...DETALJFARGE, [128, 128, 128], [160, 160, 160]];

/* Klassen det er mest av i en piksel med fargen (r, g, b): plass i DETALJKLASSER. Fargen leses som en blanding av de to klassene den
   ligger nærmest linjen mellom, og klassen er den det er minst halvparten av. */
export function detaljklasseAv(r: number, g: number, b: number): number {
  const P = DETALJFARGE,
    p = [r, g, b];
  let best = Infinity,
    kl = 0;
  for (let a = 0; a < P.length; a++)
    for (let c = a + 1; c < P.length; c++) {
      let dd = 0,
        pd = 0;
      for (let k = 0; k < 3; k++) {
        const d = P[a][k] - P[c][k];
        dd += d * d;
        pd += (p[k] - P[c][k]) * d;
      }
      const t = Math.max(0, Math.min(1, pd / dd));
      let e = 0;
      for (let k = 0; k < 3; k++) {
        const d = p[k] - P[c][k] - t * (P[a][k] - P[c][k]);
        e += d * d;
      }
      if (e < best) {
        best = e;
        kl = t >= 0.5 ? a : c;
      }
    }
  return kl;
}
/* Detaljklassen per piksel i et kartbilde: 0 der bildet er tomt (mindre dekket enn SYNLIG), ellers plassen i DETALJKLASSER pluss én.
   Et kartbilde har få ulike farger, så klassen regnes ut én gang per farge i bildet. */
export function detaljklasserIFlis(K: Piksler): Uint8Array {
  const kl = new Uint8Array(K.length / 4),
    perFarge = new Map<number, number>();
  for (let i = 0, q = 0; i < K.length; i += 4, q++) {
    if (K[i + 3] < SYNLIG) continue;
    const f = (K[i] << 16) | (K[i + 1] << 8) | K[i + 2];
    let k = perFarge.get(f);
    if (k === undefined) perFarge.set(f, (k = detaljklasseAv(K[i], K[i + 1], K[i + 2]) + 1));
    kl[q] = k;
  }
  return kl;
}

/* Detaljklassen D per rute lest innenfor dagens klasse K i den samme ruta (begge med 0 for ukjent, ellers plassen pluss én). Hører
   detaljklassen til en annen av dagens klasser, eller er den ukjent, blir den restklassen for dagens klasse, eller den eneste
   detaljklassen i den (bebygd og vannet). Er dagens klasse ukjent, er detaljklassen det også. Slik summerer detaljklassene til
   dagens klasser rute for rute. */
const RESTFOR = ALLE.map(([id]) => {
  const her = DETALJKLASSER.map((k, i) => (k.gruppe === id ? i + 1 : 0)).filter(Boolean),
    rest = DETALJKLASSER.findIndex(k => k.rest && k.gruppe === id);
  return rest >= 0 ? rest + 1 : her[0];
});
export function detaljIKlassen(D: Uint8Array, K: Uint8Array): Uint8Array {
  const kl = new Uint8Array(K.length),
    gruppe = DETALJKLASSER.map(k => ALLE.findIndex(([id]) => id === k.gruppe) + 1);
  for (let q = 0; q < K.length; q++) {
    const k = K[q];
    if (!k) continue;
    const d = D[q];
    kl[q] = d && gruppe[d - 1] === k ? d : RESTFOR[k - 1];
  }
  return kl;
}
/* Detaljklassen per piksel i en lagret fil (bronse.detaljfil): fargene er eksakt fargene i DETALJTABELL, så plassen slås opp
   direkte. En farge som ikke står i tabellen, leses som et kartbilde fra NIBIO (detaljklasseAv). Plass 0 er gjennomsiktig. */
export function detaljfilIFlis(K: Piksler): Uint8Array {
  const kl = new Uint8Array(K.length / 4),
    DETALJPLASS = new Map(DETALJTABELL.map(([r, g, b], i) => [(r << 16) | (g << 8) | b, i]));
  for (let i = 0, q = 0; i < K.length; i += 4, q++) {
    if (K[i + 3] < SYNLIG) continue;
    const p = DETALJPLASS.get((K[i] << 16) | (K[i + 1] << 8) | K[i + 2]);
    kl[q] = p ? p : detaljklasseAv(K[i], K[i + 1], K[i + 2]) + 1;
  }
  return kl;
}
