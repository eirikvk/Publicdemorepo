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
  assert.ok(kilder('verdi').includes('bronse.verdsattNatur: solv.verdsattNatur + solv.verdsattAndel'));
  /* arealet av grått areal regnes i gull, så sølv har bare trinnet per rute */
  assert.ok(kilder('graa').includes('bronse.graabit: solv.graabit'));
  /* egne områder i ruter hører til egne områder, ikke til rutestørrelsen */
  assert.ok(kilder('egne').includes('bronse.egne: solv.egne + solv.egneruter'));
});

test('datasettene i sølv: bare bronse og sølv, data i hvert, støttedata bare i et datasett, og innholdet beskrevet', async () => {
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
    if (t.stotte) assert.ok(t.datasett, `${t.lag}.${t.navn} er støttedata uten datasett`);
    if (t.datasett) assert.ok(t.innhold, `${t.lag}.${t.navn} i et datasett mangler innholdet`);
  }
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
  /* grunnkartet: klassene og detaljklassene er én tabell i sølv */
  assert.equal(ds('solv.klasser').datasett, DATASETT.grunnkart);
  assert.ok(!alle.some(t => t.navn === 'detaljklasser'));
  /* hva hver støttedata er til for, står på datasettet med det samme navnet som en av støttetabellene (i bronse med hvordan den
     hentes etter komma) */
  for (const d of Object.values(DATASETT))
    for (const [navn] of d.stotte || [])
      assert.ok(
        alle.some(t => t.datasett === d && t.stotte && (t as { tittel?: string }).tittel!.split(', ')[0] === navn),
        `${navn} finnes ikke blant støttedataene i ${d.navn}`
      );
});
