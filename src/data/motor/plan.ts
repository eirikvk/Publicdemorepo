/* Datamotoren, planlagt utbygging: det siden og kartet trenger å vite om utbyggingen for valgt kommune. Selve utbyggingen regnes ut
   i gull (gull/utbygging.ts, tabellen gull.utbygging). Datamotoren bestemmer bare når den er utdatert: når egne områder endres
   (egne.ts). Kartlaget for planen ligger i ui/kart/plan.ts. */
import { se } from '../cache.ts';
import { katalog } from '../katalog.ts';
import { utenPlan } from './egne.ts';
import { hentingAvKlasser } from './grunnkart.ts';
import { valgt, valgtNr } from './valgt.ts';

/* Kommunen har ingen kommuneplan hos DiBK */
export function ingenPlan() {
  const nr = valgtNr(),
    r = nr ? se(katalog.solv.planinfo, nr) : null;
  return !!r && r.status === 'ok' && !r.verdi!.finnes;
}
/* Utbyggingen for valgt kommune: den siste som er regnet ut, også mens den regnes ut på nytt. null når den ikke finnes. */
export function utbyggingen() {
  const r = valgt(katalog.gull.utbygging);
  return r && r.verdi ? r.verdi : null;
}
/* Hvor langt utregningen av planlagt utbygging er kommet: tom (ingenting å regne på), henter (blokkene med dagens klasser hentes fra
   NIBIO, se hentingAvKlasser), regner, feil eller ok */
export function planTall(): 'tom' | 'henter' | 'regner' | 'feil' | 'ok' {
  const nr = valgtNr(),
    g = nr ? se(katalog.solv.grense, nr) : null;
  if (!nr || !g || g.status !== 'ok' || utenPlan()) return 'tom';
  const r = valgt(katalog.gull.utbygging);
  if (r && r.verdi) return 'ok';
  if (r && r.status === 'feil') return 'feil';
  if (r && r.status === 'ok' && !r.underveis) return 'tom'; /* regnet ut, og ingenting å vise */
  if (hentingAvKlasser()) return 'henter';
  return 'regner';
}
