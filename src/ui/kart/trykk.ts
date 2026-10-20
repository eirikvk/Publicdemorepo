/* Trykk i kartet: hva som er i punktet, og kartet som kommunevelger. Kartet kobler trykkIKartet og plasserBytt til hendelsene sine,
   og siden gir elementet for knappen med settByttKnapp (Kartpanel.tsx). */
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import type Overlay from 'ol/Overlay.js';
import type { Coordinate } from 'ol/coordinate.js';
import { ol } from './ol.ts';
import { se, type Tabelldef } from '../../data/cache.ts';
import { katalog } from '../../data/katalog.ts';
import { STYRKER } from '../../data/gull/planflis.ts';
import { ALLE } from '../../data/solv/klasser.ts';
import { graaIFlis, klasserIFlis, planIFlis, soneIFlis, verdiIPunkt } from '../../data/motor/kartverdier.ts';
import { finn, velgKommune } from '../../data/motor/kommune.ts';
import { app, endret } from '../../data/motor/tilstand.ts';
import { ui, type Probe, type Punktinfo } from '../tilstand.ts';
import { tegner } from './egne.ts';
import { plannett } from './felles.ts';
import { kart, opplosning } from './kart.ts';
import { utenforKommunen } from './klipping.ts';
import { navnVed } from './naturtema.ts';
import { planLag } from './plan.ts';
import { kjenteFlater, punktinfo } from './punktinfo.ts';

/* Kartet som kommunevelger: et trykk utenfor valgt kommune slår opp kommunen i punktet hos Kartverket og viser en knapp
   rett over punktet, med en prikk der man trykket. Byttet skjer først når man trykker på knappen, så et bomtrykk ved grensen ikke bytter kommune.
   Knappen holdes innenfor kartflaten og unna zoomknappene, og følger punktet når kartet flyttes. Knappen er en del av siden
   (Kartpanel.tsx), som gir kartet elementet med settByttKnapp. */
let byttLag: Overlay | null = null,
  byttEl: HTMLElement | null = null,
  byttSok = 0,
  byttKoord: Coordinate | null = null;
export const settByttKnapp = (el: HTMLElement | null) => {
  byttEl = el;
};
export const lukkBytt = () => {
  byttSok++;
  byttKoord = null;
  if (byttLag) byttLag.setPosition(undefined);
  if (ui.bytt) {
    ui.bytt = null;
    endret();
  }
};
export function plasserBytt() {
  if (!ui.bytt || !byttKoord || !byttEl || !kart) return;
  const px = kart.getPixelFromCoordinate(byttKoord),
    [w, h] = kart.getSize()!,
    bw = byttEl.offsetWidth,
    bh = byttEl.offsetHeight;
  if (!px || px[0] < -20 || px[1] < -20 || px[0] > w + 20 || px[1] > h + 20) {
    lukkBytt();
    return;
  } /* punktet er flyttet ut av kartet */
  const x = Math.max(8, Math.min(w - bw - 8, px[0] - bw / 2));
  let y = px[1] - bh - 16;
  if (y < 8 || (y < 116 && x + bw > w - 62))
    y = px[1] + 16; /* under punktet hvis det ikke er plass over, eller zoomknappene er i veien */
  byttEl.style.left = x + 'px';
  byttEl.style.top = Math.max(8, Math.min(h - bh - 8, y)) + 'px';
}
export function byttTilValgt() {
  const nr = ui.bytt && ui.bytt.nr;
  lukkBytt();
  if (nr) velgKommune(nr); /* som et valg i listen: kartet flytter seg til kommunen */
}
const settProbe = (probe: Probe) => {
  ui.probe = probe;
  endret();
};
async function finnKommune(koord: Coordinate) {
  lukkBytt();
  const mitt = byttSok;
  settProbe({ tekst: 'Slår opp kommunen …' });
  try {
    const j = await katalog.bronse.kommuneIPunkt(koord);
    if (mitt !== byttSok) return;
    const t = finn(j.kommunenummer);
    if (!t || (app.valgt && t[1].nr === app.valgt.nr)) throw new Error('ingen annen kommune');
    byttKoord = koord;
    byttLag!.setPosition(koord);
    ui.bytt = { nr: t[1].nr, navn: t[1].navn };
    settProbe({ punkt: `${t[1].navn} kommune` }); /* knappen plasseres når siden har tegnet den, se Kartpanel.tsx */
  } catch (e) {
    if (mitt === byttSok) settProbe({ tekst: 'Fant ingen annen kommune her.' });
  }
}
/* Om temaet t er talt for valgt kommune, uten å hente noe */
const talt = <V>(t: Tabelldef<string, V>) => {
  const r = app.valgt ? se(t, app.valgt.nr) : null;
  return !!r && r.status === 'ok';
};
/* Trykk på kartet: klassen i punktet, og om det er planlagt utbygging der, fra datamotoren på nivået kartet viser (verdiIPunkt), så
   svaret er det samme som kartlagene viser. Det samme for grått areal og inngrepsfri natur, når temaet er talt for kommunen. Setningen
   under kartet sier det viktigste, og detaljene (punktinfo.ts) alt kartet vet om punktet. Prikken viser hvilket punkt det gjelder. */
