/* Naturtema fra Miljødirektoratet: verneområder, villrein og verdsatt natur. Her ligger kartlagene, hentingen og samordningen.
   Arealet, kartleggingsgraden og kryssingen med planen regnes ut i solv/temaer.js (sølv) og gull/temaer.js (gull). */
import { ol } from './ol.js';
import { OPPLOSNINGER } from '../solv/felles.js';
import { klasseAreal, kryssNatur } from '../gull/temaer.js';
import { byggDekning, klippNatur, lokaliteter } from '../solv/temaer.js';
import { utenPlan } from './egne.js';
import { app, endret, farge, flater, hent, husk, rgb, rolig, tidSlutt, tilKartet, valgNr } from './felles.js';
import { TOM, friskOpp, kommuneSti, lerret, plannett, tegnetKilde } from './grunnlag.js';
import { view } from './kart.js';
/* Naturlag fra Miljødirektoratet: verneområder og leveområder for villrein. Tjenestene gir selve flatene med navn og opplysninger,
   ikke bare et bilde. Hvert datasett blir et kartlag med egen knapp og egen del i tallpanelet, og krysses med planlagt utbygging. Delen i tallpanelet
   lages av visning/Tema.jsx ut fra feltene under.
   Et nytt datasett av samme slag legges til som en ny linje i listen under. */
const MD = 'https://kart.miljodirektoratet.no/arcgis/rest/services/';
export const NATURLAG = [
  {
    id: 'vern',
    navn: 'Verneområder',
    en: 'verneområde',
    fl: 'verneområder',
    best: 'verneområdene',
    vann: true,
    url: MD + 'vern/MapServer/0/query',
    felt: 'offisieltNavn,verneform,vernedato,faktaark',
    slakk: 5,
    kildetekst: 'Miljødirektoratet, naturvernområder',
    les: p => ({
      navn: p.offisieltNavn || 'Uten navn',
      url: p.faktaark || '',
      under: [
        String(p.verneform || '')
          .replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2')
          .toLowerCase()
          .replace(/omraade/g, 'område')
          .replace(/^./, c => c.toUpperCase()),
        p.vernedato ? 'vernet ' + new Date(p.vernedato).getUTCFullYear() : ''
      ]
        .filter(Boolean)
        .join(', ')
    })
  },
  {
    id: 'rein',
    navn: 'Villrein',
    en: 'villreinområde',
    fl: 'villreinområder',
    best: 'villreinområdene',
    url: MD + 'villrein/MapServer/1/query',
    felt: '*',
    slakk: 20,
    kildetekst: 'Miljødirektoratet, leveområder for villrein',
    les: p => ({
      navn: String(p['villreinområdeNavn'] || 'Uten navn').replace(/\s*-\s*leveområde\s*$/i, ''),
      url: p.faktaark || '',
      under: [
        p['villreinområdeNasjonalt'] === 'Ja' ? 'Nasjonalt villreinområde' : 'Villreinområde',
        p.funksjon ? String(p.funksjon).toLowerCase() : '',
        p.funksjonsperiode ? String(p.funksjonsperiode).toLowerCase() : ''
      ]
        .filter(Boolean)
        .join(', ')
    })
  },
  /* Naturtyper med verdi etter Miljødirektoratets fire verdikategorier. Det er mange små lokaliteter, så de tegnes fylt og uten hvit
     kant, i fire toner av samme farge: mørkere jo høyere verdi. I tallpanelet listes bare lokalitetene som berøres av planlagt utbygging.
     Dekningskartet viser hvor det er kartlagt. Det som ikke er kartlagt, kan få et lyst slør i kartet. */
  {
    id: 'verdi',
    navn: 'Verdsatt natur',
    en: 'verdsatt lokalitet',
    fl: 'verdsatte lokaliteter',
    best: 'lokalitetene',
    samlet: true,
    flate: true,
    avLand: true,
    dekning: true,
    klasser: [
      ['Svært stor verdi', 'verdi1'],
      ['Stor verdi', 'verdi2'],
      ['Middels verdi', 'verdi3'],
      ['Noe verdi', 'verdi4']
    ],
    url: MD + 'naturtyper_kuverdi/MapServer/0/query',
    hvor: nr =>
      `Verdikategori IN ('Svært stor verdi','Stor verdi','Middels verdi','Noe verdi') AND Kommune LIKE '%(${nr})%'`,
    felt: 'Verdikategori,Naturtype,Områdenavn,FaktaarkLokalitet,Faktaark',
    slakk: 5,
    kildetekst: 'Miljødirektoratet, naturtyper med KU-verdi og dekningskart for naturtypekartlegging',
    ekstra: hentDekning,
    les: p => ({
      navn: p['Områdenavn'] || p.Naturtype || 'Uten navn',
      url: p.FaktaarkLokalitet || p.Faktaark || '',
      v: Math.max(0, ['Svært stor verdi', 'Stor verdi', 'Middels verdi', 'Noe verdi'].indexOf(p.Verdikategori)),
      under: [p.Naturtype, String(p.Verdikategori || '').toLowerCase()].filter(Boolean).join(', ')
    })
  }
].map(t => {
  t.kilde = new ol.source.Vector();
  t.minne = new Map();
  t.data = null;
  t.paa = false; /* naturlagene er av når siden åpnes, så kartet starter enkelt */
  /* Bare omriss: en hvit kant og en farget strek. En fylling over hele området måtte tegnes på nytt i hvert bilde når kartet flyttes.
     Laget deler lerret med planlaget, så de klippes samlet. Den store bufferen gjør at alle omrissene i kommunen tegnes i ett, også de
     utenfor utsnittet, så de er på plass mens kartet flyttes. */
  /* Fylte flater tegnes om til kartfliser i nettleseren, slik planlaget gjør. Tusen små flater som vektor måtte tegnes på nytt i hvert
     bilde når kartet flyttes. Som fliser tegnes de én gang og flyttes som bilder. */
  /* Et område som er mindre enn noen få piksler i kartet, for eksempel et fredet tre, tegnes som en liten ring med fast størrelse.
     Som omriss ville det blinket når kartet flyttes: havner alle punktene i samme piksel, blir streken null lang og tegnes ikke. */
  const midt = f => f.midt || (f.midt = new ol.geom.Point(ol.extent.getCenter(f.getGeometry().getExtent())));
  t.strek = [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,.92)', width: 6 }) }),
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: farge(t.id), width: 2.75 }) })
  ];
  t.merke = [
    new ol.style.Style({
      geometry: midt,
      image: new ol.style.Circle({ radius: 7, fill: new ol.style.Fill({ color: 'rgba(255,255,255,.92)' }) })
    }),
    new ol.style.Style({
      geometry: midt,
      image: new ol.style.Circle({ radius: 4, stroke: new ol.style.Stroke({ color: farge(t.id), width: 2.75 }) })
    })
  ];
  t.lag = t.flate
    ? new ol.layer.Tile({ className: 'plan', visible: false, source: tegnetKilde(tile => tegnFlateflis(t, tile)) })
    : new ol.layer.Vector({
        className: 'plan',
        source: t.kilde,
        visible: false,
        renderBuffer: 4000,
        style: (f, res) => {
          const u = f.getGeometry().getExtent();
          return Math.max(u[2] - u[0], u[3] - u[1]) < 8 * res ? t.merke : t.strek;
        }
      });
  return t;
});
/* Slør over det som ikke er kartlagt: flisene fylles med en lys farge, og de kartlagte flatene stanses ut. Fliser uten noe kartlagt
   deler ett og samme bilde, så laget koster lite der hele flisen er ukjent. Laget ligger under naturflatene og planlaget. */
