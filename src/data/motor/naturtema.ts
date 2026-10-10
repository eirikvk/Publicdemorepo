/* Datamotoren, naturtemaene fra Miljødirektoratet: verneområder, villrein og verdsatt natur. Hvert tema hentes når en kommune
   velges, og krysses med planrutenettet når det er regnet ut. Hvordan temaene hentes, står i bronse/mdir-naturtema.js, hvordan
   flatene gjøres om, i solv/temaer.js, og arealet og kryssingen regnes ut i gull/temaer.js. Kartlagene ligger i ui/kart/naturtema.js,
   og ordene sidene bruker om hvert tema, i ui/komponenter/Temaer.jsx.
   Et nytt tema av samme slag legges til i bronse, i EGENSKAPER i solv/temaer.js, som en ny linje i listen under, og med ord og
   kartlag i ui/. */
import { hentKartlagt, hentTemaflater } from '../bronse/mdir-naturtema.ts';
import { husk } from '../bronse/henting.ts';
import { utsnitt, type Kommune } from '../solv/felles.ts';
import {
  EGENSKAPER,
  byggDekning,
  klippNatur,
  lokaliteter,
  type Kartlagt,
  type Maske,
  type Omrade
} from '../solv/temaer.ts';
import {
  klasseAreal,
  kryssNatur,
  samletAreal,
  type HuskMaske,
  type TemaData,
  type TemaOmrade
} from '../gull/temaer.ts';
import { utenPlan } from './egne.ts';
import { app, endret, tidSlutt, valgNr, type Grense } from './tilstand.ts';

/* Det som er hentet og regnet ut for et tema i én kommune. Det huskes per kommune, så det ikke må hentes på nytt. ekstra er det
   kartlagte (undefined før det er bedt om, null mens det hentes), og inne arealet per verdikategori innenfor det kartlagte. */
export interface Pakke {
  omrader: TemaOmrade[];
  sum: number;
  klasser?: number[] | null;
  ufullstendig?: boolean;
  ekstra?: Kartlagt | null;
  inne?: number[];
}
/* Et naturtema, se listen under. data gjelder valgt kommune, og pakke er det som er husket for den. minne er pakkene per kommune. */
export interface Naturtema {
  id: string;
  navn: string;
  samlet?: boolean;
  dekning?: boolean;
  klasser?: [navn: string, farge: string][];
  data: (TemaData & { pakke?: Pakke }) | null;
  minne: Map<string, Pakke>;
}

/* Temaene. samlet: mange små lokaliteter, der arealet per verdikategori regnes samlet og bare de som berøres av planlagt utbygging,
   listes. dekning: temaet har et kart over hvor det er kartlagt. klasser: verdikategoriene, [navn, farge], høyest verdi først.
   data er det som er hentet og regnet ut for valgt kommune. */
export const NATURTEMA: Naturtema[] = (
  [
    { id: 'vern', navn: 'Verneområder' },
    { id: 'rein', navn: 'Villrein' },
    {
      id: 'verdi',
      navn: 'Verdsatt natur',
      samlet: true,
      dekning: true,
      klasser: [
        ['Svært stor verdi', 'verdi1'],
        ['Stor verdi', 'verdi2'],
        ['Middels verdi', 'verdi3'],
        ['Noe verdi', 'verdi4']
      ]
    }
  ] satisfies Omit<Naturtema, 'data' | 'minne'>[]
).map(t => ({ ...t, data: null, minne: new Map() }));

/* Kartleggingsgrad: hvor stor del av kommunen som er kartlagt etter Miljødirektoratets instruks. Uten den er «ingen registrert»
   lett å misforstå. */
async function hentDekning(k: Kommune, grense: Grense) {
  const j = await hentKartlagt(k, grense.ext);
  return byggDekning(j.features || [], grense);
}

export async function hentNatur(t: Naturtema, k: Kommune, grense: Grense, mitt: number) {
  t.data = null;
  endret();
  try {
    let pakke = t.minne.get(k.nr);
    if (!pakke) {
      const j = await hentTemaflater(t.id, t.navn, k);
      if (mitt !== valgNr) return;
      if (!j || !Array.isArray(j.features)) throw new Error('uventet svar');
      const med = (o: Omrade): TemaOmrade => ({ ...o, ext: utsnitt(o.koord) });
      if (t.samlet) {
        const alle = lokaliteter(j.features, grense, EGENSKAPER[t.id]),
          r = klasseAreal(alle, t.klasser ? t.klasser.length : 1, grense),
          omrader = alle.map(med);
        pakke = {
          omrader,
          sum: r.sum,
          klasser: t.klasser ? r.klasser : null,
          ufullstendig: !!j.exceededTransferLimit
        };
      } else {
        const omrader = klippNatur(j.features, grense, EGENSKAPER[t.id]).map(med);
        pakke = { omrader, sum: samletAreal(omrader) };
      }
      husk(t.minne, k.nr, pakke, 30);
    }
    t.data = { nr: k.nr, ...pakke, pakke };
    endret();
    if (t.dekning && pakke.ekstra === undefined) {
      pakke.ekstra = null;
      hentDekning(k, grense)
        .then(v => {
          if (t.klasser && v && v.flate && v.flate.length)
            try {
              pakke.inne = klasseAreal(pakke.omrader, t.klasser.length, grense, v.flate).klasser;
            } catch (e) {}
          pakke.ekstra = v;
          if (t.data && t.data.pakke === pakke) {
            t.data.ekstra = v;
            t.data.inne = pakke.inne;
            regnNatur(t);
          }
        })
        .catch(() => {});
    }
  } catch (e) {
    if (mitt !== valgNr) return;
    t.data = { nr: k.nr, feil: true, omrader: [], sum: 0 };
  }
  regnNatur(t);
}

/* Maskene til områdene og det kartlagte, til kryssingen. De lages første gang de trengs, og huskes så lenge området finnes. */
const masker = new WeakMap<object, Maske | null>();
const maske: HuskMaske = (nokkel, lag) =>
  masker.get(nokkel) || (masker.set(nokkel, lag()), masker.get(nokkel) as Maske | null);

/* Krysser temaet med planrutenettet hvis det er regnet ut, legger tallene i temaets data og sier fra. plan og smal er ruter med
   planlagt utbygging per område, i samme rekkefølge som områdene. */
export function regnNatur(t: Naturtema) {
  const D = t.data;
  if (!D || !app.valgt || D.nr !== app.valgt.nr) return endret();
  const R = app.planRaster && app.planRaster.nr === app.valgt.nr && !utenPlan() ? app.planRaster : null,
    t0 = performance.now();
  const r = R ? kryssNatur(D, R, t.klasser ? t.klasser.length : 1, !!t.dekning, app.grense!, maske) : null;
  D.plan = r ? r.plan : new Int32Array(D.omrader.length);
  D.smal = r ? r.smal : new Int32Array(D.omrader.length);
  D.regnet = !!R;
  D.kryss = r ? r.kryss : null;
  D.gap = r ? r.gap : null;
  endret();
  tidSlutt(t.navn.toLowerCase(), t0);
}