let trykkNr = 0;
export async function trykkIKartet(e: MapBrowserEvent) {
  if (tegner()) return; /* under tegning er trykk i kartet hjørner i området */
  const c = e.coordinate;
  if (utenforKommunen(c)) {
    glemPunkt();
    finnKommune(c);
    return;
  }
  lukkBytt();
  punktLag!.setPosition(c);
  const mitt = ++trykkNr,
    valgtNa = app.valgt,
    z = plannett.getZForResolution(opplosning()),
    iTema = navnVed(c),
    /* et oppslag som feiler, gir ingenting for det laget, men tar ikke de andre med seg */
    slaaOpp = (f: Parameters<typeof verdiIPunkt>[0]) => verdiIPunkt(f, c, z).catch(() => null);
  ui.punkt = null;
  settProbe({ tekst: 'Slår opp punktet …' });
  const planVises = planLag.getVisible() && planLag.getOpacity() > 0; /* tvillingen skjuler lag med gjennomsiktighet */
  const [kl, pv, graa, sone] = await Promise.all([
    slaaOpp(klasserIFlis),
    planVises ? slaaOpp(tc => planIFlis(tc, ui.visSmale)) : 0,
    talt(katalog.solv.graa) ? slaaOpp(graaIFlis) : null,
    talt(katalog.gull.inonAreal) ? slaaOpp(soneIFlis) : null
  ]);
  /* et nyere trykk, et trykk utenfor kommunen, en annen kommune eller tegning har tatt over */
  if (mitt !== trykkNr || app.valgt !== valgtNa || tegner()) return;
  const klasse = kl ? ALLE[kl - 1][1] : null,
    plan = pv ? (pv > STYRKER ? 'jordbruk' : 'natur') : null;
  ui.punkt = punktinfo(c, klasse, plan, graa, sone);
  settProbe(
    plan
      ? { punkt: 'Planlagt utbygging på ' + plan + iTema }
      : klasse
        ? { punkt: klasse + iTema }
        : { tekst: 'Ingen arealklasse her, eller kartet er ikke hentet ennå.' }
  );
}
/* Punktet og detaljene glemmes: ved trykk utenfor kommunen og når kommunen byttes */
export function glemPunkt() {
  trykkNr++; /* et oppslag som pågår, gjelder ikke lenger */
  if (punktLag) punktLag.setPosition(undefined);
  if (ui.punkt) {
    ui.punkt = null;
    endret();
  }
}

/* Prikken der man trykket, som følger punktet når kartet flyttes */
export function lagByttPrikk() {
  const prikk = document.createElement('div');
  prikk.className = 'punkt';
  byttLag = new ol.Overlay({ element: prikk, positioning: 'center-center', stopEvent: false });
  return byttLag;
}
/* Prikken for punktet man trykket på i kommunen */
let punktLag: Overlay | null = null;
export function lagPunktPrikk() {
  const prikk = document.createElement('div');
  prikk.className = 'punkt';
  punktLag = new ol.Overlay({ element: prikk, positioning: 'center-center', stopEvent: false });
  return punktLag;
}

/* Omrisset av flatene i punktet mens detaljene vises: egne områder, områdene i naturtemaene og flatene i kommuneplanen (se
   kjenteFlater i punktinfo.ts). Stiplet, så det skilles fra området som er valgt fra en liste. Tegnes på nytt når punktet endres,
   detaljene slås på eller av, eller DiBK svarer. */
const omrissKilde = new ol.source.Vector();
export const omrissLag = new ol.layer.Vector({
  className: 'omriss-punkt',
  source: omrissKilde,
  style: [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,.9)', width: 5 }) }),
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#171C1A', width: 2, lineDash: [6, 4] }) })
  ]
});
let omrissFor: [Punktinfo | null, unknown] = [null, null];
export function oppdaterOmriss() {
  const P = ui.detaljer ? ui.punkt : null,
    D = P ? se(katalog.solv.planIPunkt, P.koord) : null,
    dibk = D && D.verdi;
  if (P === omrissFor[0] && dibk === omrissFor[1]) return;
  omrissFor = [P, dibk];
  omrissKilde.clear();
  if (P) omrissKilde.addFeatures(kjenteFlater(P).map(f => new ol.Feature(new ol.geom.MultiPolygon(f))));
}
