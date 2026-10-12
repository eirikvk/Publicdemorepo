/* Navigeringen i tvillingen: hovedsidene i menyen, temasidene under «Utforsk naturen», adressen i nettleseren, og oppstarten. Adressen
   har kommunen og siden, som i hovedsiden: #5001 (oversikten), #5001/naturtapet, #5001/utforsk, #5001/utforsk/skog, #5001/kart og
   #5001/hjelp. Hvert valg blir et steg i nettleserens historikk, så Tilbake og Frem går mellom sidene og kommunene. Siden bestemmer
   også hva kartet viser (ui.side, som kartet fra hovedsiden leser). */
import { finn, hentKommuner, kommuner, velgKommune } from '../src/data/motor/kommune.ts';
import { abonner, app, endret } from '../src/data/motor/tilstand.ts';
import { ui } from '../src/ui/tilstand.ts';
import { temaet } from './temaer.ts';

export type Hovedside = 'oversikt' | 'naturtapet' | 'utforsk' | 'kart' | 'hjelp';
/* Siden som vises: en hovedside, eventuelt et tema under «Utforsk naturen», eller ukjent når adressen ikke finnes */
export interface Rute {
  side: Hovedside | 'ukjent';
  tema?: string;
}
/* Menyen øverst, i rekkefølgen fra Figma. Hjelp og veileder står ved siden av «Bytt kommune». */
export const MENY: [Hovedside, string][] = [
  ['oversikt', 'Oversikt'],
  ['naturtapet', 'Naturtapet'],
  ['utforsk', 'Utforsk naturen'],
  ['kart', 'Utforsk i kart']
];

/* Tilstanden som bare gjelder tvillingen: siden, om menyen (mobil) og kommunevelgeren er åpne, og temaet på kartsiden */
export const figma = {
  rute: { side: 'oversikt' } as Rute,
  meny: false,
  bytt: false,
  kartTema: 'oversikt'
};

/* Hva kartet viser for ruten r: temaets lag, det som er valgt på kartsiden, eller bare arealklassene og planen */
const kartside = (r: Rute) => {
  const t = temaet(r.tema);
  return t ? t.kartside : r.side === 'kart' ? figma.kartTema : 'oversikt';
};
const settRute = (r: Rute) => {
  figma.rute = r;
  figma.meny = false;
  ui.side = kartside(r);
};

/* Adressen for ruten r i kommunen nr */
export const adresse = (r: Rute, nr = app.valgt ? app.valgt.nr : '') =>
  '#' + nr + (r.side === 'oversikt' || r.side === 'ukjent' ? '' : '/' + r.side + (r.tema ? '/' + r.tema : ''));
/* Ruten i adressen nå, og kommunen */
function iAdressen(): [nr: string, rute: Rute] {
  const [nr = '', side, tema] = (location.hash || '').replace('#', '').split('/');
  if (!side) return [nr, { side: 'oversikt' }];
  if (side === 'utforsk' && tema) return [nr, temaet(tema) ? { side: 'utforsk', tema } : { side: 'ukjent' }];
  if (!tema && ['naturtapet', 'utforsk', 'kart', 'hjelp'].includes(side)) return [nr, { side: side as Hovedside }];
  return [nr, { side: 'ukjent' }];
}

/* Går til ruten r: ny side øverst, og et nytt steg i historikken (se abonner under) */
export function gaaTil(r: Rute) {
  settRute(r);
  figma.bytt = false;
  endret();
  window.scrollTo(0, 0);
}
/* Velger temaet på kartsiden */
export function velgKartTema(id: string) {
  figma.kartTema = id;
  if (figma.rute.side === 'kart') ui.side = id;
  endret();
}
/* En lenke til ruten r: adressen (så lenken kan åpnes i ny fane) og klikket, som går dit uten å laste siden på nytt */
export const lenke = (r: Rute) => ({
  href: adresse(r),
  onClick: (e: { preventDefault(): void; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean }) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    gaaTil(r);
  }
});
/* Samme side, men for kommunen nr */
export function byttKommune(nr: string) {
  figma.bytt = false;
  figma.meny = false;
  velgKommune(nr);
}

/* Adressen følger kommunen og siden. Første adresse erstatter den siden ble åpnet med, resten blir nye steg i historikken. */
let forste = true;
abonner(() => {
  if (!app.valgt || figma.rute.side === 'ukjent') return; /* en adresse som ikke finnes, står som den er */
  const ny = adresse(figma.rute);
  if (location.hash !== ny)
    try {
      const url = location.pathname + location.search + ny;
      if (forste) history.replaceState(null, '', url);
      else history.pushState(null, '', url);
    } catch (e) {}
  forste = false;
});
/* Tilbake og Frem, eller en adresse skrevet inn */
function fraAdressen() {
  const [nr, r] = iAdressen();
  if (nr && finn(nr) && (!app.valgt || app.valgt.nr !== nr)) velgKommune(nr);
  if (r.side !== figma.rute.side || r.tema !== figma.rute.tema) {
    settRute(r);
    endret();
  }
}
window.addEventListener('popstate', fraAdressen);
window.addEventListener('hashchange', fraAdressen);

/* Oppstart: listen over kommuner hentes, og kommunen og siden i adressen velges (eller Trondheim). Kalles når kartet har fått
   plassen sin, så det kan zoome til kommunen med en gang. */
let startet = false;
export function startOpp() {
  if (startet) return;
  startet = true;
  const [nr, r] = iAdressen();
  settRute(r);
  hentKommuner().then(ok => {
    if (!ok) return;
    velgKommune(nr && finn(nr) ? nr : finn('5001') ? '5001' : kommuner()[0].kommuner[0].nr);
  });
}
