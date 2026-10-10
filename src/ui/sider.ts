/* Sidene og navigeringen: hvilke sider som finnes, valg av side, adressen i nettleseren, og oppstarten. Sidevelgeren og lenkene
   mellom sidene bruker dette, og kartet viser temaet til siden som er valgt. */
import { finn, hentKommuner, velgKommune } from '../data/motor/kommune.ts';
import { abonner, app, endret } from '../data/motor/tilstand.ts';
import { ui } from './tilstand.ts';

/* Sidene i sidevelgeren, i rekkefølgen de vises: [id, navn, gruppe]. Sider med samme gruppe står samlet under gruppens navn. Hver
   side bestemmer innholdet og hva kartet viser: arealklassene og planlagt utbygging vises på alle sider, og temaet bare på sin egen
   side. */
const NATUR = 'Naturen i kommunen';
export type Side = [id: string, navn: string, gruppe?: string];
export const SIDER: Side[] = [
  ['oversikt', 'Oversikt'],
  ['regnskap', 'Utbredelsesregnskap'],
  ['graa', 'Grått areal', NATUR],
  ['rein', 'Villrein', NATUR],
  ['inon', 'Inngrepsfri natur', NATUR],
  ['verdi', 'Verdsatt natur', NATUR],
  ['vern', 'Verneområder', NATUR],
  ['framtid', 'Utvikling fremover'],
  ['om', 'Om og metode']
];
/* Sidene i blokker: sider som står etter hverandre med samme gruppe (eller uten gruppe) havner i samme blokk. Sidevelgeren og
   oversikten bruker blokkene. */
export const BLOKKER = SIDER.reduce<{ gruppe: string | undefined; sider: Side[] }[]>((b, s) => {
  const siste = b[b.length - 1];
  if (siste && siste.gruppe === s[2]) siste.sider.push(s);
  else b.push({ gruppe: s[2], sider: [s] });
  return b;
}, []);

export function velgSide(id: string) {
  if (!SIDER.some(s => s[0] === id)) id = SIDER[0][0];
  ui.side = id;
  endret();
}

/* Kommunen og siden står i adressen, for eksempel #5001/verdi, så en lenke åpner samme kommune og side. Oversikten står ikke. */
export const adresse = (id = ui.side) => '#' + (app.valgt ? app.valgt.nr : '') + (id !== SIDER[0][0] ? '/' + id : '');
abonner(() => {
  if (!app.valgt || location.hash === adresse()) return;
  try {
    history.replaceState(null, '', location.pathname + location.search + adresse());
  } catch (e) {}
});

/* Oppstart: listen over kommuner hentes, og kommunen og siden i adressen velges (eller Trondheim). Kalles av siden når kartet har
   fått plassen sin, så kartet kan zoome til kommunen med en gang. */
let startet = false;
export function startOpp() {
  if (startet) return;
  startet = true;
  let [forst, side] = (location.hash || '').replace('#', '').split('/');
  hentKommuner().then(ok => {
    if (!ok) return;
    if (!finn(forst)) forst = finn('5001') ? '5001' : app.fylker[0].kommuner[0].nr;
    velgKommune(forst);
    if (side) velgSide(side);
  });
}
