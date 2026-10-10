/* Sølv, felles standard: arealklassene. Inndelingen i bebygd, jordbruk og natur, med koblingen til SSBs arealklasser og
   grunnkartets økosystemtyper, og tolkingen av fargene i kartbildene fra NIBIO. */

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
