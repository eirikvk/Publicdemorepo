/* Det brukeren kan gjøre: velge kommune, velge side, og oppstarten. Sidens komponenter kaller funksjonene her. */
import { ol } from './ol.js';
import { sluttTegning, visEgneLag } from './egne.js';
import { KV, UTM, app, endret, hent, nyttValg, utm33, valgNr } from './felles.js';
import { tema } from './fliser.js';
import { graaLag, sjekkGraa, visGraa } from './graa.js';
import { friskOpp } from './grunnlag.js';
import { inonLag, sjekkInon, visInon } from './inon.js';
import { grenseKilde, kartStatus, lukkBytt, view } from './kart.js';
import { NATURLAG, dekLag, fjernMerket, hentNatur, visNatur } from './naturtema.js';
import { hentOversikt, nySamling, stoppEtterarbeid } from './oversikt.js';
import { planLag, sjekkPlan, visPlan } from './plan.js';
import { hentHistorie, hentTall, nullstillTall } from './tall.js';
let startet = false;

/* Sidene i sidevelgeren, i rekkefølgen de vises: [id, navn, gruppe]. Sider med samme gruppe står samlet under gruppens navn. Hver
   side bestemmer innholdet og hva kartet viser: arealklassene og planlagt utbygging vises på alle sider, og temaet bare på sin egen
   side. */
const NATUR = 'Naturen i kommunen';
export const SIDER = [
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
export const BLOKKER = SIDER.reduce((b, s) => {
  const siste = b[b.length - 1];
  if (siste && siste.gruppe === s[2]) siste.sider.push(s);
  else b.push({ gruppe: s[2], sider: [s] });
  return b;
}, []);
/* Kommunen og siden står i adressen, for eksempel #5001/verdi, så en lenke åpner samme kommune og side. Oversikten står ikke. */
export const adresse = (id = app.side) => '#' + (app.valgt ? app.valgt.nr : '') + (id !== SIDER[0][0] ? '/' + id : '');
const skrivAdresse = () => {
  try {
    history.replaceState(null, '', location.pathname + location.search + adresse());
  } catch (e) {}
};
export function velgSide(id) {
  if (!SIDER.some(s => s[0] === id)) id = SIDER[0][0];
  app.side = id;
  NATURLAG.forEach(t => {
    const paa = t.id === id;
    if (t.paa === paa) return;
    t.paa = paa;
    if (!paa && app.vist && app.vist.id === t.id) fjernMerket();
    visNatur(t);
  });
  if (app.inonPaa !== (id === 'inon')) {
    app.inonPaa = id === 'inon';
    visInon();
  }
  if (app.graaPaa !== (id === 'graa')) {
    app.graaPaa = id === 'graa';
    visGraa();
  }
  skrivAdresse();
  endret();
}
export function settSmale(paa) {
  app.visSmale = paa;
  friskOpp(planLag);
  endret();
}
export function settSlor(paa) {
  app.slorPaa = paa;
  NATURLAG.filter(t => t.dekning).forEach(visNatur);
}

async function hentGrense(k, mitt, behold) {
  try {
    const j = await hent('Kartverket', `Grense for ${k.navn}`, `${KV}/kommuner/${k.nr}/omrade?utkoordsys=25833`);
    if (mitt !== valgNr) return;
    const geom = new ol.format.GeoJSON().readGeometry(j.omrade, { dataProjection: UTM, featureProjection: UTM });
    grenseKilde.clear();
    grenseKilde.addFeature(new ol.Feature(geom));
    app.flate = geom.getArea() / utm33(geom); /* flaten i km², rettet for målestokken i kartprojeksjonen */
    app.klipp = geom;
    endret();
    tema.setExtent(geom.getExtent());
    planLag.setExtent(geom.getExtent());
    inonLag.setExtent(geom.getExtent());
    graaLag.setExtent(geom.getExtent());
    dekLag.setExtent(geom.getExtent());
    tema.setVisible(true);
    visPlan();
    sjekkPlan(k, geom, mitt);
    sjekkInon(k, geom, mitt);
    sjekkGraa(k, geom, mitt);
    NATURLAG.forEach(t => hentNatur(t, k, geom, mitt));
    if (!app.oversikter[k.nr]) nySamling(k.nr, geom.getExtent());
    if (!k.boks && !behold) view.fit(geom.getExtent(), { padding: [16, 16, 16, 16], duration: 350 });
  } catch (e) {
    if (mitt === valgNr) {
      app.probe = { tekst: 'Kommunegrensen kunne ikke hentes.' };
      endret();
      tema.setVisible(true);
    }
  }
}

export const finn = nr => {
  for (const f of app.fylker) for (const k of f.kommuner) if (k.nr === nr) return [f, k];
  return null;
};
export function velg(nr, behold) {
  /* behold: kartet blir stående der det er, brukes når kommunen velges i kartet */
  const t = finn(nr);
  if (!t) return;
  const [, k] = t,
    mitt = nyttValg();
  app.valgt = k;
  lukkBytt();
  skrivAdresse();
  app.probe = null;
  nullstillTall('henter');
  grenseKilde.clear();
  app.klipp = null;
  app.flate = 0;
  app.planRaster = null;
  app.historie = null;
  app.planSum = null;
  stoppEtterarbeid();
  app.planInfo = null;
  sluttTegning();
  visEgneLag();
  fjernMerket();
  app.inon = null;
  visInon();
  app.graa = null;
  app.graaKryss = null;
  visGraa();
  NATURLAG.forEach(t => {
    t.data = null;
    t.kilde.clear();
    visNatur(t);
  });
  tema.setVisible(false);
  tema.setExtent(undefined);
  visPlan();
  app.siste = '';
  endret();
  hentOversikt(k, mitt);
  if (k.boks && !behold)
    view.fit(ol.proj.transformExtent(k.boks, 'EPSG:4326', UTM), { padding: [16, 16, 16, 16], duration: 350 });
  hentTall(k, mitt);
  hentHistorie(k, mitt);
  hentGrense(k, mitt, behold);
  kartStatus();
}
/* Første kommune i et fylke, når fylket byttes */
export const velgFylke = nr => {
  const f = app.fylker.find(x => x.nr === nr);
  if (f) velg(f.kommuner[0].nr);
};

const boksAv = b => {
  const c = b && b.coordinates && b.coordinates[0];
  if (!c) return null;
  const x = c.map(q => q[0]),
    y = c.map(q => q[1]);
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)];
};
/* Oppstart: kartet lages, listen over kommuner og registeret over oversiktsbilder hentes, og kommunen i adressen velges (eller
   Trondheim). Kalles av siden når kartet har fått plassen sin, så kartet kan zoome til kommunen med en gang. */
