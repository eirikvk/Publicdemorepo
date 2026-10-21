/* Tester for stegene i infoboksene (src/ui/forklaringer.ts). Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { infostegFor, kortet } from '../src/ui/forklaringer.ts';

/* Kildene i kortet med sølvtabellene de justeres til, som «bronse.x: solv.y + solv.z» */
const kilder = (id: string) =>
  infostegFor(kortet(id)).flatMap(i =>
    'kilde' in i ? [`${i.kilde.navn}: ${i.justeres.map(j => j.navn).join(' + ')}`] : []
  );

test('infoboksen: hver kilde står sammen med det den justeres til i sølv', () => {
  assert.ok(kilder('vern').includes('bronse.verneomrader: solv.verneomrader + solv.vernAndel + solv.verneformAndel'));
  /* en sølvtabell uten egen kilde hører til kilden for tabellen den bygger på */
  /* verdsatt natur med og uten fast verdi er ett datasett, med én henting */
  assert.ok(
    kilder('verdi').includes('bronse.verdsattNatur: solv.verdsattNatur + solv.verdsattAndel + solv.vurderesAndel')
  );
  assert.ok(kilder('verdi').includes('bronse.kartlagt: solv.kartlagt + solv.kartlagtAndel'));
  /* arealet av grått areal regnes i gull, så sølv har bare trinnet per rute */
  assert.ok(kilder('graa').includes('bronse.graabit: solv.graabit'));
  /* egne områder i ruter hører til egne områder, ikke til rutestørrelsen */
  assert.ok(kilder('egne').includes('bronse.egne: solv.egne + solv.egneruter'));
});

test('datasettene i sølv: bare bronse og sølv, data i hvert, støttedata i et datasett eller for seg, og i gull det kortene viser som data', async () => {
  const { katalog, DATASETT } = await import('../src/data/katalog.ts');
  const alle = Object.values(katalog).flatMap(l => Object.values(l)) as {
    lag: string;
    navn: string;
    datasett?: unknown;
    stotte?: boolean;
    innhold?: string;
  }[];
  for (const t of alle) {
    if (t.datasett)
      assert.ok(t.lag === 'bronse' || t.lag === 'solv', `${t.lag}.${t.navn} kan ikke høre til et datasett`);
    if (t.datasett || t.stotte) assert.ok(t.innhold, `${t.lag}.${t.navn} mangler innholdet`);
  }
  /* tabellene med ruter sier hvilken verdi som betyr at ruta ikke har data (tom), også når ingen verdi gjør det (null) */
  for (const t of alle as { lag: string; navn: string; radform?: unknown }[])
    if (t.radform === 'ruter') assert.ok('tom' in t, `${t.lag}.${t.navn} sier ikke hvilken verdi som er tom`);
  /* i gull er det sidene viser (tabellene i et kort), data, og alt annet støttedata: mellomregninger og hurtigminne */
  const { KORT } = await import('../src/ui/forklaringer.ts'),
    vist = new Set(KORT.flatMap(k => k.tabeller));
  for (const t of alle.filter(t => t.lag === 'gull'))
    assert.equal(
      !!t.stotte,
      !vist.has(`gull.${t.navn}`),
      `gull.${t.navn} ${t.stotte ? 'er støttedata, men vises i et kort' : 'vises ikke i noe kort, men er ikke støttedata'}`
    );
  for (const d of Object.values(DATASETT)) {
    const I = alle.filter(t => t.datasett === d);
    assert.ok(
      I.some(t => !t.stotte),
      `${d.navn} har ingen data`
    );
  }
  /* kommuneplanen: kartbildene er dataene, dekningen og oversikten er støttedata */
  const ds = (n: string) => alle.find(t => `${t.lag}.${t.navn}` === n)!;
  assert.equal(ds('bronse.planflis').datasett, DATASETT.utbyggingsareal);
  assert.ok(!ds('bronse.planflis').stotte && !ds('solv.kommuneplanruter').stotte);
  assert.ok(ds('bronse.planbit').stotte && ds('bronse.planoversikt').stotte && ds('bronse.planopplysninger').stotte);
  /* verneområdene: flatene er dataene, rutene er støttedata, og arealet regnes i gull */
  assert.equal(ds('solv.verneomrader').datasett, DATASETT.vern);
  assert.ok(!ds('bronse.verneomrader').stotte && !ds('solv.verneomrader').stotte);
  assert.ok(ds('solv.vernAndel').stotte && ds('solv.verneformAndel').stotte);
  /* de andre naturtemaene på samme måte: flatene er dataene, rutene støttedata, og ingen kryssing av to datasett i sølv */
  for (const [data, stotte] of [
    ['solv.villrein', ['solv.villreinAndel']],
    ['solv.verdsattNatur', ['solv.verdsattAndel', 'solv.vurderesAndel']],
    ['solv.kartlagt', ['solv.kartlagtAndel']]
  ] as [string, string[]][]) {
    assert.ok(ds(data).datasett && !ds(data).stotte, `${data} er data`);
    for (const n of stotte)
      assert.ok(ds(n).stotte && ds(n).datasett === ds(data).datasett, `${n} er støttedata til ${data}`);
  }
  assert.ok(!alle.some(t => t.lag !== 'gull' && ['verdsattVurderes', 'verdsattIKartlagtAndel'].includes(t.navn)));
  assert.equal(ds('gull.naturoppslag').lag, 'gull');
  /* grunnkartet: klassene og detaljklassene er én tabell i sølv */
  assert.equal(ds('solv.klasser').datasett, DATASETT.grunnkart);
  assert.ok(!alle.some(t => t.navn === 'detaljklasser'));
  /* hva hver støttedata er til for, står på datasettet med det samme navnet som en av støttetabellene (i bronse med hvordan den
     hentes etter komma) */
  for (const d of Object.values(DATASETT))
    for (const [navn] of (d as { stotte?: [string, string][] }).stotte || [])
      assert.ok(
        alle.some(t => t.datasett === d && t.stotte && (t as { tittel?: string }).tittel!.split(', ')[0] === navn),
        `${navn} finnes ikke blant støttedataene i ${d.navn}`
      );
});

