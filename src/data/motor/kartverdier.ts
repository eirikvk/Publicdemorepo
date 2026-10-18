/* Datamotoren for kartlagene: hva hver piksel i en kartflis er, fra den felles sannheten i sølv og gull på nivået flisen er på.
   Begge sidene (hovedsiden og tvillingen fra Figma) tegner kartlagene av dagens klasser, detaljklassene, grått areal, inngrepsfri
   natur og planlagt utbygging av disse funksjonene, med den samme tegnemotoren (ui/kart/verdilag.ts). Kartlagene bestemmer bare
   hvordan verdiene ser ut. Trykk i kartet slår opp i de samme funksjonene (verdiIPunkt).
   Hver funksjon gir én verdi per piksel i flisen tc (512 x 512), 0 for ingenting, eller null når det ikke er noe å vise:
   - Nivå 10: rutene på 10,6 meter som tallene regnes av.
   - Finere nivåer: sølv på det nivået (solv.klasser, solv.detaljklasser, solv.graatrinn og solv.inonsoner).
   - Grovere nivåer: utledet av nivå 10 for valgt kommune (tabellene som slutter på Ut).
   Lagene som bygger på dagens klasser, leser dem på det samme nivået, så de aldri er uenige med dem. */
import { katalog } from '../katalog.ts';
import { FLISNIVA, flisUtsnitt, flisVed, type Flis } from '../solv/felles.ts';
import { egneIFlis } from '../solv/egne.ts';
import { graaOgGront } from '../solv/graa.ts';
import { inonINatur } from '../solv/inon.ts';
import { planFinere, planPaaNivaa10, planUt } from '../gull/planflis.ts';
import { ingenPlan, utbyggingen } from './plan.ts';
import { valgtNr, verdi } from './valgt.ts';
import { tidSlutt } from './tilstand.ts';

/* Flisen tc under nivå 10 for valgt kommune, som tabellene zoomet ut kalles med, eller null uten valgt kommune */
const ut = (tc: Flis): [string, number, number, number] | null => {
  const nr = valgtNr();
  return nr ? [nr, tc[0], tc[1], tc[2]] : null;
};

/* Dagens klasser per piksel: plassen i ALLE pluss én (1 bebygd, 2 jordbruk, 3 natur, 4–6 vann), 0 ukjent. Fra nivå 10 solv.klasser,
   og zoomet ut solv.klasserUt. */
export async function klasserIFlis(tc: Flis): Promise<Uint8Array | null> {
  const t0 = performance.now(),
    k = tc[0] < FLISNIVA ? ut(tc) : null;
  if (tc[0] < FLISNIVA && !k) return null;
  const K = await (k ? katalog.solv.klasserUt(k) : katalog.solv.klasser(tc));
  tidSlutt('dagens klasser', t0);
  return K.kl;
}
/* Detaljklassen per piksel: plassen i DETALJKLASSER pluss én, 0 ukjent. Fra nivå 10 solv.detaljklasser, og zoomet ut
   solv.detaljklasserUt. Den ligger alltid innenfor dagens klasse i klasserIFlis. */
export async function detaljerIFlis(tc: Flis): Promise<Uint8Array | null> {
  const k = tc[0] < FLISNIVA ? ut(tc) : null;
  if (tc[0] < FLISNIVA && !k) return null;
  return (await (k ? katalog.solv.detaljklasserUt(k) : katalog.solv.detaljklasser(tc))).kl;
}
/* Grått areal per piksel: trinnet 1–6 der det er grått, GRONT (7) der det er bebygd, men ikke grått, og 0 ellers (graaOgGront i
   solv/graa.ts). Fra nivå 10 solv.graatrinn, og zoomet ut solv.graatrinnUt, med dagens klasser på det samme nivået. */
export async function graaIFlis(tc: Flis): Promise<Uint8Array | null> {
  const t0 = performance.now(),
    k = tc[0] < FLISNIVA ? ut(tc) : null;
  if (tc[0] < FLISNIVA && !k) return null;
  const [T, K] = await Promise.all([k ? katalog.solv.graatrinnUt(k) : katalog.solv.graatrinn(tc), klasserIFlis(tc)]);
  tidSlutt('grått areal, fliser', t0);
  return graaOgGront(T.kl, K);
}
/* Inngrepsfri natur per piksel: sonen pluss én (1 villmarkspreget, 2 sone 1, 3 sone 2) der dagens klasse er natur, og 0 ellers
   (inonINatur i solv/inon.ts). Fra nivå 10 solv.inonsoner, og zoomet ut solv.inonsonerUt. */
