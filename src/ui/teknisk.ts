/* Det siden gjør tilgjengelig som window.motor når teknisk visning er slått på (?teknisk): tilstanden i datamotoren og i
   visningen, temaene, gull-dataene for valgt kommune (data), innholdet i katalogen og kartet. Til feilsøking i nettleseren og til
   regresjonstesten, som leser tallene herfra (verktoy/motortall.ts). Settes i App.tsx. */
import type OlMap from 'ol/Map.js';
import type * as Gulldata from '../data/motor/gulldata.ts';
import type { innhold } from '../data/motor/katalog.ts';
import type { Naturtema } from '../data/motor/naturtema.ts';
import type { Tilstand } from '../data/motor/tilstand.ts';
import type { Visning } from './tilstand.ts';

export interface Motor {
  app: Tilstand;
  ui: Visning;
  NATURTEMA: Naturtema[];
  data: typeof Gulldata;
  katalog: typeof innhold;
  readonly kart: OlMap | null;
}
declare global {
  interface Window {
    motor?: Motor;
  }
}
