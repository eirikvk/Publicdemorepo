/* Generelt: flategeometri i et plant koordinatsystem. Filen vet ingenting om kart, kilder eller natur, og alle lagene i data kan
   bruke den. Flater er vanlige lister med koordinater, som i GeoJSON: en flerflate er [flate][ring][punkt], der første ring i hver
   flate er ytterkanten og resten er hull. Et utsnitt er [xmin, ymin, xmaks, ymaks]. Hvilket koordinatsystem som brukes, og hva et
   areal blir i km² i terrenget, står i solv/felles.ts. */

/* Et punkt [x, y], eller [x, y, z] */
export type Punkt = number[];
/* En lukket ring av punkter */
export type Ring = Punkt[];
/* En flate: første ring er ytterkanten, resten er hull */
export type Flate = Ring[];
/* Flere flater, som MultiPolygon i GeoJSON */
export type Flerflate = Flate[];
/* [xmin, ymin, xmaks, ymaks], samme form som i OpenLayers */
export type Utsnitt = number[];
/* En flerflate med utsnittet sitt. Kommunen er en slik, og det samme er hvert område i et naturtema. */
export interface FlateMedUtsnitt {
  koord: Flerflate;
  ext: Utsnitt;
}
/* En geometri fra GeoJSON med flater */
export interface GeoJsonFlate {
  type: string;
  coordinates: Flate | Flerflate;
}

/* En flate fra GeoJSON som flerflate */
export const flerflate = (g: GeoJsonFlate): Flerflate =>
  g.type === 'MultiPolygon' ? (g.coordinates as Flerflate) : [g.coordinates as Flate];

/* Arealet av én ring med fortegn: positivt når ringen går mot klokka, negativt når den går med klokka. Punktene regnes fra siste
   punkt, så tallene holdes små også langt fra origo. */
export const ringAreal = (ring: Ring) => {
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
    a += dx1 * dy2 - dy1 * dx2;
    dx1 = dx2;
    dy1 = dy2;
  }
  return a / 2;
};
/* Omløpsretningen til en ring: true når den går mot klokka */
export const motKlokka = (ring: Ring) => ringAreal(ring) > 0;
/* Arealet av en flerflate: ytterkantene minus hullene, i koordinatenes enhet i andre (kvadratmeter i UTM) */
export const areal = (koord: Flerflate) => {
  let sum = 0;
  for (const flate of koord) flate.forEach((ring, i) => (sum += (i ? -1 : 1) * Math.abs(ringAreal(ring))));
  return sum;
};

/* Utsnittet e utvidet så det rommer ringen, på stedet */
const rom = (e: Utsnitt, ring: Ring) => {
  for (const [x, y] of ring) {
    if (x < e[0]) e[0] = x;
    if (y < e[1]) e[1] = y;
    if (x > e[2]) e[2] = x;
    if (y > e[3]) e[3] = y;
  }
};
/* Det minste utsnittet som rommer en flerflate. utsnitt tar med alle ringene, slik OpenLayers gjør. omriss tar bare med
   ytterkantene. */
export const utsnitt = (koord: Flerflate): Utsnitt => {
  const e = [Infinity, Infinity, -Infinity, -Infinity];
  for (const flate of koord) for (const ring of flate) rom(e, ring);
  return e;
};
export const omriss = (koord: Flerflate): Utsnitt => {
  const e = [Infinity, Infinity, -Infinity, -Infinity];
  for (const flate of koord) rom(e, flate[0] || []);
  return e;
};
/* Snittet av to utsnitt, om snittet er tomt, og om to utsnitt overlapper */
export const snitt = (a: Utsnitt, b: Utsnitt): Utsnitt => [
  Math.max(a[0], b[0]),
  Math.max(a[1], b[1]),
  Math.min(a[2], b[2]),
  Math.min(a[3], b[3])
];
export const tomt = (e: Utsnitt) => e[2] < e[0] || e[3] < e[1];
export const overlapper = (a: Utsnitt, b: Utsnitt) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
/* Et oppslag for mange punkter i samme flerflate: kantene sortert i bånd etter y, så hvert oppslag bare ser på kantene i sitt bånd.
   Gir det samme som iFlate, men raskt også for flater med tusenvis av punkter. */
export interface Flatesok {
  ext: Utsnitt;
  y0: number;
  dy: number;
  band: Float64Array[];
}
export function flatesok(koord: Flerflate, ext: Utsnitt = utsnitt(koord)): Flatesok {
  let n = 0;
  for (const flate of koord) for (const ring of flate) n += ring.length;
  const nb = Math.max(1, Math.min(4096, Math.ceil(n / 4))),
    y0 = ext[1],
    dy = (ext[3] - ext[1]) / nb || 1,
    lister: number[][] = Array.from({ length: nb }, () => []);
  for (const flate of koord)
    for (const ring of flate)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i],
          [xj, yj] = ring[j];
        if (yi === yj) continue;
        const a = Math.max(0, Math.floor((Math.min(yi, yj) - y0) / dy)),
          b = Math.min(nb - 1, Math.floor((Math.max(yi, yj) - y0) / dy));
        for (let k = a; k <= b; k++) lister[k].push(xi, yi, xj, yj);
      }
  return { ext, y0, dy, band: lister.map(l => Float64Array.from(l)) };
}
/* Om punktet (x, y) ligger i flaten bak oppslaget S, med samme regel som iFlate */
export function iSok(S: Flatesok, x: number, y: number) {
  if (x < S.ext[0] || x > S.ext[2] || y < S.ext[1] || y > S.ext[3]) return false;
  const B = S.band[Math.min(S.band.length - 1, Math.max(0, Math.floor((y - S.y0) / S.dy)))];
  let inne = false;
  for (let i = 0; i < B.length; i += 4) {
    const xi = B[i],
      yi = B[i + 1],
      xj = B[i + 2],
      yj = B[i + 3];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inne = !inne;
  }
  return inne;
}
/* Om punktet p ligger i flerflaten koord. Like-ulik-regelen over alle ringene, så punkter i hull er utenfor. */
export function iFlate(p: Punkt, koord: Flerflate) {
  let inne = false;
  for (const flate of koord)
    for (const ring of flate)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i],
          [xj, yj] = ring[j];
        if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inne = !inne;
      }
  return inne;
}
