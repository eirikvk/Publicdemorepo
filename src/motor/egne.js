/* Egne områder: tegning i kartet, opplasting av plan, og radene som sammenligner med kommuneplanen. Hvilke flater som er
   utbygging, hvordan de legges inn i planrutenettet og hvordan radene bygges, ligger i analyse/egne.js. */
import { ol } from './ol.js';
import { EGET_MIN_M2, OPPLOSNINGER, areal, m2PerKm2 } from '../analyse/felles.js';
import { byggEgneRader, planType } from '../analyse/egne.js';
import { UTM, app, endret, farge, flater, nf, tilKartet } from './felles.js';
import { kommuneSti, lerret } from './grunnlag.js';
import { finn, velg } from './handlinger.js';
import { kart, lukkBytt, view } from './kart.js';
import { NATURLAG } from './naturtema.js';
import { ingenPlan, visPlan } from './plan.js';
/* Egne områder ligger i app.egne. De finnes bare så lenge siden er åpen, og hører til kommunen de ble tegnet i. */

let egenTeller = 0;
export const mine = () => (app.valgt ? app.egne.filter(g => g.nr === app.valgt.nr) : []);
export const utenPlan = () =>
  ingenPlan() &&
  !mine().length; /* uten kommuneplan og uten egne områder finnes det ingen planlagt utbygging å regne på */
/* Egne områder i kartet: omriss med nummer. Fargen inni kommer fra planlaget, som viser hva som går med. */
const egneKilde = new ol.source.Vector();
export const egneLag = new ol.layer.Vector({
  className: 'merket',
  source: egneKilde,
  style: f => [
    new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#fff', width: 7 }) }),
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: farge('egne'),
        width: 3,
        lineDash: f.get('type') === 'fri' ? [10, 7] : undefined
      }),
      text: new ol.style.Text({
        text: String(f.get('lopenr')),
        font: '600 14px sans-serif',
        fill: new ol.style.Fill({ color: '#fff' }),
        backgroundFill: new ol.style.Fill({ color: farge('egne') }),
        padding: [3, 6, 2, 6],
        overflow: true
      })
    })
  ]
});
let tegn = null;
export const tegner = () => !!tegn;
const tegnStil = [
  new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#fff', width: 6 }) }),
  new ol.style.Style({
    stroke: new ol.style.Stroke({ color: farge('egne'), width: 2.5 }),
    fill: new ol.style.Fill({ color: 'rgba(0,114,206,.12)' }),
    image: new ol.style.Circle({
      radius: 7,
      fill: new ol.style.Fill({ color: farge('egne') }),
      stroke: new ol.style.Stroke({ color: '#fff', width: 2.5 })
    })
  })
];
export function sluttTegning() {
  if (tegn) kart.removeInteraction(tegn);
  tegn = null;
  endret();
}
/* Knappene under tegning */
export const angrePunkt = () => {
  if (tegn) tegn.removeLastPoint();
};
export const ferdigTegning = () => {
  if (tegn) tegn.finishDrawing();
};
export function startTegning() {
  if (!app.valgt || !app.klipp || tegner()) return;
  lukkBytt();
  tegn = new ol.interaction.Draw({ type: 'Polygon', stopClick: true, minPoints: 3, style: tegnStil });
  tegn.on('drawend', e => {
    const geom = e.feature.getGeometry();
    setTimeout(() => {
      sluttTegning();
      nyttEget(geom);
    }, 0);
  });
  kart.addInteraction(tegn);
  endret();
  tilKartet();
}
export function visEgneLag() {
  egneKilde.clear();
  egneKilde.addFeatures(
    mine()
      .filter(g => g.f)
      .map(g => g.f)
  );
}
function egneEndret() {
  visEgneLag();
  endret();
  visPlan();
}
function nyttEget(geom) {
  if (!app.valgt) return;
  if (!(geom.getArea() > EGET_MIN_M2)) {
    app.egneStatus = { tekst: 'Området ble for lite til å regnes ut. Tegn et større område.', type: 'warning' };
    endret();
    return;
  }
  app.egneStatus = null;
  const lopenr = mine().reduce((m, x) => Math.max(m, x.lopenr || 0), 0) + 1;
  const g = {
    id: ++egenTeller,
    nr: app.valgt.nr,
    lopenr,
    navn: `Eget område ${lopenr}`,
    kilde: 'tegnet',
    deler: [{ geom, koord: flater(geom), type: 'bygg', ext: geom.getExtent() }],
    ext: geom.getExtent(),
    km2: areal(flater(geom)) / m2PerKm2(geom.getExtent()),
    tall: null
  };
  g.f = new ol.Feature({ geometry: geom, lopenr, type: 'bygg' });
  app.egne.push(g);
  egneEndret();
}
/* Opplastet plan i samme GeoJSON-format som DiBKs nedlasting av plandata: flater med arealformål og arealbruksstatus. Hvilke
   flater som regnes som utbygging, står i planType i analyse/egne.js. Innenfor flatene erstatter filen kommuneplanen. Filen leses i
   nettleseren og sendes ingen steder. */
