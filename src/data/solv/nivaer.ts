/* Sølv, én sannhet per nivå i kartet for temaene som hentes i biter: grått areal og inngrepsfri natur. Tallene regnes av rutene i
   bitene (10,6 meter, det samme rutenettet som flisene på nivå 10). Kartet trenger verdien i hver piksel også på de andre nivåene, og
   den regnes ut her, på samme måte for begge temaene og for begge sidene:
   - Nivå 10: ruta i biten, én rute per piksel (rutenIFlis). Det er de samme rutene som tallene.
   - Finere nivåer: hver piksel får ruta den ligger i (rutenIFlis), eller et eget kartbilde på nivået tolket med den samme funksjonen
     som bitene (grått areal, se graa.ts).
   - Grovere nivåer: hver piksel er n x n ruter, og verdien velges av hvor mange ruter som har hver verdi (flestIFlisen), med
     halvregelen som for én rute: grått når minst halvparten av rutene er grå (graaHalvpart), og en sone når minst halvparten av
     rutene er minst så langt fra inngrep (soneHalvpart).
   Flisene har alltid 0 for ingenting. Funksjonene er rene, så de kan testes. */
import { BIT, BITNIVA, FLISNIVA, type Flis } from './felles.ts';

/* Bitene i listen B (fliser på nivå 8) som ligger i flisen tc, eller som flisen ligger i */
export function biterIFlisen(B: Flis[], [z, x, y]: Flis): Flis[] {
  if (z >= BITNIVA) {
    const d = z - BITNIVA;
    return B.filter(b => b[1] === x >> d && b[2] === y >> d);
  }
  const d = BITNIVA - z;
  return B.filter(b => b[1] >> d === x && b[2] >> d === y);
}

/* Verdiene i flisen tc på nivå 10 eller finere fra rutene V i biten b: hver piksel får ruta den ligger i, oversatt med tabellen
   oversett (plass v er verdien i flisen for verdien v i biten). Pikslene utenfor biten står urørt. ut er flisen, 512 x 512. */
export function rutenIFlis(V: ArrayLike<number>, b: Flis, tc: Flis, ut: Uint8Array, oversett?: ArrayLike<number>) {
  const [z, x, y] = tc;
  if (z < FLISNIVA) throw new Error('rutene leses fra nivå 10');
  const sh = z - FLISNIVA,
    bx0 = b[1] * BIT,
    by0 = b[2] * BIT,
    kol = new Int32Array(512);
  for (let px = 0; px < 512; px++) kol[px] = ((x * 512 + px) >> sh) - bx0;
  for (let py = 0; py < 512; py++) {
    const ry = ((y * 512 + py) >> sh) - by0;
    if (ry < 0 || ry >= BIT) continue;
    for (let px = 0, rad = ry * BIT; px < 512; px++) {
      const rx = kol[px];
      if (rx < 0 || rx >= BIT) continue;
      const v = V[rad + rx];
      ut[py * 512 + px] = oversett ? oversett[v] : v;
    }
  }
}

/* Verdiene i flisen tc under nivå 10 fra rutene V i biten b: hver piksel er n x n ruter, og velg gir verdien av tellingen. tell[v] er
   antall ruter med verdien v for v under antall, og tell[antall] antall ruter med en høyere verdi. n2 er antall ruter i pikselen.
   En piksel ligger alltid i én bit, for en bit er et helt antall piksler bred på alle nivåer under 10. */
export function flestIFlisen(
  V: ArrayLike<number>,
  b: Flis,
  tc: Flis,
  ut: Uint8Array,
  antall: number,
  velg: (tell: Int32Array, n2: number) => number
) {
  const [z, x, y] = tc;
  if (z >= FLISNIVA) throw new Error('flisene zoomet ut er under nivå 10');
  const n = 1 << (FLISNIVA - z),
    bx0 = b[1] * BIT,
    by0 = b[2] * BIT,
    px0 = Math.max(0, bx0 / n - x * 512),
    px1 = Math.min(512, (bx0 + BIT) / n - x * 512),
    py0 = Math.max(0, by0 / n - y * 512),
    py1 = Math.min(512, (by0 + BIT) / n - y * 512),
    tell = new Int32Array(antall + 1);
  for (let py = py0; py < py1; py++) {
    const ry0 = (y * 512 + py) * n - by0;
    for (let px = px0; px < px1; px++) {
      const rx0 = (x * 512 + px) * n - bx0;
      tell.fill(0);
      for (let ry = ry0; ry < ry0 + n; ry++)
        for (let q = ry * BIT + rx0, e = q + n; q < e; q++) {
          const v = V[q];
          tell[v < antall ? v : antall]++;
        }
      ut[py * 512 + px] = velg(tell, n * n);
    }
  }
}

/* Grått areal zoomet ut: pikselen er grå når minst halvparten av rutene er grå (trinn 1–6, 0 er ikke grått), og får da trinnet flest
   av de grå rutene har, det laveste når det er likt. Ellers 0. */
export function graaHalvpart(tell: Int32Array, n2: number) {
  if (2 * (n2 - tell[0]) < n2) return 0;
  let best = 1;
  for (let k = 2; k <= 6; k++) if (tell[k] > tell[best]) best = k;
  return best;
}
/* Inngrepsfri natur zoomet ut, med sonene i bitene (0 villmarkspreget, 1 sone 1, 2 sone 2, ellers uten sone): pikselen er
   villmarkspreget når minst halvparten av rutene er det, ellers sone 1 når minst halvparten er minst 3 km fra inngrep (sone 1 eller
   villmarkspreget), ellers sone 2 når minst halvparten er minst 1 km fra inngrep. Gir sonen pluss én, og 0 uten sone, som flisene. */
export function soneHalvpart(tell: Int32Array, n2: number) {
  let s = 0;
  for (let k = 0; k < 3; k++) {
    s += tell[k];
    if (2 * s >= n2) return k + 1;
  }
  return 0;
}