const dekKilde = new ol.source.Vector();
let heltSlor = null;
const slorFarge = () => `rgba(${rgb('slor').join(',')},.55)`;
function tegnSlorflis(tile) {
  const u = plannett.getTileCoordExtent(tile.getTileCoord()),
    fl = dekKilde.getFeaturesInExtent(u);
  if (!fl.length) {
    if (!heltSlor) {
      heltSlor = lerret();
      const g = heltSlor.getContext('2d');
      g.fillStyle = slorFarge();
      g.fillRect(0, 0, 512, 512);
    }
    tile.setImage(heltSlor);
    return;
  }
  const t0 = performance.now(),
    c = lerret(),
    g = c.getContext('2d'),
    s = 512 / (u[2] - u[0]);
  g.fillStyle = slorFarge();
  g.fillRect(0, 0, 512, 512);
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  for (const f of fl) {
    kommuneSti(g, f.getGeometry(), u, s);
    g.fill('evenodd');
  }
  tile.setImage(c);
  tidSlutt('slør, fliser', t0);
}
export const dekLag = new ol.layer.Tile({ className: 'plan', visible: false, source: tegnetKilde(tegnSlorflis) });
function settDekning(t) {
  /* de kartlagte flatene for valgt kommune inn i sløret */
  const E = t.data && t.data.ekstra;
  dekKilde.clear();
  if (E && E.f) dekKilde.addFeatures(E.f);
  friskOpp(dekLag);
}
/* Rekkefølge i kartet: fylte flater ligger under planlaget, så planlagt utbygging oppå verdifull natur synes. Omriss ligger øverst. */
export const flateLag = NATURLAG.filter(t => t.flate).map(t => t.lag),
  omrissLag = NATURLAG.filter(t => !t.flate).map(t => t.lag);
