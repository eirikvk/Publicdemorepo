/* Datamotoren, egne områder: tegnede områder og opplastede planer, og det radene i sammenligningen med kommuneplanen bygges av.
   Hvilke flater som er utbygging og hvordan de legges inn i planrutenettet, står i solv/egne.js, og radene bygges i gull/egne.js.
   Selve tegningen i kartet ligger i ui/kart/egne.js. Egne områder ligger i app.egne. De finnes bare så lenge siden er åpen, og
   hører til kommunen de ble tegnet i. */
import { lesPlanfil } from '../bronse/planfil.js';
import { EGET_MIN_M2, areal, arealKm2, utsnitt } from '../solv/felles.js';
import { planflater } from '../solv/egne.js';
import { tilUTM } from '../solv/projeksjoner.js';
import { byggEgneRader } from '../gull/egne.js';
import { finn, velgKommune } from './kommune.js';
import { NATURTEMA } from './naturtema.js';
import { ingenPlan, regnAlt } from './plan.js';
import { app, endret } from './tilstand.js';

let egenTeller = 0;
export const mine = () => (app.valgt ? app.egne.filter(g => g.nr === app.valgt.nr) : []);
/* Uten kommuneplan og uten egne områder finnes det ingen planlagt utbygging å regne på */
export const utenPlan = () => ingenPlan() && !mine().length;

function egneEndret() {
  endret();
  regnAlt();
}

/* Et område tegnet i kartet. koord er flerflaten i UTM33. */
export function leggTilEget(koord) {
  if (!app.valgt) return;
  if (!(areal(koord) > EGET_MIN_M2)) {
    app.egneStatus = { hva: 'forLite' };
    endret();
    return;
  }
  app.egneStatus = null;
  const lopenr = mine().reduce((m, x) => Math.max(m, x.lopenr || 0), 0) + 1,
    ext = utsnitt(koord);
  app.egne.push({
    id: ++egenTeller,
    nr: app.valgt.nr,
    lopenr,
    navn: `Eget område ${lopenr}`,
    kilde: 'tegnet',
    deler: [{ koord, type: 'bygg', ext }],
    ext,
    km2: arealKm2(koord, ext),
    tall: null
  });
  egneEndret();
}

/* Opplastet plan: filen leses i bronse/planfil.js, og hvilke flater som regnes som utbygging, står i planType i solv/egne.js.
   Innenfor flatene erstatter filen kommuneplanen. Filen leses i nettleseren og sendes ingen steder. Hvordan det går, står i
   app.egneStatus: { hva, fil, ... }, der hva er forStor, leser, lest, eller hva som var galt. Siden skriver meldingen. */
export async function lastOppPlan(fil) {
  const melding = (hva, mer) => {
    app.egneStatus = { hva, fil: fil && fil.name, ...mer };
    endret();
  };
  try {
    if (!fil) return;
    if (fil.size > 120e6) return melding('forStor');
    melding('leser');
    await new Promise(ok => setTimeout(ok, 30));
    const midtAv = nr => {
      const k = finn(nr)[1];
      return app.valgt && app.valgt.nr === nr && app.grense
        ? [(app.grense.ext[0] + app.grense.ext[2]) / 2, (app.grense.ext[1] + app.grense.ext[3]) / 2]
        : k.boks
          ? tilUTM('EPSG:4326')([(k.boks[0] + k.boks[2]) / 2, (k.boks[1] + k.boks[3]) / 2])
          : null;
    };
    const P = lesPlanfil(JSON.parse(await fil.text()), app.valgt ? app.valgt.nr : null, nr => !!finn(nr), midtAv);
    if (P.feil) return melding(P.feil);
    const { nr, funnet, ...resten } = P,
      plan = { ...resten, ...planflater(P.deler, !P.utenFormal) },
      k = finn(nr)[1];
    app.egne.push({
      id: ++egenTeller,
      nr,
      navn: fil.name.replace(/\.(geo)?json$/i, ''),
      kilde: 'fil',
      tall: null,
      ...plan
    });
    melding('lest', {
      antall: plan.deler.length,
      byttetTil: funnet && (!app.valgt || app.valgt.nr !== nr) ? k.navn : null
    });
    if (!app.valgt || app.valgt.nr !== nr) velgKommune(nr);
    else egneEndret();
  } catch (e) {
    melding('ikkeGeoJSON');
  }
}

/* Et tegnet område byttes mellom utbygging og ikke utbygging. */
export function settType(g, type) {
  if (g.deler[0].type === type) return;
  g.deler[0].type = type;
  egneEndret();
}
export function slettEget(g) {
  app.egne.splice(app.egne.indexOf(g), 1);
  egneEndret();
}

/* Radene i sammenligningen mellom kommuneplanen og egne områder, for hele kommunen eller ett område. Radene bygges av byggEgneRader i
   gull/egne.js: natur og jordbruk som går med, og hvor mye av det som ligger i grått areal, verneområder, villreinområder,
   verdsatt natur per verdi og natur som ikke er kartlagt. Hver rad viser kommuneplanen alene, tallet med egne områder og endringen. */
export function egneRader(e) {
  /* finner det radene bygges av i tilstanden. e: null for hele kommunen, ellers nummeret i listen over egne områder */
  const R = app.planRaster,
    GK =
      app.graaKryss && app.valgt && app.graaKryss.nr === app.valgt.nr && app.graaKryss.antallEgne === R.antallEgne
        ? app.graaKryss
        : null;
  const data = t => (t.data && app.valgt && t.data.nr === app.valgt.nr ? t.data : null);
  const tema = NATURTEMA.filter(t => {
    const D = data(t);
    return D && D.kryss && D.kryss.P && D.omrader.length;
  }).map(t => ({
    navn: t.navn,
    id: t.id,
    klasser: t.klasser,
    kryss: t.data.kryss
  }));
  const V = NATURTEMA.find(t => t.dekning),
    DV = V ? data(V) : null;
  return byggEgneRader(e, e === null ? null : mine()[e].tall, R, !ingenPlan(), GK, tema, DV ? DV.gap : null);
}
