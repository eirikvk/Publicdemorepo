/* Tester for bronse: henting av alle flatene fra Miljødirektoratets karttjenester, side for side. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hentTemaflater } from '../src/data/bronse/mdir-naturtema.ts';
import type { Kommune } from '../src/data/solv/felles.ts';

test('ArcGIS: flatene hentes side for side til svaret ikke sier at det er flere', async () => {
  const kall: URL[] = [],
    ekte = globalThis.fetch;
  /* En tjeneste som gir to flater per side, fem i alt */
  globalThis.fetch = (async (adresse: string) => {
    const u = new URL(adresse),
      fra = Number(u.searchParams.get('resultOffset'));
    kall.push(u);
    const features = [0, 1]
      .map(i => fra + i)
      .filter(i => i < 5)
      .map(id => ({ type: 'Feature', id, properties: {} }));
    return new Response(
      JSON.stringify({ type: 'FeatureCollection', features, ...(fra + 2 < 5 ? { exceededTransferLimit: true } : {}) })
    );
  }) as typeof fetch;
  try {
    const j = await hentTemaflater('vern', 'Verneområder', { nr: '5001', navn: 'Trondheim' } as Kommune);
    assert.deepEqual(
      j.features!.map(f => (f as unknown as { id: number }).id),
      [0, 1, 2, 3, 4]
    );
    assert.equal(kall.length, 3);
    assert.ok(kall.every(u => u.searchParams.get('orderByFields') === 'OBJECTID'));
    assert.equal(j.exceededTransferLimit, undefined);
  } finally {
    globalThis.fetch = ekte;
  }
});