test('infoboksen for ett tall: kildene først, bare data som steg, og tallet til slutt', async () => {
  const { KORT, linjeFor, kortet: kortMed } = await import('../src/ui/forklaringer.ts');
  for (const k of KORT) {
    assert.ok(k.regnestykke || k.tall, `${k.id} mangler regnestykket`);
    for (const t of Object.keys(k.tall || {}))
      assert.ok(k.tabeller.includes(t), `${k.id}: ${t} er ikke et tall i kortet`);
    /* et kort med én infoboks per tall har en for hvert tall, med sin egen korte forklaring, og kortets er dem etter hverandre */
    if (k.tall) {
      for (const t of k.tabeller) assert.ok(k.tall[t] && k.tall[t].kortFortalt, `${k.id}: ${t} mangler infoboksen`);
      assert.equal(k.kortFortalt, k.tabeller.map(t => k.tall![t].kortFortalt).join(' '));
    }
    for (const t of k.tabeller) {
      const L = linjeFor(k, t),
        S = L.steg.map(s => s.steg);
      /* støttedata og tekniske tabeller er aldri egne steg, og tallet står til slutt */
      for (const s of S) assert.ok(!s.tabell.stotte && !s.tabell.teknisk, `${k.id}, ${t}: ${s.navn} er ikke data`);
      assert.equal(S[S.length - 1]?.navn, t, `${k.id}: ${t} står ikke til slutt`);
      /* kildene har bare tabeller i bronse og sølv, og ingen tekniske */
      for (const q of L.kilder)
        for (const s of q.tabeller)
          assert.ok(!s.navn.startsWith('gull.') && !s.tabell.teknisk, `${k.id}, ${t}: ${s.navn}`);
    }
  }
  const k = kortMed('verdi'),
    L = linjeFor(k, 'gull.verdsattNatur');
  /* verdsatt natur: Miljødirektoratet først, kommunene til slutt, og arealet per verdi som mellomregning */
  assert.deepEqual(
    L.kilder.map(q => q.datasett && q.datasett.navn),
    ['Verdsatt natur', 'Syntetisk naturregnskap fra SSB', 'Kommunene']
  );
  const steg = L.steg[L.steg.length - 1];
  assert.ok(steg.underveis.some(u => u.navn === 'gull.verdsattAreal'));
  /* seksjonen står på egne bein: et annet tall i kortet er et vanlig steg, og utbyggingen er med, med kildene sine */
  const K = linjeFor(k, 'gull.verdsattNaturKartlagt');
  assert.deepEqual(
    K.steg.map(s => s.steg.navn),
    ['gull.verdsattNatur', 'gull.verdsattNaturKartlagt']
  );
  const G = linjeFor(k, 'gull.utbyggingUtenforKartlagt'),
    navn = G.kilder.map(q => q.datasett && q.datasett.navn);
  for (const d of ['Kartlagt for naturtyper', 'Arealklasser fra grunnkartet', 'Kommunene'])
    assert.ok(navn.includes(d), `utbygging utenfor det kartlagte mangler ${d}`);
  assert.ok(G.steg.some(s => s.underveis.some(u => u.navn === 'gull.utbygging')));
  /* alle kildene i kortet har sin egen beskrivelse */
  for (const t of k.tabeller)
    for (const q of linjeFor(k, t).kilder)
      for (const x of q.kilder) assert.ok(x.beskrivelse, `${x.datasett} mangler beskrivelsen`);
});
