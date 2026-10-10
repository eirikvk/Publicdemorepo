/* Naturtemaene fra Miljødirektoratet: verneområder, villreinområder og verdsatt natur. Arealet av hvert tema i kommunen,
   kartleggingsgraden for verdsatt natur, og kryssingen med planrutenettet: hvor mye planlagt utbygging som ligger i hvert område.
   Flatene kommer som GeoJSON. En kommune er { koord, ext }: flerflaten og utsnittet. Arealer er i km² i terrenget. */
import polygonClipping from 'polygon-clipping';
import {
  HALV,
  RUTENETT_MASKE,
  RUTENETT_VERDI,
  areal,
  flerflate,
  m2PerKm2,
  omriss,
  ruteX,
  ruteY,
  rutenett,
  snitt,
  tomt
} from './felles.js';
import { sti, tegneflate } from './raster.js';

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

/* Omløpsretningen til en ring: true når den går mot klokka */
const motKlokka = ring => {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return a > 0;
};
/* Verdsatt natur: mange små flater som overlapper. Arealet per verdikategori finnes ved å tegne flatene i et rutenett over kommunen
   og summere dekningen i rutene. Én tegning per kategori, der alle flater med minst den verdien tegnes som én sammenhengende form og
   klippes mot kommunen. Forskjellen mellom tegningene gir arealet per kategori uten dobbelttelling: der lokaliteter overlapper,
   teller den høyeste verdien, slik kartet også viser det. omrader har verdien v (0 er høyest). innenfor er en flerflate arealet
   også klippes mot, for eksempel det kartlagte. */
export function klasseAreal(omrader, antall, kommune, innenfor) {
  const skala = m2PerKm2(kommune.ext),
    { res, w, h, u } = rutenett(kommune.ext, ...RUTENETT_VERDI);
  const g = tegneflate(w, h),
    kum = [];
  for (let v = 0; v < antall && omrader.length; v++) {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, w, h);
    g.beginPath();
    for (const o of omrader) {
      if ((o.v || 0) > v) continue;
      for (const flate of o.koord)
        flate.forEach((ring, nr) => {
          /* ytterkanter én vei og hull motsatt vei, så overlapp fylles og hull blir hull */
          const snu = motKlokka(ring) !== (nr === 0),
            n = ring.length;
          for (let i = 0; i < n; i++) {
            const q = ring[snu ? n - 1 - i : i],
              x = (q[0] - u[0]) / res,
              y = (u[3] - q[1]) / res;
            if (i) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.closePath();
        });
    }
    g.fill('nonzero');
    g.globalCompositeOperation = 'destination-in';
    sti(g, kommune.koord, u, 1 / res);
    g.fill('evenodd');
    if (innenfor) {
      sti(g, innenfor, u, 1 / res);
      g.fill('evenodd');
    }
    const d = g.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let i = 3; i < d.length; i += 4) sum += d[i];
    kum.push(((sum / 255) * res * res) / skala);
  }
  return {
    klasser: Array.from({ length: antall }, (_, v) => Math.max(0, (kum[v] || 0) - (v ? kum[v - 1] || 0 : 0))),
    sum: kum.length ? kum[kum.length - 1] : 0
  };
}

/* Verdsatt natur: områdene med areal hver for seg (uklippet, til listen) og arealet per verdikategori i kommunen. antall er antall
   verdikategorier, eller null for et tema uten. Områdene sorteres med høyest verdi først, så en planrute der lokaliteter overlapper,
   regnes til den høyeste. */
