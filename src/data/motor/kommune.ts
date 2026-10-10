/* Datamotoren, kommunen: listen over kommuner, valg av kommune, og alt som hentes og regnes ut når en kommune velges. Grensen
   hentes først, fordi temaene, planen og bildene av hele kommunen klippes mot den. */
import { hentKommunegrense, hentKommuneliste } from '../bronse/kartverket.ts';
import { hentOversiktsregister } from '../bronse/nibio-grunnkart.ts';
import { arealKm2, flerflate, utsnitt, type Fylke, type Kommune } from '../solv/felles.ts';
import { hentOversikt, nySamling, stoppRegning } from './grunnkart.ts';
import { sjekkGraa } from './graa.ts';
import { sjekkInon } from './inon.ts';
import { NATURTEMA, hentNatur } from './naturtema.ts';
import { regnAlt, sjekkPlan } from './plan.ts';
import { hentHistorie, hentTall, nullstillTall } from './tall.ts';
import { app, endret, nyttValg, valgNr } from './tilstand.ts';

/* Listen over fylker og kommuner, og registeret over lagrede oversiktsbilder. Kalles én gang når siden åpnes. */
export async function hentKommuner() {
  try {
    const liste = await hentKommuneliste();
    const reg = await hentOversiktsregister().catch(() => null);
    if (reg && reg.kommuner) {
      app.oversikter = reg.kommuner;
      app.oversiktInfo = { versjon: reg.versjon, hentet: reg.hentet };
    }
    app.fylker = liste.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
    app.fylker.forEach(f => f.kommuner.sort((a, b) => a.navn.localeCompare(b.navn, 'nb')));
    endret();
    return true;
  } catch (e) {
    app.listeFeil = true;
    endret();
    return false;
  }
}

export const finn = (nr: string): [Fylke, Kommune] | null => {
  for (const f of app.fylker) for (const k of f.kommuner) if (k.nr === nr) return [f, k];
  return null;
};

/* Grensen er hentet: temaene, planen og bildene av hele kommunen hentes og regnes ut. */
async function hentGrense(k: Kommune, mitt: number) {
  try {
    const omrade = await hentKommunegrense(k);
    if (mitt !== valgNr) return;
    const koord = flerflate(omrade),
      ext = utsnitt(koord);
    app.grense = { nr: k.nr, koord, ext };
    app.flate = arealKm2(koord, ext); /* flaten i km², rettet for målestokken i UTM */
    endret();
    regnAlt();
    sjekkPlan(k, app.grense, mitt);
    sjekkInon(k, app.grense, mitt);
    sjekkGraa(k, app.grense, mitt);
    NATURTEMA.forEach(t => hentNatur(t, k, app.grense!, mitt));
    if (!app.oversikter[k.nr]) nySamling(k.nr, ext);
  } catch (e) {
    if (mitt === valgNr) {
      app.grenseFeil = true;
      endret();
    }
  }
}

/* Velger kommunen nr: det som gjaldt forrige kommune, nullstilles, og alt for den nye hentes. */
export function velgKommune(nr: string) {
  const t = finn(nr);
  if (!t) return;
  const [, k] = t,
    mitt = nyttValg();
  app.valgt = k;
  nullstillTall('henter');
  app.grense = null;
  app.grenseFeil = false;
  app.flate = 0;
  app.planRaster = null;
  app.historie = null;
  app.planSum = null;
  stoppRegning();
  app.planInfo = null;
  app.inon = null;
  app.graa = null;
  app.graaKryss = null;
  NATURTEMA.forEach(t => {
    t.data = null;
  });
  regnAlt();
  endret();
  hentOversikt(k, mitt);
  hentTall(k, mitt);
  hentHistorie(k, mitt);
  hentGrense(k, mitt);
}
/* Første kommune i et fylke, når fylket byttes */
export const velgFylke = (nr: string) => {
  const f = app.fylker.find(x => x.nr === nr);
  if (f) velgKommune(f.kommuner[0].nr);
};
