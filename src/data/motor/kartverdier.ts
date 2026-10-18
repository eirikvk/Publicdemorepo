/* Datamotoren for kartlagene: hva hver piksel i en kartflis er, fra den felles sannheten i sølv på nivået flisen er på. Begge sidene
   (hovedsiden og tvillingen fra Figma) tegner kartlagene av dagens klasser, detaljklassene, grått areal og inngrepsfri natur av disse
   funksjonene, med den samme tegnemotoren (ui/kart/verdilag.ts). Kartlagene bestemmer bare hvordan verdiene ser ut.
   Hver funksjon gir én verdi per piksel i flisen tc (512 x 512), 0 for ingenting, eller null når det ikke er noe å vise:
   - Nivå 10: rutene på 10,6 meter som tallene regnes av.
   - Finere nivåer: sølv på det nivået (solv.klasser, solv.detaljklasser, solv.graatrinn og solv.inonsoner).
   - Grovere nivåer: utledet av nivå 10 for valgt kommune (tabellene som slutter på Ut).
   Lagene som bygger på dagens klasser, leser dem på det samme nivået, så de aldri er uenige med dem. */
import { katalog } from '../katalog.ts';
import { FLISNIVA, type Flis } from '../solv/felles.ts';
import { graaOgGront } from '../solv/graa.ts';
import { inonINatur } from '../solv/inon.ts';
import { valgtNr } from './valgt.ts';
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
