/* Sølv for kommuneplanen fra DiBK: planlagt utbygging per rute i en flis, og om kommunen har kommuneplan hos DiBK og hvilken.
   Bare kommuneplanen: den legges oppå dagens klasser og egne områder i gull (gull/utbygging.ts). */
import type { Utsnitt } from '../generelt/geometri.ts';
import { katalog } from '../katalog.ts';
import { BILDE_PLANDEKNING, HALV, PLAN_FINNES, SYNLIG, rutenett, type Piksler } from './felles.ts';
import { bildePiksler, flatePiksler } from './raster.ts';

/* Planlagt utbygging per rute i en flis, fra kartbildet P fra DiBK (piksler): 1 der minst halve ruta ligger i en planflate
   (halvregelen), ellers 0 */
export function planIFlis(P: Piksler): Uint8Array {
  const pl = new Uint8Array(P.length / 4);
  for (let i = 3, q = 0; i < P.length; i += 4, q++) if (P[i] >= HALV) pl[q] = 1;
  return pl;
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
