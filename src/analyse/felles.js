/* Felles for alle analysene: rutenettet, tersklene, målestokken i UTM og arealet av en flate. Filen bruker verken nettleseren,
   kartet eller sidens tilstand, så den kan kjøres i Node. METODE.md forklarer tersklene.

   Flater er vanlige lister med koordinater, som i GeoJSON: en flerflate er [flate][ring][punkt], der første ring i hver flate er
   ytterkanten og resten er hull. Et utsnitt er [xmin, ymin, xmaks, ymaks] i meter i UTM sone 33 (EPSG:25833). */

/* Kartverkets flisnett for UTM33: origo og meter per piksel på hvert nivå. Kartet og analysene bruker det samme nettet. */
export const ORIGO = [-2500000, 9045984],
  OPPLOSNINGER = Array.from({ length: 19 }, (_, z) => 21664 / 2 ** z);

/* Planrutenettet: planlagt utbygging og alt som krysses med den, regnes i flisene på nivå 9 med 512 ruter per flis. */
export const PLANNIVA = 9,
  RUTE_M = OPPLOSNINGER[PLANNIVA] / 2 /* 21,16 meter */,
  RUTE = RUTE_M ** 2 / 1e6; /* km² per rute, 0,448 dekar */

/* Terskler. Dekningen av en piksel er alfa, fra 0 (tom) til 255 (helt dekket). */
export const HALV = 128; /* halvregelen: en rute teller når en flate dekker minst halve ruta */
export const SYNLIG = 100; /* en piksel i et kartbilde regnes som tegnet når den er minst så dekket. Resten er tomt. */
export const PLAN_FINNES = 0.15; /* kommuneplanen regnes som tilgjengelig når planlaget dekker minst 15 % av kommunen */
export const GRENSE_FLYTTET = 0.005; /* avviker kommunens samlede areal mer enn 0,5 % mellom to årganger, er grensen flyttet */
export const HAV_MIN_KM2 = 0.5,
  HAV_MIN_ANDEL = 0.005; /* rest mindre enn dette er avvik mellom grense og statistikk, ikke hav */
export const EGET_MIN_M2 = 400; /* minste tegnede område som regnes ut */

/* Rutenett for bildene som hentes for hele kommunen: [høyst antall ruter på lengste side, minste rute i meter] */
export const BILDE_TEMA = [2048, 20]; /* inngrepsfri natur og grått areal */
export const BILDE_PLANDEKNING = [256, 0]; /* sjekken av om kommunen har kommuneplan */
export const RUTENETT_VERDI = [1536, 10]; /* arealet av verdsatt natur per verdikategori */
export const RUTENETT_MASKE = [1500, 10]; /* ett område i et naturtema, til oppslag fra planrutenettet */

/* Rutenett over et utsnitt e: høyst maks ruter på lengste side, og ruter på minst `minst` meter. u er utsnittet rutene dekker,
   som kan være litt større enn e. */
export const rutenett = (e, maks, minst = 0) => {
  const res = Math.max(minst, Math.max(e[2] - e[0], e[3] - e[1]) / maks),
    w = Math.ceil((e[2] - e[0]) / res),
    h = Math.ceil((e[3] - e[1]) / res);
  return { res, w, h, u: [e[0], e[3] - h * res, e[0] + w * res, e[3]] };
};

/* Areal i kartet og i terrenget: i UTM er flater litt større i kartet, og mer jo lenger øst eller vest for sonens midtlinje.
   Gir kvadratmeter i kartet per kvadratkilometer i terrenget, regnet midt i utsnittet. Arealer i km² er areal / m2PerKm2(utsnitt). */
export const m2PerKm2 = e => {
  const k = 0.9996 * (1 + ((e[0] + e[2]) / 2 - 500000) ** 2 / (2 * 6.38e6 ** 2));
  return k * k * 1e6;
};

/* Arealet av én ring, med fortegn etter omløpsretning. Punktene regnes fra siste punkt, så tallene holdes små. */
const ringAreal = ring => {
  const n = ring.length;
  if (n < 3) return 0;
  const x0 = ring[n - 1][0],
    y0 = ring[n - 1][1];
  let a = 0,
    dx1 = 0,
    dy1 = 0;
  for (let i = 0; i < n; i++) {
    const dx2 = ring[i][0] - x0,
      dy2 = ring[i][1] - y0;
    a += dy1 * dx2 - dx1 * dy2;
    dx1 = dx2;
    dy1 = dy2;
  }
  return a / 2;
};
/* Arealet av en flerflate i kvadratmeter i kartet: ytterkantene minus hullene. */
export const areal = koord => {
  let sum = 0;
  for (const flate of koord) flate.forEach((ring, i) => (sum += (i ? -1 : 1) * Math.abs(ringAreal(ring))));
  return sum;
};

/* Utsnitt: det minste utsnittet som rommer en flerflate, snittet av to, og om to utsnitt overlapper. */
export const omriss = koord => {
  const e = [Infinity, Infinity, -Infinity, -Infinity];
  for (const flate of koord)
    for (const [x, y] of flate[0] || []) {
      if (x < e[0]) e[0] = x;
      if (y < e[1]) e[1] = y;
      if (x > e[2]) e[2] = x;
      if (y > e[3]) e[3] = y;
    }
  return e;
};
export const snitt = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
export const tomt = e => e[2] < e[0] || e[3] < e[1];
export const overlapper = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

/* En flate fra GeoJSON som flerflate */
export const flerflate = g => (g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates]);

/* Midtpunktet av rute i i planrutenettet R, i meter */
export const ruteX = (R, i) => ORIGO[0] + (R.cx0 + (i % R.w) + 0.5) * (OPPLOSNINGER[R.z] / 2);
export const ruteY = (R, i) => ORIGO[1] - (R.cy0 + Math.floor(i / R.w) + 0.5) * (OPPLOSNINGER[R.z] / 2);
