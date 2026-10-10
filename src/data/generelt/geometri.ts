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