export function startOpp() {
  if (startet) return;
  startet = true;
  hent('Egen fil', 'Fylker og kommuner', 'kommuner.json', true)
    .then(j =>
      j.map(f => ({ nr: f[0], navn: f[1], kommuner: f[2].map(k => ({ nr: k[0], navn: k[1], boks: k.slice(2) })) }))
    )
    .catch(() =>
      hent('Kartverket', 'Fylker og kommuner', `${KV}/fylkerkommuner`).then(j =>
        j.map(f => ({
          nr: f.fylkesnummer,
          navn: f.fylkesnavn,
          kommuner: f.kommuner.map(k => ({
            nr: k.kommunenummer,
            navn: k.kommunenavnNorsk,
            boks: boksAv(k.avgrensningsboks)
          }))
        }))
      )
    )
    .then(async liste => {
      const reg = await hent('Egen fil', 'Register over oversiktsbilder', 'oversikt.json', true).catch(() => null);
      if (reg && reg.kommuner) {
        app.oversikter = reg.kommuner;
        app.oversiktInfo = { versjon: reg.versjon, hentet: reg.hentet };
      }
      app.fylker = liste.sort((a, b) => a.navn.localeCompare(b.navn, 'nb'));
      app.fylker.forEach(f => f.kommuner.sort((a, b) => a.navn.localeCompare(b.navn, 'nb')));
      let [forst, side] = (location.hash || '').replace('#', '').split('/');
      if (!finn(forst)) forst = finn('5001') ? '5001' : app.fylker[0].kommuner[0].nr;
      velg(forst);
      if (side) velgSide(side);
    })
    .catch(() => {
      app.listeFeil = true;
      endret();
    });
}
