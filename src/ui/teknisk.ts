/* Det siden gjør tilgjengelig som window.motor når teknisk visning er slått på (?teknisk): tilstanden i datamotoren og i
   visningen, temaene, katalogen (kall den, som katalog.gull.inon('5001')), oppslag for valgt kommune, innholdet i cachen og kartet.
   Til feilsøking i nettleseren og til regresjonstesten, som leser tallene herfra (verktoy/motortall.ts). Settes i App.tsx. */
import type OlMap from 'ol/Map.js';
import type { innhold } from '../data/cache.ts';
import type { TEMATABELLER, katalog } from '../data/katalog.ts';
import type { planrutenett, planTall } from '../data/motor/plan.ts';
import type { Tilstand } from '../data/motor/tilstand.ts';
import type { valgt, verdi } from '../data/motor/valgt.ts';
import type { Naturtema } from '../data/solv/temaer.ts';
import type { Visning } from './tilstand.ts';

export interface Motor {
  app: Tilstand;
  ui: Visning;
  NATURTEMA: Naturtema[];
  katalog: typeof katalog;
  TEMATABELLER: typeof TEMATABELLER;
  valgt: typeof valgt;
  verdi: typeof verdi;
  planTall: typeof planTall;
  planrutenett: typeof planrutenett;
  innhold: typeof innhold;
  readonly kart: OlMap | null;
}
declare global {
  interface Window {
    motor?: Motor;
  }
}
