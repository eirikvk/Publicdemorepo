/* Tallene fra SSB: arealklasser, land og vann, og anslått utvikling. */
/* Land og vann: land, innsjø og elv er SSBs tall. Hav har SSB ikke tall for per kommune, så det regnes ut som
   kommunens flate (grensen fra Kartverket) minus land og ferskvann. */
let ferskvann = null, flate = 0;
function visVann() {
  const bar = $('bar2'), tegn = $('tegn2'), note = $('vannnote'); bar.textContent = tegn.textContent = note.textContent = ''; bar.removeAttribute('aria-label');
  if (!ssbSum || !ferskvann || !flate) return;
  let hav = flate ? flate - ssbSum - ferskvann.inn - ferskvann.elv : 0; if (hav < Math.max(0.5, flate * 0.005)) hav = 0;   /* små avvik mellom grense og statistikk er ikke hav */
  const deler = [['land', 'Land', ssbSum], ['inn', 'Innsjø', ferskvann.inn], ['elv', 'Elv', ferskvann.elv], ['hav', 'Hav', hav]].filter(d => d[2] > 0), sum = deler.reduce((s, d) => s + d[2], 0);
  deler.forEach(([id, navn, v]) => {
    const s = document.createElement('i'); s.style.cssText = `flex:${v} 1 0;background:var(--${id})`; s.title = `${navn}: ${dekar(v)}`; bar.appendChild(s);
    const t = document.createElement('span'); t.innerHTML = `<i style="background:var(--${id})"></i>${navn} <b></b>`; t.lastElementChild.textContent = `${id === 'hav' ? 'ca. ' : ''}${dekar(v)}`; tegn.appendChild(t);
  });
  bar.setAttribute('aria-label', deler.map(([, n, v]) => `${n} ${nf(v / sum * 100)} prosent`).join(', '));
  note.textContent = hav ? 'Land, innsjø og elv er SSBs tall. Hav er regnet ut som kommunens flate (grensen fra Kartverket) minus land og ferskvann.' : 'Land, innsjø og elv er SSBs tall. Kommunen har ikke hav.';
}
function visTall(a, aar) {
  const sum = a[0] + a[1] + a[2], bar = $('bar'); bar.textContent = ''; ssbSum = sum;
  $('tot').textContent = dekar(sum); $('aar').textContent = aar;
  bar.setAttribute('aria-label', KL.map(([, n], i) => `${n} ${nf(a[i] / sum * 100)} prosent`).join(', '));
  KL.forEach(([id, navn], i) => {
    const p = a[i] / sum * 100, s = document.createElement('i');
    s.style.cssText = `flex:${Math.max(a[i], 0.0001)} 1 0;background:var(--${id})`; s.title = `${navn}: ${dekar(a[i])}, ${nf(p)} %`; bar.appendChild(s);
    $('km-' + id).textContent = dekar(a[i]);
    $('pc-' + id).textContent = p > 0 && p < 0.1 ? '< 0,1 %' : nf(p) + ' %';
  });
}
function tomTall(tekst) { ssbSum = 0; ferskvann = null; visVann(); $('tot').textContent = tekst; $('bar').textContent = ''; KL.forEach(([id]) => { $('km-' + id).textContent = '–'; $('pc-' + id).textContent = '–' }) }

/* SSB har to API-er til samme tabell. Det nye brukes først. Svarer det ikke, spørres det eldre om det samme.
   Det eldre tar spørringen som tekst i et POST-kall, og har ikke «fra og med år», så tidsserien kommer med alle år. */
const SSB0 = 'https://data.ssb.no/api/v0/no/table/09594';
async function hentSSB(hva, nytt, region, koder, tid) {
  try { return await hent('SSB', hva, nytt) } catch (e) {}
  const valg = (code, filter, values) => ({ code, selection: { filter, values } });
  return hent('SSB', hva + ', eldre API', SSB0, false, false, false, JSON.stringify({ query: [valg('Region', ...region), valg('ArealKlasse', 'item', koder), valg('ContentsCode', 'item', ['Areal']), valg('Tid', ...tid)], response: { format: 'json-stat2' } }));
}
async function hentTall(k, mitt) {
  const koder = [...KL.flatMap(x => x[3]), ...VANN.map(x => x[3]).filter(Boolean)].join(',');
  try {
    const j = await hentSSB(`Areal for ${k.navn}`, `${SSB}?lang=no&outputformat=json-stat2&valueCodes[Region]=${k.nr}&valueCodes[ArealKlasse]=${koder}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=top(1)`, ['item', [k.nr]], koder.split(','), ['top', ['1']]);
    if (mitt !== valgNr) return;
    const ix = j.dimension.ArealKlasse.category.index, tid = j.dimension.Tid.category.index;
    const pos = Array.isArray(ix) ? Object.fromEntries(ix.map((c, i) => [c, i])) : ix;
    ferskvann = { inn: j.value[pos['22.01']] || 0, elv: j.value[pos['22.02']] || 0 };
    visTall(KL.map(x => x[3].reduce((s, c) => s + (j.value[pos[c]] || 0), 0)), Array.isArray(tid) ? tid[0] : Object.keys(tid)[0]); visVann(); NATURLAG.forEach(visNatur); visInon(); visGraa();
  } catch (e) { if (mitt === valgNr) tomTall('Tallene kunne ikke hentes') }
}
/* Anslått utvikling på tre tidspunkt: SSBs tall for 2017, SSBs nyeste tall, og nyeste tall med planlagt utbygging trukket fra natur
   og jordbruk og lagt til bebygd. SSB advarer mot å lese forskjeller mellom årganger som endring, så dette er et anslag og merkes slik.
   Tallene for 2017 hentes med SSBs sammenslåtte tidsserier, så de gjelder dagens kommune også der kommuner er slått sammen.
   Er kommunens samlede flate likevel en annen i 2017, er grensen flyttet, og da vises ingen sammenligning. */
