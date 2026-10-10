/* Datamotoren, egne områder: tegnede områder og opplastede planer. Hvilke flater som er utbygging, står i solv/egne.ts, hvordan de
   legges inn i utbyggingen i gull/utbygging.ts, og radene i sammenligningen med kommuneplanen i gull/egne.ts (tabellen
   gull.egneRader). Selve tegningen i kartet ligger i ui/kart/egne.ts. Egne områder er valg brukeren har gjort, og ligger i app.egne.
   De finnes bare så lenge siden er åpen, og hører til kommunen de ble tegnet i. De er også en kilde for utbyggingen: datamotoren
   legger dem i solv.egne (oppdaterEgne). */
import { lesPlanfil } from '../bronse/planfil.ts';
import { areal, utsnitt, type Flerflate } from '../generelt/geometri.ts';
import { EGET_MIN_M2, arealKm2 } from '../solv/felles.ts';
import { planflater, type Egne, type Type } from '../solv/egne.ts';
import { tilUTM } from '../solv/projeksjoner.ts';
import { brukerEndret, legg, se } from '../cache.ts';
import { katalog } from '../katalog.ts';
import { finn, velgKommune } from './kommune.ts';
import { ingenPlan, utbyggingen } from './plan.ts';
import { app, endret, type EgetOmrade, type EgneStatus } from './tilstand.ts';

let egenTeller = 0;
/* De egne områdene i valgt kommune */
export const mine = () => app.egne.filter(g => !!app.valgt && g.nr === app.valgt.nr);
/* Uten kommuneplan og uten egne områder finnes det ingen planlagt utbygging å regne på */
export const utenPlan = () => ingenPlan() && !mine().length;

/* Egne områder er en kilde fra brukeren: de legges i solv.egne for kommunen nr. Har de endret seg, sier datamotoren fra
   (brukerEndret), så utbyggingen og alt som bygger på den, regnes ut på nytt. Flatene kopieres, så det som ligger i cachen, ikke
   endres etterpå. */
const merke = (E: Egne) => E.ider.join() + '|' + E.flater.map(f => f.deler.map(d => d.type).join()).join(';');
export function oppdaterEgne(nr: string) {
  const G = app.egne.filter(g => g.nr === nr),
    ny: Egne = { ider: G.map(g => g.id), flater: G.map(g => ({ ext: g.ext, deler: g.deler.map(d => ({ ...d })) })) },
    har = se(katalog.solv.egne, nr),
    fra = har && har.status === 'ok' ? har.verdi! : { ider: [], flater: [] };
  if (har && merke(fra) === merke(ny)) return;
  legg(katalog.solv.egne, nr, ny);
  if (merke(fra) !== merke(ny)) brukerEndret(nr);
}
function egneEndret() {
  if (app.valgt) oppdaterEgne(app.valgt.nr);
  endret();
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
        g = app.valgt && app.valgt.nr === nr ? se(katalog.solv.grense, nr) : null,
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

/* Utbyggingen når den er regnet ut med de egne områdene som finnes nå, ellers null */
export function egneRutenett() {
  const R = utbyggingen(),
    E = mine();
  return R && R.eget && R.egneIder.join() === E.map(g => g.id).join() ? R : null;
}
/* Hva som ligger i et eget område, i ruter fra utbyggingen. null til området er regnet med. */
export function egetTall(g: EgetOmrade) {
  const R = utbyggingen(),
    i = R ? R.egneIder.indexOf(g.id) : -1;
  return i < 0 ? null : R!.egneTall[i];
}
