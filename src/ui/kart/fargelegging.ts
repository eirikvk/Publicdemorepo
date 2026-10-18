/* Fargelegging av dagens klasser i kartfargene: fargen per klasse (klassefarger), som kartet zoomet inn tegner hver piksel i, og
   fargen for en blandet farge i bildet zoomet ut (tilFarge). Stilen som sendes til NIBIO, ligger i data/bronse/nibio-grunnkart.ts,
   og tolkingen av fargene til klasser i data/solv/klasser.ts. */
import { ALLE, BLANDING, fargeNr } from '../../data/solv/klasser.ts';
import { rgb } from '../farger.ts';
/* Kartfargene per klasse, i rekkefølgen i ALLE */
export const klassefarger = () => ALLE.map(([id]) => rgb(id));
/* Fargen i kartet for fargen (r, g, b, a) i bildet zoomet ut: den tolkes som en blanding av to klasser (BLANDING i solv/klasser.ts) og
   får en tilsvarende blanding av kartfargene F */
export function tilFarge(r: number, g: number, b: number, a: number, F: number[][]): number[] {
  if (!a) return [0, 0, 0, 0];
  const q = fargeNr(r, g, b),
    A = F[BLANDING.A[q]],
    B = F[BLANDING.B[q]],
    t = BLANDING.T[q] / 255,
    va = A ? t * (A[3] || 1) : 0,
    vb = B ? (1 - t) * (B[3] || 1) : 0,
    syn = va + vb;
  if (!(syn > 0)) return [0, 0, 0, 0];
  const f = [0, 0, 0, Math.round(a * syn)];
  for (let k = 0; k < 3; k++) f[k] = Math.round(((A ? A[k] * va : 0) + (B ? B[k] * vb : 0)) / syn);
  return f;
}