let historie = null, planSum = null;
async function hentHistorie(k, mitt) {
  const koder = [...KL.flatMap(x => x[3]), ...VANN.map(x => x[3]).filter(Boolean)].join(',');
  try {
    const j = await hentSSB(`Areal fra 2017 for ${k.navn}`, `${SSB}?lang=no&outputformat=json-stat2&codelist[Region]=agg_KommSummer&outputValues[Region]=aggregated&valueCodes[Region]=K-${k.nr}&valueCodes[ArealKlasse]=${koder}&valueCodes[ContentsCode]=Areal&valueCodes[Tid]=from(2017)`, ['agg:KommSummer', ['K-' + k.nr]], koder.split(','), ['all', ['*']]);
    if (mitt !== valgNr) return;
    const liste = x => Array.isArray(x) ? x : Object.keys(x).sort((a, b) => x[a] - x[b]), kl = liste(j.dimension.ArealKlasse.category.index), aar = liste(j.dimension.Tid.category.index), nT = aar.length;
    const v = (c, t) => j.value[kl.indexOf(c) * nT + t] || 0, sum = t => KL.map(x => x[3].reduce((s, c) => s + v(c, t), 0)), alt = t => sum(t).reduce((s, x) => s + x, 0) + v('22.01', t) + v('22.02', t);
    const f = aar.indexOf('2017'); if (f < 0 || nT - f < 2 || !alt(f) || !alt(nT - 1)) return;
    historie = { nr: k.nr, fra: aar[f], til: aar[nT - 1], a0: sum(f), a1: sum(nT - 1), endret: Math.abs(alt(nT - 1) - alt(f)) / alt(nT - 1) > 0.005 };
    visUtvikling();
  } catch (e) {}   /* uten historiske tall vises ikke blokken */
}
function visUtvikling() {
  const H = historie && valgt && historie.nr === valgt.nr ? historie : null, tab = $('utvtab'), tekst = $('utvsum'), note = $('utvnote');
  $('utvikling').hidden = !H; tab.textContent = tekst.textContent = note.textContent = ''; if (!H) return;
  tab.hidden = H.endret;
  if (H.endret) { tekst.textContent = `Kommunens flate er ikke den samme i SSBs tall for ${H.fra} og ${H.til}, trolig fordi grensen er flyttet. Tallene kan derfor ikke sammenlignes.`; return }
  const P = planSum && planSum.nr === valgt.nr && !utenPlan() ? planSum : null, etter = P ? [H.a1[0] + P.nat + P.jor, H.a1[1] - P.jor, H.a1[2] - P.nat] : null;
  const hele = km2 => nf(Math.round(km2 * 1000), 0), endr = km2 => { const d = Math.round(km2 * 1000); return d ? (d < 0 ? '−' : '+') + nf(Math.abs(d), 0) : '0' };
  const celle = (rad, tall, d, type = 'td') => { const c = document.createElement(type); c.textContent = tall; if (d !== undefined) { const m = document.createElement('small'); m.textContent = d; c.appendChild(m) } rad.appendChild(c); return c };
  const hode = tab.createTHead().insertRow(); [['daa'], [H.fra], [H.til], [P && P.egne ? 'Med planlagt utbygging og egne områder' : 'Med planlagt utbygging']].forEach(([t]) => { celle(hode, t, undefined, 'th').scope = 'col' });
  const kropp = tab.createTBody();
  KL.forEach(([id, navn], i) => {
    const r = kropp.insertRow(), h = celle(r, '', undefined, 'th'); h.scope = 'row'; h.innerHTML = `<i style="--c:var(--${id})"></i>`; h.appendChild(document.createTextNode(navn));
    celle(r, hele(H.a0[i])); celle(r, hele(H.a1[i]), endr(H.a1[i] - H.a0[i]));
    if (etter) celle(r, hele(etter[i]), endr(etter[i] - H.a1[i])); else celle(r, '–');
  });
  const siden = KL.map(([, navn], i) => { const d = H.a1[i] - H.a0[i]; return `${navn.toLowerCase()} ${Math.round(d * 1000) ? `${d < 0 ? 'ned' : 'opp'} ${iTekst(Math.abs(d))} (${H.a0[i] ? nf(Math.abs(d) / H.a0[i] * 100) : '0'} %)` : 'uendret'}` }).reverse().join(', ');
  tekst.textContent = `Fra ${H.fra} til ${H.til}: ${siden}.` + (P ? ` Bygges alt kommuneplanen setter av, går ca. ${iTekst(P.nat)} natur og ca. ${iTekst(P.jor)} jordbruk over til bebygd.${P.delvis ? ' Det gjelder bare den delen av kommunen nettleseren har hentet kart for.' : ''}`
    : utenPlan() ? ' DiBK har ingen kommuneplan for kommunen, så siste kolonne er tom.' : !oversikter[valgt.nr] ? ' Zoom inn i kartet for å få et anslag på planlagt utbygging i siste kolonne.' : ' Siste kolonne fylles ut når planlagt utbygging er regnet ut.');
  note.textContent = `Anslag, ikke statistikk over endring. SSB skriver at tabellen ikke kan brukes til å beregne arealendringer mellom årganger, fordi datagrunnlaget blir mer fullstendig over tid. Noe av forskjellen fra ${H.fra} kan derfor skyldes bedre kartlegging. SSB har varslet egne tabeller for arealendringer. Planlagt utbygging er regnet ut i nettleseren uten smale striper.`;
}
