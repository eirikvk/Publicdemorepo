/* Sølv for kommuneplanen fra DiBK: planlagt utbygging per rute i en flis (solv.kommuneplanruter), og om kommunen har kommuneplan hos
   DiBK og hvilken. Bare kommuneplanen: den legges oppå dagens klasser og egne områder i gull (gull/utbygging.ts). */
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import {
  BILDE_PLANDEKNING,
  HALV,
  PLANOVERSIKT,
  PLANOVERSIKT_NIVA,
  PLAN_FINNES,
  SYNLIG,
  flisrammen,
  rutenett,
  type Flis,
  type Piksler,
  type Planruter
} from './felles.ts';
import { bildePiksler, flatePiksler } from './raster.ts';

/* Planlagt utbygging per rute i en flis, fra kartbildet P fra DiBK (piksler): 1 der minst halve ruta ligger i en planflate
   (halvregelen), ellers 0 */
export function planIFlis(P: Piksler): Uint8Array {
  const pl = new Uint8Array(P.length / 4);
  for (let i = 3, q = 0; i < P.length; i += 4, q++) if (P[i] >= HALV) pl[q] = 1;
  return pl;
}
/* Tabellen solv.kommuneplanruter: kommuneplanen fra DiBK i flisen tc, som planen per rute (Planruter i felles.ts). plan er 1 der
   minst halve ruta ligger i en flate for framtidig utbygging, ellers 0. Kommuneplanen har ingen områder. */
export async function kommuneplanruter(tc: Flis): Promise<Planruter> {
  const P = await bildePiksler(await katalog.bronse.planflis(tc), 512, 512);
  return { z: tc[0], cx0: tc[1] * 512, cy0: tc[2] * 512, w: 512, h: 512, plan: planIFlis(P) };
}

/* Hvor kommuneplanen ligger i kommunen, grovt: for hver piksel i oversiktsbildet (bronse.planoversikt) om noe av planen ligger der.
   x0 og y0 er den første flisen på nivå 9 bildet dekker, w og h bredden og høyden, og s piksler per flis på nivå 9. */
export interface Planoversikt {
  x0: number;
  y0: number;
  w: number;
  h: number;
  s: number;
  noe: Uint8Array;
}
/* Tabellen solv.planoversikt: hvor kommuneplanen ligger i kommunen nr. En piksel har noe når dekningen er over 0, så også en flate
   som bare dekker en liten bit av pikselen, er med. */
export async function planoversikt(nr: string): Promise<Planoversikt> {
  const [g, buf] = await Promise.all([katalog.solv.grense(nr), katalog.bronse.planoversikt(nr)]);
  const R = flisrammen(g.ext, PLANOVERSIKT_NIVA),
    s = 512 / PLANOVERSIKT,
    w = R.nx * s,
    h = R.ny * s,
    P = await bildePiksler(buf, w, h),
    noe = new Uint8Array(w * h);
  for (let q = 0; q < noe.length; q++) if (P[4 * q + 3] > 0) noe[q] = 1;
  return { x0: R.x0, y0: R.y0, w, h, s, noe };
}
/* Om flisen tc (nivå 9 eller 10) kan ha kommuneplan etter oversikten O: om en piksel i flisen, eller én piksel rundt den, har noe.
   Kanten på én piksel er med for sikkerhets skyld. En flis utenfor oversikten kan ha plan. */
export function kanHaPlan(O: Planoversikt, tc: Flis): boolean {
  const f = 2 ** (tc[0] - PLANOVERSIKT_NIVA),
    n = O.s / f,
    px = tc[1] * n - O.x0 * O.s,
    py = tc[2] * n - O.y0 * O.s;
  if (px < 0 || py < 0 || px + n > O.w || py + n > O.h) return true;
  for (let y = Math.max(0, py - 1); y < Math.min(O.h, py + n + 1); y++)
    for (let x = Math.max(0, px - 1); x < Math.min(O.w, px + n + 1); x++) if (O.noe[y * O.w + x]) return true;
  return false;
}

/* Har kommunen kommuneplan hos DiBK? P er et lite bilde av planlaget over kommunen og M kommunens flate, begge som piksler (RGBA) i
   samme rutenett. Gir hvor stor del av kommunen planlaget dekker, om det regnes som at kommunen har plan, og rutene med plan (til
   oppslag om hvilken plan det er). Langs grensen stikker naboenes planer litt inn, så en liten dekning betyr at kommunen ikke har
   plan der (se PLAN_FINNES). */
export function planDekning(P: Piksler, M: Piksler) {
  const treff: number[] = [];
  let inne = 0;
  for (let q = 0; q < M.length / 4; q++)
    if (M[4 * q + 3] >= HALV) {
      inne++;
      if (P[4 * q + 3] >= SYNLIG) treff.push(q);
    }
  const dekning = inne ? treff.length / inne : 0;
  return { dekning, finnes: dekning >= PLAN_FINNES, treff };
}

/* Kommuneplanen DiBK har: plan-id, hvem som har levert den, og datoen den ble kopiert til DiBK som [år, måned, dag] */
export interface Planopplysninger {
  id: string;
  vert: string;
  kopiert: string[] | null;
}
/* Tabellen solv.plandekning: hvor stor del av kommunen planlaget dekker, om det regnes som at kommunen har plan, og rutene med plan,
   i rutenettet bildet er hentet i (u, w, h) */
export async function plandekning(
  nr: string
): Promise<ReturnType<typeof planDekning> & { u: Utsnitt; w: number; h: number }> {
  const g = await katalog.solv.grense(nr),
    R = rutenett(g.ext, ...BILDE_PLANDEKNING);
  const D = planDekning(await bildePiksler(await katalog.bronse.plandekning(nr), R.w, R.h), flatePiksler(g.koord, R));
  return { ...D, u: R.u, w: R.w, h: R.h };
}
/* Tabellen solv.planinfo: om DiBK har kommuneplanen, hvor stor del av kommunen den dekker, og hvilken plan det er */
export interface Planinfo {
  finnes: boolean;
  dekning: number;
  plan: Planopplysninger | null;
}
export async function planinfo(nr: string): Promise<Planinfo> {
  const { finnes, dekning } = await katalog.solv.plandekning(nr),
    plan = finnes ? await katalog.bronse.planopplysninger(nr).catch(() => null) : null;
  return { finnes, dekning, plan };
}