/* Kommunen som flate med utsnitt, slik analysene tar den */
const kommunen = geom => ({ koord: flater(geom), ext: geom.getExtent() });
function tegnFlateflis(t, tile) {
  /* enkeltflatene som berører flisen, tegnet tett og så gjort litt gjennomsiktige samlet, så overlapp ikke blir mørkere */
  const t0 = performance.now(),
    u = plannett.getTileCoordExtent(tile.getTileCoord()),
    fl = t.kilde.getFeaturesInExtent(u);
  if (!fl.length) {
    tile.setState(TOM);
    return;
  }
  const c = lerret(),
    g = c.getContext('2d'),
    s = 512 / (u[2] - u[0]);
  g.fillStyle = g.strokeStyle = farge(t.id);
  g.lineWidth = 1;
  g.lineJoin = 'round';
  if (t.klasser)
    fl.sort(
      (a, b) => b.get('v') - a.get('v')
    ); /* lavest verdi først, så den høyeste ligger øverst der lokaliteter overlapper */
  for (const f of fl) {
    if (t.klasser) {
      const v = f.get('v');
      g.fillStyle = farge(t.klasser[v][1]);
      g.strokeStyle = farge(t.klasser[Math.max(0, v - 1)][1]);
    }
    kommuneSti(g, f.getGeometry(), u, s);
    g.fill('evenodd');
    g.stroke();
  }
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = 'rgba(0,0,0,.82)';
  g.fillRect(0, 0, 512, 512);
  tile.setImage(c);
  tidSlutt(t.navn.toLowerCase() + ', fliser', t0);
}
/* Kartleggingsgrad: hvor stor del av kommunen som er kartlagt etter Miljødirektoratets instruks. Uten den er «ingen registrert» lett å misforstå. */
async function hentDekning(k, geom) {
  const j = await hent(
    'Miljødirektoratet',
    `Kartlagt område i ${k.navn}`,
    MD +
      'naturtyper_nin/MapServer/1/query?' +
      new URLSearchParams({
        where: '1=1',
        geometry: geom
          .getExtent()
          .map(v => Math.round(v))
          .join(','),
        geometryType: 'esriGeometryEnvelope',
        inSR: 25833,
        outSR: 25833,
        spatialRel: 'esriSpatialRelIntersects',
        outFields: 'Årstall',
        maxAllowableOffset: 10,
        geometryPrecision: 0,
        f: 'geojson'
      })
  );
  const D = byggDekning(j.features || [], kommunen(geom));
  if (D.flate) D.f = D.flate.map(p => new ol.Feature(new ol.geom.Polygon(p))); /* til sløret i kartet */
  return D;
}
export async function hentNatur(t, k, geom, mitt) {
  t.data = null;
  t.kilde.clear();
  if (t.flate) friskOpp(t.lag);
  if (t.dekning) settDekning(t);
  visNatur(t);
  try {
    let pakke = t.minne.get(k.nr);
    if (!pakke) {
      const j = await hent(
        'Miljødirektoratet',
        `${t.navn} i ${k.navn}`,
        t.url +
          '?' +
          new URLSearchParams({
            where: t.hvor ? t.hvor(k.nr) : `kommune LIKE '%(${k.nr})%'`,
            outFields: t.felt,
            outSR: 25833,
            maxAllowableOffset: t.slakk,
            geometryPrecision: 0,
            f: 'geojson'
          })
      );
      if (mitt !== valgNr) return;
      if (!j || !Array.isArray(j.features)) throw new Error('uventet svar');
      const med = o => {
        const g = new ol.geom.MultiPolygon(o.koord);
        return {
          ...o,
          f: new ol.Feature({ geometry: g, navn: o.navn, v: o.v || 0 }),
          ext: g.getExtent(),
          maske: null,
          plan: 0,
          smal: 0
        };
      };
      if (t.samlet) {
        const kom = kommunen(geom),
          alle = lokaliteter(j.features, kom, t.les),
          r = klasseAreal(alle, t.klasser ? t.klasser.length : 1, kom),
          omrader = alle.map(med);
        pakke = {
          omrader,
          sum: r.sum,
          klasser: t.klasser ? r.klasser : null,
          vis: omrader.map(o => o.f),
          ufullstendig: !!j.exceededTransferLimit
        };
      } else {
        const omrader = klippNatur(j.features, kommunen(geom), t.les).map(med);
        pakke = { omrader, sum: omrader.reduce((s, o) => s + o.km2, 0), vis: omrader.map(o => o.f) };
      }
      husk(t.minne, k.nr, pakke, 30);
    }
    t.data = { nr: k.nr, ...pakke, pakke };
    t.kilde.addFeatures(pakke.vis);
    if (t.flate) friskOpp(t.lag);
    if (t.dekning) settDekning(t);
    if (t.ekstra && pakke.ekstra === undefined) {
      pakke.ekstra = null;
      t.ekstra(k, geom)
        .then(v => {
          if (t.klasser && v && v.flate && v.flate.length)
            try {
              v.inne = klasseAreal(pakke.omrader, t.klasser.length, kommunen(geom), v.flate).klasser;
            } catch (e) {}
          pakke.ekstra = v;
          if (t.data && t.data.pakke === pakke) {
            t.data.ekstra = v;
            if (t.dekning) settDekning(t);
            regnNatur(t);
          }
        })
        .catch(() => {});
    }
  } catch (e) {
    if (mitt !== valgNr) return;
    t.data = { nr: k.nr, feil: true, omrader: [], sum: 0 };
  }
  regnNatur(t);
}
export function regnNatur(t) {
  /* samordner: krysser temaet med planen hvis den er regnet ut, legger tallene i temaets data og ber om ny tegning */
  const D = t.data;
  if (!D || !app.valgt || D.nr !== app.valgt.nr) return visNatur(t);
  const R = app.planRaster && app.planRaster.nr === app.valgt.nr && !utenPlan() ? app.planRaster : null,
    t0 = performance.now();
  const r = R ? kryssNatur(D, R, t.klasser ? t.klasser.length : 1, !!t.dekning, kommunen(app.klipp)) : null;
  D.omrader.forEach((o, a) => {
    o.plan = r ? r.plan[a] : 0;
    o.smal = r ? r.smal[a] : 0;
  });
  D.regnet = !!R;
  D.kryss = r ? r.kryss : null;
  D.gap = r ? r.gap : null;
  visNatur(t);
  tidSlutt(t.navn.toLowerCase(), t0);
}
/* Kartlagene for temaet følger tilstanden. Tekst, tall og lister for temaet tegnes av siden, se visning/Tema.jsx. */
export function visNatur(t) {
  const D = t.data,
    ok = !!D && !!app.valgt && D.nr === app.valgt.nr,
    o = ok ? D.omrader : [];
  t.lag.setVisible(t.paa && !!app.klipp && ok && o.length > 0);
  if (t.dekning) {
    const kartlagt = ok && !!D.ekstra && D.ekstra.km2 > 0;
    dekLag.setVisible(t.paa && app.slorPaa && !!app.klipp && kartlagt);
  }
  endret();
}
/* Ett område valgt fra en liste: kartet flyttes dit, området får en tydelig ramme, og en liten merkelapp i kartet sier hva som vises
   og gir veien tilbake til listen. Markeringen står til et annet område velges, temaet slås av eller kommunen byttes. */