export async function inonIFlis(tc: Flis): Promise<Uint8Array | null> {
  const t0 = performance.now(),
    k = tc[0] < FLISNIVA ? ut(tc) : null;
  if (tc[0] < FLISNIVA && !k) return null;
  const [S, K] = await Promise.all([k ? katalog.solv.inonsonerUt(k) : katalog.solv.inonsoner(tc), klasserIFlis(tc)]);
  tidSlutt('inngrepsfri natur, fliser', t0);
  return inonINatur(S.kl, K);
}

/* Sonen for inngrepsfri natur per piksel, også utenfor naturen: 0 uten sone, 1 villmarkspreget, 2 sone 1, 3 sone 2. Fra nivå 10
   solv.inonsoner, og zoomet ut solv.inonsonerUt. Til trykk i kartet. */
export async function soneIFlis(tc: Flis): Promise<Uint8Array | null> {
  const k = tc[0] < FLISNIVA ? ut(tc) : null;
  if (tc[0] < FLISNIVA && !k) return null;
  return (await (k ? katalog.solv.inonsonerUt(k) : katalog.solv.inonsoner(tc))).kl;
}
/* Planlagt utbygging per piksel (gull/planflis.ts): natur satt av 1–STYRKER og jordbruk satt av STYRKER + 1 til 2 · STYRKER, med
   styrken etter hvor stor del av pikselen som er satt av, og 0 ellers. Bygger på utbyggingen for valgt kommune (gull.utbygging), med
   smale striper når smale er sann: på nivå 10 rutene i den, finere kommuneplanen, dagens klasser og egne områder på nivået i eller
   inntil feltene i den, og zoomet ut med dagens klasse i pikselen. null før utbyggingen er regnet ut. */
export async function planIFlis(tc: Flis, smale: boolean): Promise<Uint8Array | null> {
  const t0 = performance.now(),
    R = utbyggingen();
  if (!R) return null;
  const D = smale ? R.alle : R.ryddet;
  let ut: Uint8Array | null;
  if (tc[0] === FLISNIVA) ut = planPaaNivaa10(D, tc);
  else if (tc[0] < FLISNIVA) {
    const K = await klasserIFlis(tc);
    ut = K ? planUt(D, K, tc) : null;
  } else {
    const [K, P] = await Promise.all([klasserIFlis(tc), ingenPlan() ? null : katalog.solv.kommuneplanruter(tc)]),
      E = verdi(katalog.solv.egne);
    ut = K ? planFinere(R, K, P ? P.plan : null, E ? egneIFlis(E, flisUtsnitt(tc)) : null, tc, smale) : null;
  }
  tidSlutt('planfliser', t0);
  return ut;
}

/* Om flisen tc har noe av valgt kommune: om minst én av kommunens blokker på nivå 10 (solv.blokker) ligger i flisen, eller flisen i
   den. Kartlagene som klippes mot kommunen, tegner bare slike fliser, så det hentes ingenting utenfor. */
export async function iKommunen([z, x, y]: Flis): Promise<boolean> {
  const nr = valgtNr();
  if (!nr) return false;
  const B = await katalog.solv.blokker([nr, FLISNIVA]);
  if (z >= FLISNIVA) {
    const d = z - FLISNIVA;
    return B.some(b => b[1] === x >> d && b[2] === y >> d);
  }
  const d = FLISNIVA - z;
  return B.some(b => b[1] >> d === x && b[2] >> d === y);
}

/* Verdien i punktet p [øst, nord] fra en av funksjonene over (f), på nivået z kartet viser: pikselen punktet ligger i, i flisen på
   nivå z. Slik sier et trykk i kartet det samme som kartlagene viser. 0 når det ikke er noe der. */
export async function verdiIPunkt(f: (tc: Flis) => Promise<ArrayLike<number> | null>, p: number[], z: number) {
  const tc = flisVed(p, z),
    u = flisUtsnitt(tc),
    px = Math.max(0, Math.min(511, Math.floor(((p[0] - u[0]) / (u[2] - u[0])) * 512))),
    py = Math.max(0, Math.min(511, Math.floor(((u[3] - p[1]) / (u[3] - u[1])) * 512))),
    V = await f(tc);
  return V ? V[py * 512 + px] : 0;
}
