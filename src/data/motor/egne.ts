/* Datamotoren, egne områder: tegnede områder og opplastede planer. Egne områder er valg brukeren har gjort, og ligger i app.egne. De
   finnes bare så lenge siden er åpen, og hører til kommunen de ble tegnet i. De er også en kilde: datamotoren legger dem slik brukeren
   laget dem i bronse.egne (oppdaterEgne). Hvilke flater som er utbygging, står i solv/egne.ts (solv.egne), hvordan de legges inn i
   utbyggingen i gull/utbygging.ts, og radene i sammenligningen med kommuneplanen i gull/egne.ts (gull.egneRader). Selve tegningen i
   kartet ligger i ui/kart/egne.ts. */
import { lesPlanfil } from '../bronse/planfil.ts';
import { areal, utsnitt, type Flerflate } from '../generelt/geometri.ts';
import { EGET_MIN_M2, arealKm2 } from '../solv/felles.ts';
import { samletKm2, type Egetinn, type Type } from '../solv/egne.ts';
import { tilUTM } from '../solv/projeksjoner.ts';
import { brukerEndret, gjeldende, legg, se, type Tabell } from '../cache.ts';
import { katalog } from '../katalog.ts';
import { finn, velgKommune } from './kommune.ts';
import { ingenPlan, utbyggingen } from './plan.ts';
import { app, endret, type EgetOmrade, type EgneStatus } from './tilstand.ts';

let egenTeller = 0;
/* De egne områdene i valgt kommune */
export const mine = () => app.egne.filter(g => !!app.valgt && g.nr === app.valgt.nr);
/* Uten kommuneplan og uten egne områder finnes det ingen planlagt utbygging å regne på */
export const utenPlan = () => ingenPlan() && !mine().length;

/* Egne områder er en kilde fra brukeren: de legges slik brukeren laget dem i bronse.egne for kommunen nr. Har de endret seg, sier
   datamotoren fra (brukerEndret), så solv.egne, utbyggingen og alt som bygger på den, regnes ut på nytt. Flatene i tegnede områder
   kopieres, så det som ligger i cachen, ikke endres når brukeren bytter type. En opplastet plan endres ikke. */
const merke = (B: Egetinn[]) =>
  B.map(g => g.id + (g.kilde === 'tegnet' ? ':' + g.deler.map(d => d.type).join() : '')).join(';');
export function oppdaterEgne(nr: string) {
  const ny = app.egne
      .filter(g => g.nr === nr)
      .map((g): Egetinn =>
        g.kilde === 'tegnet'
          ? { id: g.id, ext: g.ext, kilde: g.kilde, deler: g.deler.map(d => ({ ...d })) }
          : {
              id: g.id,
              ext: g.ext,
              kilde: g.kilde,
              deler: g.deler,
              harFormal: g.harFormal,
              planid: g.planid,
              proj: g.proj
            }
      ),
    har = se(katalog.bronse.egne, nr),
    fra = har && har.status === 'ok' ? har.verdi! : [];
  if (har && merke(fra) === merke(ny)) return;
  if (!fra.length && ny.length) kommuneplanAlene(nr);
  legg(katalog.bronse.egne, nr, ny);
  if (merke(fra) !== merke(ny)) brukerEndret(nr);
}
/* Uten egne områder er kommuneplanen alene den samme som planen. Når det første egne området kommer i kommunen nr, legges svarene som
   alt er regnet ut for planen, inn som svarene for kommuneplanen alene (nøkkelen nr/gammel) i tabellene der den ikke endres av egne
   områder (gammelFast i katalogen), så de ikke regnes ut på nytt. */
function kommuneplanAlene(nr: string) {
  for (const t of Object.values(katalog.gull) as Tabell<string, unknown>[]) {
    if (!t.gammelFast) continue;
    const v = gjeldende(t, nr);
    if (v !== null && !se(t, nr + '/gammel')) legg(t, nr + '/gammel', v);
  }
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
    const { nr, funnet } = P,
      k = finn(nr)![1];
    app.egne.push({
      id: ++egenTeller,
      nr,
      navn: fil.name.replace(/\.(geo)?json$/i, ''),
      kilde: 'fil',
      deler: P.deler,
      harFormal: !P.utenFormal,
      ext: P.ext,
      km2: samletKm2(P.deler),
      planid: P.planid,
      proj: P.proj
    });
    melding('lest', {
      antall: P.deler.length,
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
  if (g.kilde !== 'tegnet' || g.deler[0].type === type) return;
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
