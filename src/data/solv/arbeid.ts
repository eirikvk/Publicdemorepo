/* Sølv, bakgrunnstråden: det tunge bildearbeidet (oppgaver.ts) kjøres i egne tråder i nettleseren (Web Worker, arbeider.ts), så
   siden ikke henger mens det regnes. Trådene startes første gang det trengs, høyst tre. Har ikke nettleseren tråder med lerret
   (OffscreenCanvas), eller kan de ikke startes, kjøres oppgavene på siden i stedet, med de samme funksjonene. */
import type { Oppgave } from './oppgaver.ts';
import { hentFlate } from './raster.ts';

/* Trådene, oppgavene som venter på svar, og om trådene har feilet */
const ARBEID = {
  traader: [] as Worker[],
  neste: 0,
  id: 0,
  brutt: false,
  venter: new Map<number, { ok: (v: unknown) => void; feil: (f: Error) => void }>()
};
const kanBruke = () => !ARBEID.brutt && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

function start() {
  const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
  for (let i = 0; i < n; i++) {
    const t = new Worker(new URL('./arbeider.ts', import.meta.url), { type: 'module' });
    t.onmessage = (e: MessageEvent<{ id: number; svar?: unknown; feil?: string }>) => {
      const v = ARBEID.venter.get(e.data.id);
      if (!v) return;
      ARBEID.venter.delete(e.data.id);
      if (e.data.feil !== undefined) v.feil(new Error(e.data.feil));
      else v.ok(e.data.svar);
    };
    t.onerror = () => {
      /* tråden kunne ikke startes: alt som venter, og alt som kommer, kjøres på siden */
      ARBEID.brutt = true;
      for (const [, v] of ARBEID.venter) v.feil(new Error('bakgrunnstråden kunne ikke startes'));
      ARBEID.venter.clear();
      for (const x of ARBEID.traader) x.terminate();
      ARBEID.traader = [];
    };
    ARBEID.traader.push(t);
  }
}
function iTraad(o: Oppgave): Promise<unknown> {
  if (!ARBEID.traader.length) start();
  return new Promise((ok, feil) => {
    const id = ++ARBEID.id;
    ARBEID.venter.set(id, { ok, feil });
    ARBEID.traader[ARBEID.neste++ % ARBEID.traader.length].postMessage({ id, o });
  });
}

/* Utfører oppgaven o i en bakgrunnstråd, eller på siden når det ikke går */
export async function arbeid<T>(o: Oppgave): Promise<T> {
  if (kanBruke())
    try {
      return (await iTraad(o)) as T;
    } catch (f) {
      if (!ARBEID.brutt) throw f;
    }
  const { utfor } = await import('./oppgaver.ts');
  return (await utfor(o, hentFlate)).svar as T;
}
