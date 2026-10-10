/* Datamotoren, egne områder: tegnede områder og opplastede planer. Hvilke flater som er utbygging og hvordan de legges inn i
   planrutenettet, står i solv/egne.ts, og radene i sammenligningen med kommuneplanen bygges i gull/egne.ts (se egneRader i
   gulldata.ts). Selve tegningen i kartet ligger i ui/kart/egne.ts. Egne områder er valg brukeren har gjort, og ligger i app.egne.
   De finnes bare så lenge siden er åpen, og hører til kommunen de ble tegnet i. */
import { lesPlanfil } from '../bronse/planfil.ts';
import { areal, utsnitt, type Flerflate } from '../generelt/geometri.ts';
import { EGET_MIN_M2, arealKm2 } from '../solv/felles.ts';
import { planflater, type Type } from '../solv/egne.ts';
import { tilUTM } from '../solv/projeksjoner.ts';
import { se } from './katalog.ts';
import { GRENSE } from './datasett.ts';
import { finn, velgKommune } from './kommune.ts';
import { ingenPlan, regnAlt } from './plan.ts';
import { app, endret, type EgetOmrade, type EgneStatus } from './tilstand.ts';

let egenTeller = 0;
/* De egne områdene i valgt kommune */
export const mine = () => app.egne.filter(g => !!app.valgt && g.nr === app.valgt.nr);
/* Uten kommuneplan og uten egne områder finnes det ingen planlagt utbygging å regne på */
export const utenPlan = () => ingenPlan() && !mine().length;

function egneEndret() {
  endret();
  regnAlt();
}

/* Et område tegnet i kartet. koord er flerflaten i UTM33. */
export function leggTilEget(koord: Flerflate) {
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
    km2: arealKm2(koord, ext)
  });
  egneEndret();
}

/* Opplastet plan: filen leses i bronse/planfil.ts, og hvilke flater som regnes som utbygging, står i planType i solv/egne.ts.
   Innenfor flatene erstatter filen kommuneplanen. Filen leses i nettleseren og sendes ingen steder. Hvordan det går, står i
   app.egneStatus: { hva, fil, ... }, der hva er forStor, leser, lest, eller hva som var galt. Siden skriver meldingen. */
export async function lastOppPlan(fil: File | null | undefined) {
  const melding = (hva: EgneStatus['hva'], mer?: Pick<EgneStatus, 'antall' | 'byttetTil'>) => {
    app.egneStatus = { hva, fil: fil && fil.name, ...mer };
    endret();
  };
  try {
    if (!fil) return;
    if (fil.size > 120e6) return melding('forStor');
    melding('leser');
    await new Promise(ok => setTimeout(ok, 30));
    const midtAv = (nr: string) => {
      const k = finn(nr)![1],
        g = app.valgt && app.valgt.nr === nr ? se(GRENSE, nr) : null,
        e = g && g.status === 'ok' ? g.verdi!.ext : null;
      return e
        ? [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2]
        : k.boks
          ? tilUTM('EPSG:4326')([(k.boks[0] + k.boks[2]) / 2, (k.boks[1] + k.boks[3]) / 2])
          : null;
    };
    const P = lesPlanfil(JSON.parse(await fil.text()), app.valgt ? app.valgt.nr : null, nr => !!finn(nr), midtAv);
    if (P.feil) return melding(P.feil);
    const { nr, funnet, ...resten } = P,
      plan = { ...resten, ...planflater(P.deler, !P.utenFormal) },
      k = finn(nr)![1];
    app.egne.push({
      id: ++egenTeller,
      nr,
      navn: fil.name.replace(/\.(geo)?json$/i, ''),
      kilde: 'fil',
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
export function settType(g: EgetOmrade, type: Type) {
  if (g.deler[0].type === type) return;
  g.deler[0].type = type;
  egneEndret();
}
export function slettEget(g: EgetOmrade) {
  app.egne.splice(app.egne.indexOf(g), 1);
  egneEndret();
}
