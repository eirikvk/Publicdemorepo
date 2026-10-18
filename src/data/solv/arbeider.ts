/* Sølv, bakgrunnstråden selv (Web Worker): tar imot en oppgave fra siden (arbeid.ts), utfører den (oppgaver.ts) og sender svaret
   tilbake, uten å kopiere rutenettene. Tegneflatene er lerreter uten skjerm (OffscreenCanvas), én per størrelse, som brukes om
   igjen. */
import { utfor, type Oppgave } from './oppgaver.ts';
import { nullstill } from './raster.ts';

const FLATER: Record<string, OffscreenCanvasRenderingContext2D> = {};
const flate = (w: number, h: number) => {
  const n = `${w}x${h}`;
  let g = FLATER[n];
  if (!g) FLATER[n] = g = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
  else nullstill(g, w, h);
  return g;
};

const traad = self as unknown as Worker;
traad.onmessage = async (e: MessageEvent<{ id: number; o: Oppgave }>) => {
  const { id, o } = e.data;
  try {
    const { svar, overfor } = await utfor(o, flate);
    traad.postMessage({ id, svar }, overfor);
  } catch (f) {
    traad.postMessage({ id, feil: String(f) });
  }
};
