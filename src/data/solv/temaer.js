/* Sølv for naturtemaene fra Miljødirektoratet: verneområder, villreinområder og verdsatt natur. Flatene gjøres om til felles form:
   klippet mot kommunen og med areal i km², og som masker i et rutenett når de skal krysses med planrutenettet. Også det kartlagte
   området for naturtyper. Flatene kommer som GeoJSON. */
import polygonClipping from 'polygon-clipping';
import { RUTENETT_MASKE, areal, flerflate, m2PerKm2, omriss, snitt, tomt } from './felles.js';
import { sti, tegneflate } from './raster.js';

/* Egenskapene til flatene i hvert tema gjort om til felles form: navn, lenke til faktaark, en kort beskrivelse (under) og, for
   verdsatt natur, verdikategorien v (0 svært stor, 1 stor, 2 middels, 3 noe verdi). */
export const EGENSKAPER = {
  vern: p => ({
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
  }),
  rein: p => ({
    navn: String(p['villreinområdeNavn'] || 'Uten navn').replace(/\s*-\s*leveområde\s*$/i, ''),
    url: p.faktaark || '',
    under: [
      p['villreinområdeNasjonalt'] === 'Ja' ? 'Nasjonalt villreinområde' : 'Villreinområde',
      p.funksjon ? String(p.funksjon).toLowerCase() : '',
      p.funksjonsperiode ? String(p.funksjonsperiode).toLowerCase() : ''
    ]
      .filter(Boolean)
      .join(', ')
  }),
  verdi: p => ({
    navn: p['Områdenavn'] || p.Naturtype || 'Uten navn',
    url: p.FaktaarkLokalitet || p.Faktaark || '',
    v: Math.max(0, ['Svært stor verdi', 'Stor verdi', 'Middels verdi', 'Noe verdi'].indexOf(p.Verdikategori)),
    under: [p.Naturtype, String(p.Verdikategori || '').toLowerCase()].filter(Boolean).join(', ')
  })
};

/* Et område som et lite rutenett med dekningen per rute (a, 0–255), til oppslag fra planrutenettet. flate er { koord, ext }.
   kommune oppgis bare når flaten ikke alt er klippet mot kommunen. m2 er arealet i kartets kvadratmeter. */
export function naturMaske(flate, kommune) {
  const e = kommune ? snitt(flate.ext, kommune.ext) : flate.ext;
  if (tomt(e)) return null;
  const [maks, minst] = RUTENETT_MASKE,
    res = Math.max(minst, Math.max(e[2] - e[0], e[3] - e[1]) / maks),
    w = Math.ceil((e[2] - e[0]) / res) + 1,
    h = Math.ceil((e[3] - e[1]) / res) + 1,
    u = [e[0], e[3] - h * res, e[0] + w * res, e[3]];
  const k = tegneflate(w, h);
  sti(k, flate.koord, u, 1 / res);
  k.fill('evenodd');
  if (kommune) {
    k.globalCompositeOperation = 'destination-in';
    sti(k, kommune.koord, u, 1 / res);
    k.fill('evenodd');
  }
  const d = k.getImageData(0, 0, w, h).data,
    a = new Uint8Array(w * h);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    a[i] = d[4 * i + 3];
    sum += a[i];
  }
  return { u, res, w, h, a, m2: (sum / 255) * res * res };
}

/* Verneområder og villreinområder: hver flate klippes mot kommunen, og arealet av det som ligger i kommunen regnes ut. Feiler
   klippingen, regnes arealet i stedet av flaten tegnet i et rutenett og klippet mot kommunen der (uklippet). les gir navn og
   opplysninger fra egenskapene. Gir områdene sortert etter areal, størst først. Overlapper to flater, telles overlappet to ganger. */
export function klippNatur(features, kommune, les) {
  const skala = m2PerKm2(kommune.ext);
  return features
    .map(f => {
      const g = f.geometry;
      if (!g || !g.coordinates) return null;
      const hele = flerflate(g);
      let koord = null,
        uklippet = false,
        km2;
      try {
        koord = polygonClipping.intersection(hele, kommune.koord);
      } catch (e) {
        koord = null;
      }
      if (koord) {
        if (!koord.length) return null;
        km2 = areal(koord) / skala;
      } else {
        koord = hele;
        uklippet = true;
        const m = naturMaske({ koord: hele, ext: omriss(hele) }, kommune);
        if (!m || !(m.m2 > 0)) return null;
        km2 = m.m2 / skala;
      }
      return km2 > 0 ? { koord, uklippet, km2, ...les(f.properties || {}) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.km2 - a.km2);
}

/* Verdsatt natur: lokalitetene med areal hver for seg, uten klipping mot kommunen (til listen). Arealet per verdikategori i kommunen
   regnes ut i gull (klasseAreal). Lokalitetene sorteres med høyest verdi først (v = 0 er høyest), så en planrute der lokaliteter
   overlapper, regnes til den høyeste. */
export function lokaliteter(features, kommune, les) {
  const skala = m2PerKm2(kommune.ext);
  const omrader = features
    .filter(f => f.geometry && f.geometry.coordinates)
    .map(f => {
      const koord = flerflate(f.geometry);
      return { koord, uklippet: false, km2: koord.length ? areal(koord) / skala : 0, ...les(f.properties || {}) };
    })
    .sort((a, b) => (a.v || 0) - (b.v || 0) || b.km2 - a.km2);
  return omrader;
}

/* Kartleggingsgrad: dekningsflatene for naturtypekartlegging slått sammen og klippet mot kommunen. Gir det kartlagte arealet, flaten
   og årene kartleggingen er gjort. */
export function byggDekning(features, kommune) {
  const fl = features.filter(f => f.geometry && f.geometry.coordinates);
  if (!fl.length) return { km2: 0 };
  const u = polygonClipping.intersection(polygonClipping.union(...fl.map(f => flerflate(f.geometry))), kommune.koord);
  const aar = fl.map(f => parseInt((f.properties || {})['Årstall'], 10)).filter(v => v > 1900);
  return {
    km2: u.length ? areal(u) / m2PerKm2(kommune.ext) : 0,
    fra: aar.length ? Math.min(...aar) : null,
    til: aar.length ? Math.max(...aar) : null,
    flate: u,
    maske: null
  };
}
