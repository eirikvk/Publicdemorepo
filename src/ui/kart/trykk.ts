/* Trykk i kartet: hva som er i punktet, og kartet som kommunevelger. Kartet kobler trykkIKartet og plasserBytt til hendelsene sine,
   og siden gir elementet for knappen med settByttKnapp (Kartpanel.tsx). */
import type MapBrowserEvent from 'ol/MapBrowserEvent.js';
import type Overlay from 'ol/Overlay.js';
import type { Coordinate } from 'ol/coordinate.js';
import { ol } from './ol.ts';
import { katalog } from '../../data/katalog.ts';
import { naermesteFarge } from '../../data/generelt/farge.ts';
import { ALLE } from '../../data/solv/klasser.ts';
import { oversikt } from '../../data/motor/grunnkart.ts';
import { finn, velgKommune } from '../../data/motor/kommune.ts';
import { app, endret } from '../../data/motor/tilstand.ts';
import { rgb } from '../farger.ts';
import { ui, type Probe } from '../tilstand.ts';
import { tegner } from './egne.ts';
import { oversiktLag, tema } from './grunnkart.ts';
import { kart } from './kart.ts';
import { utenforKommunen } from './klipping.ts';
import { navnVed } from './naturtema.ts';
import { planLag } from './plan.ts';
import { punktinfo } from './punktinfo.ts';

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
/* Trykk på kartet: les fargen i punktet og finn klassen, og om det er planlagt utbygging der. Setningen under kartet sier det
   viktigste, og detaljene (punktinfo.ts) alt kartet vet om punktet. Prikken viser hvilket punkt det gjelder. */
export function trykkIKartet(e: MapBrowserEvent) {
  if (tegner()) return; /* under tegning er trykk i kartet hjørner i området */
  if (utenforKommunen(e.coordinate)) {
    glemPunkt();
    finnKommune(e.coordinate);
    return;
  }
  lukkBytt();
  const iTema = navnVed(e.coordinate);
  const pl = (planLag.getVisible() ? planLag.getData(e.pixel) : null) as Uint8ClampedArray | null,
    plan =
      pl && pl[3] > 40
        ? naermesteFarge(pl[0], pl[1], pl[2], [rgb('pnat'), rgb('pjor')]) === 1
          ? 'jordbruk'
          : 'natur'
        : null;
  let d = (tema.getVisible() ? tema.getData(e.pixel) : null) as Uint8ClampedArray | null;
  if ((!d || d[3] < 40) && oversikt() && oversiktLag.getVisible())
    d = oversiktLag.getData(e.pixel) as Uint8ClampedArray | null;
  let klasse: string | null = null,
    tekst = 'Ingen synlig klasse her (skjult kartlag, eller kartet er ikke hentet).';
  if (d && d[3] >= 40) {
    const valg = [...ALLE, ['slor', null] as const];
    klasse =
      valg[
        naermesteFarge(
          d[0],
          d[1],
          d[2],
          valg.map(([id]) => rgb(id))
        )
      ][1];
    if (!klasse) tekst = 'Kartlaget for dette punktet er skjult.';
  }
  ui.punkt = punktinfo(e.coordinate, klasse, plan);
  punktLag!.setPosition(e.coordinate);
  settProbe(plan ? { punkt: 'Planlagt utbygging på ' + plan + iTema } : klasse ? { punkt: klasse + iTema } : { tekst });
}
/* Punktet og detaljene glemmes: ved trykk utenfor kommunen og når kommunen byttes */
export function glemPunkt() {
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
