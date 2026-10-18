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
  assert.ok(kilder('vern').includes('bronse.verneomrader: solv.verneomrader + solv.vernAndel'));
  /* en sølvtabell uten egen kilde hører til kilden for tabellen den bygger på */
  assert.ok(kilder('verdi').includes('bronse.verdsattNatur: solv.verdsattNatur + solv.verdsattAndel'));
  /* én kilde kan justeres til to sølvtabeller */
  assert.ok(kilder('graa').includes('bronse.graabit: solv.graabit + solv.graa'));
  /* egne områder i ruter hører til egne områder, ikke til rutestørrelsen */
  assert.ok(kilder('egne').includes('bronse.egne: solv.egne + solv.egneruter'));
});