const markKilde = new ol.source.Vector();

const markStrek = [
  new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#fff', width: 8 }) }),
  new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#171C1A', width: 3.5 }) })
];
const markMidt = f => new ol.geom.Point(ol.extent.getCenter(f.getGeometry().getExtent()));
const markRing = [
  new ol.style.Style({
    geometry: markMidt,
    image: new ol.style.Circle({ radius: 13, stroke: new ol.style.Stroke({ color: '#fff', width: 8 }) })
  }),
  new ol.style.Style({
    geometry: markMidt,
    image: new ol.style.Circle({ radius: 13, stroke: new ol.style.Stroke({ color: '#171C1A', width: 3.5 }) })
  })
];
export const markLag = new ol.layer.Vector({
  className: 'merket',
  source: markKilde,
  style: (f, res) => {
    const u = f.getGeometry().getExtent();
    return Math.max(u[2] - u[0], u[3] - u[1]) < 16 * res ? markRing : markStrek;
  }
});
export function fjernMerket() {
  markKilde.clear();
  if (app.vist) {
    app.vist = null;
    endret();
  }
}
/* t er temaet, o området og liId id-en til området i listen, så man kan finne veien tilbake dit. */
export function visIKartet(t, o, liId) {
  if (!t.paa) {
    t.paa = true;
    visNatur(t);
  }
  markKilde.clear();
  markKilde.addFeature(new ol.Feature(o.f.getGeometry()));
  app.vist = { id: t.id, navn: o.navn, liId };
  endret();
  view.fit(o.ext, { padding: [56, 56, 96, 56], minResolution: OPPLOSNINGER[13], duration: rolig() ? 0 : 400 });
  tilKartet(true);
}
