/* Grått areal: areal som alt er tatt i bruk eller sterkt påvirket av bygge- og anleggsaktivitet, fra kart over grå arealer (NIBIO,
   testversjon). Arealet per trinn etter andel vegetasjon, regnet fra to bilder av hele kommunen, og kryssingen med planrutenettet.
   Grått betyr ikke ledig. */
import { HALV, ruteX, ruteY } from './felles.js';

/* Trinnene etter andel vegetasjon i flaten: [farge, navn, fra og med prosent, til prosent] */
export const GRAATRINN = [
  ['graa1', 'Under 1 % vegetasjon', 0, 1],
  ['graa2', '1–25 % vegetasjon', 1, 25],
  ['graa3', '25–50 % vegetasjon', 25, 50],
  ['graa4', '50–75 % vegetasjon', 50, 75],
  ['graa5', '75–100 % vegetasjon', 75, 101]
];
/* Trinnet for en piksel i bildet av flatene med oppgitt vegetasjon. Stilen som sendes til NIBIO, tegner trinn n i rødt med styrke
   51 · n. r er den røde fargen og a dekningen. Gir 0 ikke grått, 1–5 andel vegetasjon fra lavest til høyest, og 6 grått uten oppgitt
   andel (veier og lignende). */
export const graaTrinn = (r, a) => (a < HALV ? 0 : r < 26 ? 6 : Math.min(5, Math.max(1, Math.round(r / 51))));

/* Tolker de to bildene av kommunen. P er bildet av alt grått areal, V bildet av flatene med oppgitt andel vegetasjon og M kommunens
   flate, alle som piksler (RGBA) i samme rutenett med ruter på res meter. skala er m2PerKm2 for kommunen. En rute er grå når den er
   minst halvt dekket, og telles når den ligger i kommunen. Gir trinnet per rute (kl) og arealet per trinn og samlet i km², avrundet
   til nærmeste 10 dekar. */
export function tolkGraa(P, V, M, res, skala) {
  const kl = new Uint8Array(P.length / 4),
    n = new Int32Array(7);
  for (let i = 0, q = 0; i < P.length; i += 4, q++) {
    const t = V[i + 3] >= HALV ? graaTrinn(Math.max(26, V[i]), 255) : P[i + 3] >= HALV ? 6 : 0;
    kl[q] = t;
    if (t && M[i + 3] >= HALV) n[t]++;
  }
  const trinn = Array.from(n, v => Math.round(((v * res * res) / skala) * 100) / 100);
  return { kl, trinn, sum: Math.round(trinn.reduce((x, y) => x + y, 0) * 100) / 100 };
}

/* Trinnet i et punkt (x, y) i meter, fra resultatet D av tolkGraa med rutenettet (u, res, w, h). 0 utenfor bildet. */
export const graaVed = (D, x, y) => {
  const px = Math.floor((x - D.u[0]) / D.res),
    py = Math.floor((D.u[3] - y) / D.res);
  return px < 0 || py < 0 || px >= D.w || py >= D.h ? 0 : D.kl[py * D.w + px];
};

/* Planlagt utbygging krysset med grått areal: hvor mye av all planlagt utbygging på land som ligger på areal som alt er grått, altså
   gjenbruk, og hvor mye av det som er minst halvparten vegetasjon (trinn 4 og 5). Regnes for planen med egne områder (S) og planen
   alene (P), for hele kommunen og per eget område. Her er alle ruter med planlagt utbygging på land med, også der det er bebygd i
   dag, og uten regelen om smale striper. Midtpunktet i hver rute slås opp i bildet av grått areal.
   gront er ruter som er bebygd i grunnkartet, men ikke grå: grønne arealer som parker og idrettsanlegg. R er planrutenettet, D
   resultatet av tolkGraa og delvis om bare en del av kommunen er hentet. */
export function kryssGraa(R, D, delvis) {
  const nE = R.egetType ? R.antallEgne : 0,
    tom = () => ({ tot: 0, graa: 0, gron: 0, gront: 0 }),
    ny = () => ({ ...tom(), eg: Array.from({ length: nE }, tom) }),
    S = ny(),
    P = ny();
  const en = (x, k, c) => {
      x.tot++;
      if (k) x.graa++;
      else if (c === 1) x.gront++;
      if (k === 4 || k === 5) x.gron++;
    },
    legg = (T, e, k, c) => {
      en(T, k, c);
      if (e) en(T.eg[e - 1], k, c);
    };
  let bebygd = 0,
    gront = 0;
  for (let i = 0; i < R.kl.length; i++) {
    const c = R.kl[i];
    if (c < 1 || c > 3) continue;
    const b = R.pl[i],
      ty = nE ? R.egetType[i] : 0,
      s = ty === 1 ? 1 : ty === 2 ? 0 : b;
    if (c !== 1 && !b && !s) continue;
    const k = graaVed(D, ruteX(R, i), ruteY(R, i)),
      e = nE ? R.eget[i] : 0;
    if (c === 1) {
      bebygd++;
      if (!k) gront++;
    }
    if (s) legg(S, e, k, c);
    if (b) legg(P, e, k, c);
  }
  return { nr: R.nr, S, P, bebygd, gront, antallEgne: nE, delvis };
}