export function samleNatur(features, kommune, les, antall) {
  const skala = m2PerKm2(kommune.ext);
  const omrader = features
    .filter(f => f.geometry && f.geometry.coordinates)
    .map(f => {
      const koord = flerflate(f.geometry);
      return { koord, uklippet: false, km2: koord.length ? areal(koord) / skala : 0, ...les(f.properties || {}) };
    })
    .sort((a, b) => (a.v || 0) - (b.v || 0) || b.km2 - a.km2);
  const r = klasseAreal(omrader, antall || 1, kommune);
  return { omrader, klasser: antall ? r.klasser : null, sum: r.sum };
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

/* Kryssing med planrutenettet: midtpunktet i hver rute med planlagt utbygging slås opp i maskene for temaets områder. En rute telles
   én gang per tema, i det første området den treffer. D er temaets data (områdene og eventuelt kartleggingen), R planrutenettet,
   nK antall verdikategorier, medDekning om utbygging på natur skal deles i kartlagt og ikke kartlagt, og kommune flaten uklippede
   områder klippes mot.
   Gir ruter per område (plan, og smal for ruter i smale striper), per verdikategori for planen med egne områder (S) og planen alene
   (P), og gap: ruter med planlagt utbygging på natur, og hvor mange av dem som ligger utenfor det kartlagte. Maskene lages første
   gang de trengs og huskes på områdene (o.maske, D.ekstra.maske). */
export function kryssNatur(D, R, nK, medDekning, kommune) {
  const B = R.basis || null,
    nE = R.eget ? R.antallEgne : 0,
    O = D.omrader;
  const tom = () => ({ alt: new Int32Array(nK), eg: Array.from({ length: nE }, () => new Int32Array(nK)) }),
    S = tom(),
    P = tom();
  const plan = new Int32Array(O.length),
    smal = new Int32Array(O.length);
  const fjernet = i => B.ryddet[i] && R.alle[i] !== 1 && R.alle[i] !== 2; /* i planen, tatt ut av et eget område */
  if (O.length) {
    const treff = i => {
      /* nummeret til området ruta ligger i, eller -1 */
      const x = ruteX(R, i),
        y = ruteY(R, i);
      for (let a = 0; a < O.length; a++) {
        const o = O[a];
        if (x < o.ext[0] || x > o.ext[2] || y < o.ext[1] || y > o.ext[3]) continue;
        const M = o.maske || (o.maske = naturMaske(o, o.uklippet ? kommune : null));
        if (!M) continue;
        const px = Math.floor((x - M.u[0]) / M.res),
          py = Math.floor((M.u[3] - y) / M.res);
        if (px < 0 || py < 0 || px >= M.w || py >= M.h || M.a[py * M.w + px] < HALV) continue;
        return a;
      }
      return -1;
    };
    for (const i of R.celler) {
      const a = treff(i);
      if (a < 0) continue;
      const v = O[a].v || 0,
        e = nE ? R.eget[i] : 0;
      if (R.ryddet[i]) {
        plan[a]++;
        S.alt[v]++;
        if (e) S.eg[e - 1][v]++;
      } else smal[a]++;
      if (B && B.ryddet[i]) {
        P.alt[v]++;
        if (e) P.eg[e - 1][v]++;
      }
    }
    if (B)
      for (const i of B.celler) {
        if (!fjernet(i)) continue;
        const a = treff(i);
        if (a < 0) continue;
        const v = O[a].v || 0,
          e = R.eget[i];
        P.alt[v]++;
        if (e) P.eg[e - 1][v]++;
      }
  }
  let gap = null;
  if (medDekning && D.ekstra) {
    /* ruter med planlagt utbygging på natur, uten smale striper, delt på kartlagt og ikke kartlagt */
    const E = D.ekstra,
      M =
        E.flate && E.flate.length
          ? E.maske || (E.maske = naturMaske({ koord: E.flate, ext: omriss(E.flate) }, null))
          : null;
    const ukjentRute = i => {
      if (!M) return true;
      const px = Math.floor((ruteX(R, i) - M.u[0]) / M.res),
        py = Math.floor((M.u[3] - ruteY(R, i)) / M.res);
      return px < 0 || py < 0 || px >= M.w || py >= M.h || M.a[py * M.w + px] < HALV;
    };
    const ny = () => ({ nat: 0, ukjent: 0, eg: Array.from({ length: nE }, () => ({ nat: 0, ukjent: 0 })) }),
      G = ny(),
      GP = ny();
    const tell = (T, i, uk) => {
      const e = nE ? R.eget[i] : 0;
      T.nat++;
      if (uk) T.ukjent++;
      if (e) {
        T.eg[e - 1].nat++;
        if (uk) T.eg[e - 1].ukjent++;
      }
    };
    for (const i of R.celler) {
      const s = R.ryddet[i] === 1,
        b = !!B && B.ryddet[i] === 1;
      if (!s && !b) continue;
      const uk = ukjentRute(i);
      if (s) tell(G, i, uk);
      if (b) tell(GP, i, uk);
    }
    if (B) for (const i of B.celler) if (B.ryddet[i] === 1 && fjernet(i)) tell(GP, i, ukjentRute(i));
    gap = { nat: G.nat, ukjent: G.ukjent, eg: G.eg, plan: B ? GP : null };
  }
  return { kryss: { S, P: B ? P : null }, gap, plan, smal };
}

/* Tallene som vises for et naturtema, regnet ut fra områdene. D er temaets data, klasser verdikategoriene hvis temaet har det,
   medDekning om temaet har kartleggingsgrad, samlet om bare berørte områder skal listes, og land landarealet i km².
   Gir per verdikategori antall lokaliteter og ruter med planlagt utbygging, helhetsbildet (landarealet delt i kartlagt og ikke
   kartlagt, og verdsatt natur i hver del), ruter med planlagt utbygging og i smale striper, antall områder som berøres, og
   områdene som skal listes. */
export function byggNaturTall(D, klasser, medDekning, samlet, land) {
  const o = D.omrader,
    E = D.ekstra;
  const perKlasse =
    klasser && D.klasser && o.length
      ? klasser.map((_, v) => {
          const av = o.filter(x => x.v === v);
          return { antall: av.length, plan: av.reduce((s, x) => s + x.plan, 0) };
        })
      : null;
  let helhet = null;
  if (medDekning && E && E.km2 > 0 && E.inne && D.klasser && land > 0 && o.length > 0) {
    const L = land,
      K = Math.min(E.km2, L),
      U = Math.max(0, L - K),
      inne = E.inne,
      ute = D.klasser.map((a, v) => Math.max(0, a - inne[v]));
    helhet = { L, K, U, inne, ute, si: inne.reduce((a, b) => a + b, 0), su: ute.reduce((a, b) => a + b, 0) };
  }
  return {
    klasser: perKlasse,
    helhet,
    plan: o.reduce((s, x) => s + x.plan, 0),
    smal: o.reduce((s, x) => s + x.smal, 0),
    berort: o.filter(x => x.plan).length,
    vises: samlet ? o.filter(x => x.plan).sort((a, b) => b.plan - a.plan) : o
  };
}
