/* Gull for kartet over planlagt utbygging: verdien per piksel i en kartflis, én sannhet per nivå. Det samme rutenettet som tallene
   (gull.utbygging, med eller uten smale striper) er sannheten:
   - Nivå 10: rutene i rutenettet, én rute per piksel (planPaaNivaa10).
   - Finere nivåer: kommuneplanen, dagens klasser og de egne områdene på nivået, og bare der ruta på nivå 10, eller en av de fire
     naborutene, er et felt i rutenettet (planFinere). Pikslene er mindre enn rutene, og kantene er da tegnet litt ulikt.
   - Zoomet ut: hver piksel er flere ruter, og får farge når dagens klasse i pikselen (solv.klasserUt) er natur eller jordbruk og minst
     én av rutene er satt av, med styrken etter hvor stor del av pikselen det gjelder (planUt). Små felt forsvinner da ikke, og natur
     satt av vises bare på naturpiksler.
   Verdiene: 0 ingenting, natur satt av 1–STYRKER og jordbruk satt av STYRKER + 1 til 2 · STYRKER, der styrken er hvor stor del av
   pikselen som er satt av, i STYRKER trinn. Fra nivå 10 er hver piksel enten helt med eller ikke. */
import { BLOKK, blokkAv, blokkNokkel, nummer, verdi, type Glissen } from '../generelt/glissen.ts';
import { FLISNIVA, type Flis } from '../solv/felles.ts';
import { JOR, NAT } from '../solv/klasser.ts';
import type { Utbygging } from './utbygging.ts';

export const STYRKER = 16;
/* Verdien for natur (1) eller jordbruk (2) i rutenettet med andelen a av pikselen */
const verdien = (type: number, a: number) =>
  (type === 2 ? STYRKER : 0) + Math.min(STYRKER, Math.max(1, Math.ceil(a * STYRKER)));

/* Nivå 10: rutenettet D (1 natur, 2 jordbruk satt av) i flisen tc, som er én blokk */
export function planPaaNivaa10(D: Glissen, tc: Flis): Uint8Array {
  if (tc[0] !== FLISNIVA) throw new Error('rutene er på nivå 10');
  const ut = new Uint8Array(BLOKK * BLOKK),
    B = D.blokker.get(blokkNokkel(tc[1], tc[2]));
  if (B) for (let q = 0; q < B.length; q++) if (B[q] === 1 || B[q] === 2) ut[q] = verdien(B[q], 1);
  return ut;
}

/* Om ruta (X, Y) på nivå 10, eller en av de fire naborutene, er et felt i det ryddede rutenettet L */
function iEllerInntil(L: Glissen, X: number, Y: number) {
  for (const [dx, dy] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ]) {
    const i = nummer(L, X + dx, Y + dy);
    if (i >= 0 && verdi(L, i)) return true;
  }
  return false;
}
/* Finere nivåer: dagens klasse kl (plassen i ALLE pluss én) og kommuneplanen pl (1 planlagt utbygging) per piksel i flisen tc på
   nivået, og de egne områdene E (1 utbygging, 2 ikke utbygging, null uten). Egne områder erstatter planen der de ligger. Med smale
   striper (smale) vises alt; ellers bare det som ligger i eller inntil et felt i det ryddede rutenettet til utbyggingen R. */
export function planFinere(
  R: Utbygging,
  kl: ArrayLike<number>,
  pl: ArrayLike<number> | null,
  E: Uint8Array | null,
  tc: Flis,
  smale: boolean
): Uint8Array {
  const [z, x, y] = tc;
  if (z <= FLISNIVA) throw new Error('finere nivåer er over nivå 10');
  const sh = z - FLISNIVA,
    ut = new Uint8Array(512 * 512);
  for (let py = 0, q = 0; py < 512; py++)
    for (let px = 0; px < 512; px++, q++) {
      const e = E ? E[q] : 0,
        k = kl[q] - 1;
      if (e === 2 || k < 0 || (e !== 1 && !(pl && pl[q])))
        continue; /* tatt ut av planen, ukjent, eller utenfor planområdene */
      if (k !== JOR && k !== NAT) continue; /* allerede bebygd i dag, eller vann */
      if (e !== 1 && !smale && !iEllerInntil(R.ryddet, (x * 512 + px) >> sh, (y * 512 + py) >> sh)) continue;
      ut[q] = verdien(k === JOR ? 2 : 1, 1);
    }
  return ut;
}

/* Zoomet ut: rutenettet D og dagens klasse K per piksel i flisen tc under nivå 10. Pikselen får natur satt av når klassen er natur og
   minst én rute er natur satt av, og jordbruk satt av på samme måte, med andelen av pikselen. */
export function planUt(D: Glissen, K: ArrayLike<number>, tc: Flis): Uint8Array {
  const [z, x, y] = tc;
  if (z >= FLISNIVA) throw new Error('zoomet ut er under nivå 10');
  const f = 1 << (FLISNIVA - z),
    X0 = x * 512 * f,
    Y0 = y * 512 * f,
    A = new Uint32Array(512 * 512),
    B = new Uint32Array(512 * 512);
  /* bare blokkene som finnes, har planlagt utbygging, og bare de i flisen gås gjennom */
  for (const [nokkel, blokk] of D.blokker) {
    const [bx, by] = blokkAv(nokkel);
    if ((bx + 1) * BLOKK <= X0 || bx * BLOKK >= X0 + 512 * f || (by + 1) * BLOKK <= Y0 || by * BLOKK >= Y0 + 512 * f)
      continue;
    for (let q = 0; q < blokk.length; q++) {
      const v = blokk[q];
      if (v !== 1 && v !== 2) continue;
      const X = bx * BLOKK + (q % BLOKK),
        Y = by * BLOKK + Math.floor(q / BLOKK);
      if (nummer(D, X, Y) < 0) continue;
      const p = Math.floor((Y - Y0) / f) * 512 + Math.floor((X - X0) / f);
      if (v === 1) A[p]++;
      else B[p]++;
    }
  }
  const ut = new Uint8Array(512 * 512),
    n2 = f * f;
  for (let p = 0; p < ut.length; p++) {
    const k = K[p] - 1;
    if (k === NAT && A[p]) ut[p] = verdien(1, A[p] / n2);
    else if (k === JOR && B[p]) ut[p] = verdien(2, B[p] / n2);
  }
  return ut;
}
