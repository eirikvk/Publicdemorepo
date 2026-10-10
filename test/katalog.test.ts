/* Tester for katalogen i datamotoren: les-gjennom, grensen for hvor mye som huskes, og feil. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { datasett, hent, les, se, utgave } from '../src/data/motor/katalog.ts';

test('les-gjennom: oppskriften kjøres én gang, også når to spør samtidig', async () => {
  let kjort = 0;
  const D = datasett<string, string>({ navn: 'test.a', om: '', husk: 5, lag: async n => (kjort++, n + '!') });
  const [a, b] = await Promise.all([hent(D, 'x'), hent(D, 'x')]);
  assert.equal(a, 'x!');
  assert.equal(b, 'x!');
  assert.equal(await hent(D, 'x'), 'x!');
  assert.equal(kjort, 1);
});

test('grensen: det som er brukt lengst siden, går ut først', async () => {
  const glemt: string[] = [];
  const D = datasett<string, string>({ navn: 'test.b', om: '', husk: 2, lag: n => n, glemt: (_, k) => glemt.push(k) });
  await hent(D, 'a');
  await hent(D, 'b');
  await hent(D, 'a'); /* a er brukt nå, så b går ut når c kommer */
  await hent(D, 'c');
  assert.deepEqual(glemt, ['b']);
  assert.equal(se(D, 'b'), null);
});

test('feil: står som feil til noen spør på nytt med hent', async () => {
  let forsok = 0;
  const D = datasett<string, number>({
    navn: 'test.c',
    om: '',
    husk: 2,
    lag: async () => {
      if (++forsok === 1) throw new Error('nede');
      return forsok;
    }
  });
  await assert.rejects(hent(D, 'x'));
  assert.equal(les(D, 'x')!.status, 'feil'); /* les prøver ikke igjen */
  assert.equal(await hent(D, 'x'), 2);
});

test('utgave: en verdi som lages på nytt, får nytt nummer, også etter at den har gått ut', async () => {
  const D = datasett<string, string>({ navn: 'test.d', om: '', husk: 1, lag: n => n });
  await hent(D, 'a');
  const forst = utgave(D, 'a');
  await hent(D, 'b'); /* a går ut */
  await hent(D, 'a');
  assert.notEqual(utgave(D, 'a'), forst);
});
