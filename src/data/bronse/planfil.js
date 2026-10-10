/* Bronse for en opplastet planfil: GeoJSON i samme format som DiBKs nedlasting av plandata, med arealformål og arealbruksstatus.
   Filen leses i nettleseren og sendes ingen steder. Flatene gjøres om til UTM33. */
import { UTM, flerflate, utsnitt } from '../solv/felles.js';
import { kjent, tilUTM } from '../solv/projeksjoner.js';

/* Sifrene i en egenskap, som tekst. Tom tekst hvis det ikke er noen. */
const siffer = v => {
  const m = /\d+/.exec(v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  return m ? m[0] : '';
};
/* Den første av egenskapene som finnes, også én nivå ned (arealplanId.kommunenummer) */
const egenskap = (p, ...navn) => {
  for (const n of navn) {
    if (p[n] !== undefined && p[n] !== null) return p[n];
    const [a, b] = n.split('.');
    if (b && p[a] && p[a][b] !== undefined) return p[a][b];
  }
  return undefined;
};
/* Projeksjonen: oppgitt i filen, ellers gjettet: grader, eller den UTM-sonen som legger planen nærmest punktet mot */
function finnProjeksjon(j, punkt, mot) {
  const navn = j.crs && j.crs.properties ? String(j.crs.properties.name || '') : '',
    m = /EPSG:+(\d+)/.exec(navn);
  if (m && kjent('EPSG:' + m[1])) return 'EPSG:' + m[1];
  if (/CRS84/.test(navn) || (Math.abs(punkt[0]) <= 180 && Math.abs(punkt[1]) <= 90)) return 'EPSG:4326';
  let best = UTM,
    min = Infinity;
  for (const kode of [UTM, 'EPSG:25832', 'EPSG:25835']) {
    const q = tilUTM(kode)(punkt),
      a = mot ? Math.hypot(q[0] - mot[0], q[1] - mot[1]) : 0;
    if (a < min) {
      min = a;
      best = kode;
    }
  }
  return best;
}
/* Tolker innholdet i en planfil. valgtNr er kommunen som er valgt nå, erKommune sier om et nummer er en kommune, og midtAv gir et
   punkt midt i en kommune, brukt til å gjette projeksjonen. Gir { feil } med hva som er galt (ingenFlater, ingenKommune eller
   ulesbareFlater), eller flatene i UTM33 med arealformål og status (sifrene), og opplysningene om planen. Endrer ingenting. */
export function lesPlanfil(j, valgtNr, erKommune, midtAv) {
  const alle = (j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : j.features) || [];
  const polygoner = alle.filter(
    f =>
      f &&
      f.geometry &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
      f.geometry.coordinates &&
      f.geometry.coordinates.length
  );
  if (!polygoner.length) return { feil: 'ingenFlater' };
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
  if (!nr) return { feil: 'ingenKommune' };
  const g0 = bruk[0].geometry,
    punkt = g0.type === 'Polygon' ? g0.coordinates[0][0] : g0.coordinates[0][0][0];
  const proj = finnProjeksjon(j, punkt, midtAv(nr)),
    om = tilUTM(proj),
    deler = [];
  const ext = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of bruk) {
    let koord;
    try {
      koord = flerflate(f.geometry).map(flate => flate.map(ring => ring.map(om)));
    } catch (e) {
      continue;
    }
    const p = f.properties || {},
      formal = siffer(egenskap(p, 'arealformål', 'arealformal', 'arealformaal', 'Arealformål')),
      status = siffer(egenskap(p, 'arealbruksstatus', 'arealbrukstatus', 'Arealbruksstatus'));
    const e = utsnitt(koord);
    ext[0] = Math.min(ext[0], e[0]);
    ext[1] = Math.min(ext[1], e[1]);
    ext[2] = Math.max(ext[2], e[2]);
    ext[3] = Math.max(ext[3], e[3]);
    deler.push({ koord, ext: e, formal, status });
  }
  if (!deler.length) return { feil: 'ulesbareFlater' };
  const planid = String(
    bruk
      .map(f => egenskap(f.properties || {}, 'arealplanId.planidentifikasjon', 'planidentifikasjon'))
      .find(v => v !== undefined) || ''
  );
  return { nr, funnet, deler, ext, planid, utenFormal: !medFormal.length, proj };
}