const siffer = v => {
  const m = /\d+/.exec(v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return m ? m[0] : '';
};
const egenskap = (p, ...navn) => {
  for (const n of navn) {
    if (p[n] !== undefined && p[n] !== null) return p[n];
    const [a, b] = n.split('.');
    if (b && p[a] && p[a][b] !== undefined) return p[a][b];
  }
  return undefined;
};
function finnProjeksjon(j, punkt, mot) {
  /* oppgitt i filen, ellers gjettet: grader, eller den UTM-sonen som legger planen nærmest kommunen */
  const navn = j.crs && j.crs.properties ? String(j.crs.properties.name || '') : '',
    m = /EPSG:+(\d+)/.exec(navn);
  if (m && ol.proj.get('EPSG:' + m[1])) return 'EPSG:' + m[1];
  if (/CRS84/.test(navn) || (Math.abs(punkt[0]) <= 180 && Math.abs(punkt[1]) <= 90)) return 'EPSG:4326';
  let best = UTM,
    min = Infinity;
  for (const kode of [UTM, 'EPSG:25832', 'EPSG:25835']) {
    const q = ol.proj.transform(punkt, kode, UTM),
      a = mot ? Math.hypot(q[0] - mot[0], q[1] - mot[1]) : 0;
    if (a < min) {
      min = a;
      best = kode;
    }
  }
  return best;
}
/* Tolker innholdet i en planfil. valgtNr er kommunen som er valgt nå, erKommune sier om et nummer er en kommune, og midtAv gir et
   punkt midt i en kommune, brukt til å gjette projeksjonen. Gir { feil } med en melding, eller flatene og opplysningene om planen.
   Endrer ingenting. */
function lesPlanfil(j, valgtNr, erKommune, midtAv) {
  const alle = (j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : j.features) || [];
  const polygoner = alle.filter(
    f =>
      f &&
      f.geometry &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
      f.geometry.coordinates &&
      f.geometry.coordinates.length
  );
  if (!polygoner.length)
    return {
      feil: 'Fant ingen flater i filen. Den må være GeoJSON med polygoner, som filen fra DiBKs nedlasting av plandata.'
    };
  const medFormal = polygoner.filter(
      f => siffer(egenskap(f.properties || {}, 'arealformål', 'arealformal', 'arealformaal', 'Arealformål')) !== ''
    ),
    bruk = medFormal.length ? medFormal : polygoner;
  const knr = siffer(
      bruk
        .map(f => egenskap(f.properties || {}, 'arealplanId.kommunenummer', 'kommunenummer'))
        .find(v => v !== undefined)
    ).padStart(4, '0'),
    funnet = /^\d{4}$/.test(knr) && knr !== '0000' && erKommune(knr),
    nr = funnet ? knr : valgtNr;
  if (!nr) return { feil: 'Velg en kommune først.' };
  const g0 = bruk[0].geometry,
    punkt = g0.type === 'Polygon' ? g0.coordinates[0][0] : g0.coordinates[0][0][0];
  const proj = finnProjeksjon(j, punkt, midtAv(nr)),
    les = new ol.format.GeoJSON(),
    deler = [];
  let bygg = 0,
    km2 = 0,
    ext = ol.extent.createEmpty();
  for (const f of bruk) {
    let geom;
    try {
      geom = les.readGeometry(f.geometry, { dataProjection: proj, featureProjection: UTM });
    } catch (e) {
      continue;
    }
    const p = f.properties || {},
      formal = siffer(egenskap(p, 'arealformål', 'arealformal', 'arealformaal', 'Arealformål')),
      status = siffer(egenskap(p, 'arealbruksstatus', 'arealbrukstatus', 'Arealbruksstatus'));
    const type = planType(formal, status, medFormal.length > 0);
    if (type === 'bygg') bygg++;
    const e = geom.getExtent(),
      koord = flater(geom);
    ol.extent.extend(ext, e);
    km2 += areal(koord) / m2PerKm2(e);
    deler.push({ geom, koord, type, ext: e });
  }
  if (!deler.length) return { feil: 'Flatene i filen kunne ikke leses.' };
  const planid = String(
    bruk
      .map(f => egenskap(f.properties || {}, 'arealplanId.planidentifikasjon', 'planidentifikasjon'))
      .find(v => v !== undefined) || ''
  );
  return { nr, funnet, deler, ext, km2, planid, bygg, annet: deler.length - bygg, utenFormal: !medFormal.length, proj };
}
export async function lastOppPlan(fil) {
  /* type er typen melding i designsystemet: info, success, warning eller error */
  const melding = (tekst, type = 'error') => {
    app.egneStatus = { tekst, type };
    endret();
  };
  try {
    if (!fil) return;
    if (fil.size > 120e6) return melding('Filen er for stor til å leses i nettleseren (over 120 MB).');
    melding(`Leser ${fil.name} …`, 'info');
    await new Promise(ok => setTimeout(ok, 30));
    const midtAv = nr => {
      const k = finn(nr)[1];
      return app.valgt && app.valgt.nr === nr && app.klipp
        ? ol.extent.getCenter(app.klipp.getExtent())
        : k.boks
          ? ol.proj.transform([(k.boks[0] + k.boks[2]) / 2, (k.boks[1] + k.boks[3]) / 2], 'EPSG:4326', UTM)
          : null;
    };
    const P = lesPlanfil(JSON.parse(await fil.text()), app.valgt ? app.valgt.nr : null, nr => !!finn(nr), midtAv);
    if (P.feil) return melding(P.feil);
    const { nr, funnet, ...plan } = P,
      k = finn(nr)[1];
    app.egne.push({
      id: ++egenTeller,
      nr,
      navn: fil.name.replace(/\.(geo)?json$/i, ''),
      kilde: 'fil',
      tall: null,
      ...plan
    });
    melding(
      `${fil.name}: ${nf(plan.deler.length, 0)} flater lest${funnet && (!app.valgt || app.valgt.nr !== nr) ? `, og kommunen er byttet til ${k.navn}` : ''}.`,
      'success'
    );
    if (!app.valgt || app.valgt.nr !== nr) velg(nr);
    else egneEndret();
  } catch (e) {
    melding('Filen kunne ikke leses som GeoJSON.');
  }
}
/* Radene i sammenligningen mellom kommuneplanen og egne områder, for hele kommunen eller ett område. Radene bygges av byggEgneRader i
   analyse/egne.js: natur og jordbruk som går med, og hvor mye av det som ligger i grått areal, verneområder, villreinområder,
   verdsatt natur per verdi og natur som ikke er kartlagt. Hver rad viser kommuneplanen alene, tallet med egne områder og endringen. */
export function egneRader(e) {
  /* finner det radene bygges av i tilstanden. e: null for hele kommunen, ellers nummeret i listen over egne områder */
  const R = app.planRaster,
    GK =
      app.graaKryss && app.valgt && app.graaKryss.nr === app.valgt.nr && app.graaKryss.antallEgne === R.antallEgne
        ? app.graaKryss
        : null;
  const data = t => (t.data && app.valgt && t.data.nr === app.valgt.nr ? t.data : null);
  const tema = NATURLAG.filter(t => {
    const D = data(t);
    return D && D.kryss && D.kryss.P && D.omrader.length;
  }).map(t => ({
    navn: t.navn === 'Villrein' ? 'Villreinområder' : t.navn,
    id: t.id,
    klasser: t.klasser,
    kryss: t.data.kryss
  }));
  const V = NATURLAG.find(t => t.dekning),
    DV = V ? data(V) : null;
  return byggEgneRader(e, e === null ? null : mine()[e].tall, R, !ingenPlan(), GK, tema, DV ? DV.gap : null);
}
/* Et tegnet område byttes mellom utbygging og ikke utbygging. */
export function settType(g, type) {
  if (g.deler[0].type === type) return;
  g.deler[0].type = type;
  g.f.set('type', type);
  egneEndret();
}
export function slettEget(g) {
  app.egne.splice(app.egne.indexOf(g), 1);
  egneEndret();
}
export function visEgetIKartet(g) {
  view.fit(app.klipp ? ol.extent.getIntersection(g.ext, app.klipp.getExtent()) : g.ext, {
    padding: [56, 56, 56, 56],
    minResolution: OPPLOSNINGER[13],
    duration: 300
  });
  tilKartet();
}
export function egenMaske(u) {
  const deler = [];
  for (const x of mine())
    if (ol.extent.intersects(x.ext, u))
      for (const del of x.deler) if (ol.extent.intersects(del.ext, u)) deler.push(del);
  if (!deler.length) return null;
  const c = lerret(),
    g = c.getContext('2d', { willReadFrequently: true }),
    s = 512 / (u[2] - u[0]);
  for (const type of ['fri', 'bygg']) {
    g.fillStyle = type === 'bygg' ? '#f00' : '#0f0';
    for (const del of deler)
      if (del.type === type) {
        kommuneSti(g, del.geom, u, s);
        g.fill('evenodd');
      }
  }
  const a = g.getImageData(0, 0, 512, 512).data,
    ut = new Uint8Array(262144);
  for (let i = 0, q = 0; i < a.length; i += 4, q++) if (a[i + 3] >= 128) ut[q] = a[i] > a[i + 1] ? 1 : 2;
  return ut;
}
