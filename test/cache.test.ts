/* Tester for cachen: les-gjennom, grensen for hvor mye som huskes, feil, utgaver og utdatert gull. Kjør: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { les, se, tabell, utdaterGull, utgave } from '../src/data/cache.ts';

test('les-gjennom: ETL-funksjonen kjøres én gang, også når to spør samtidig', async () => {
  let kjort = 0;
  const T = tabell<string, string>({ lag: 'solv', navn: 'a', om: '', husk: 5, etl: async n => (kjort++, n + '!') });
  const [a, b] = await Promise.all([T('x'), T('x')]);
  assert.equal(a, 'x!');
  assert.equal(b, 'x!');
  assert.equal(await T('x'), 'x!');
  assert.equal(kjort, 1);
});

test('grensen: det som er brukt lengst siden, går ut først', async () => {
  const glemt: string[] = [];
  const T = tabell<string, string>({
    lag: 'solv',
    navn: 'b',
    om: '',
    husk: 2,
    etl: async n => n,
    glemt: (_, k) => glemt.push(k)
  });
  await T('a');
  await T('b');
  await T('a'); /* a er brukt nå, så b går ut når c kommer */
  await T('c');
  assert.deepEqual(glemt, ['b']);
  assert.equal(se(T, 'b'), null);
});

test('feil: står som feil til noen kaller tabellen på nytt', async () => {
  let forsok = 0;
  const T = tabell<string, number>({
    lag: 'bronse',
    navn: 'c',
    om: '',
    husk: 2,
    etl: async () => {
      if (++forsok === 1) throw new Error('nede');
      return forsok;
    }
  });
  await assert.rejects(T('x'));
  assert.equal(les(T, 'x')!.status, 'feil'); /* les prøver ikke igjen */
  assert.equal(await T('x'), 2);
});

test('utgave: en verdi som lages på nytt, får nytt nummer, også etter at den har gått ut', async () => {
  const T = tabell<string, string>({ lag: 'solv', navn: 'd', om: '', husk: 1, etl: async n => n });
  await T('a');
  const forst = utgave(T, 'a');
  await T('b'); /* a går ut */
  await T('a');
  assert.notEqual(utgave(T, 'a'), forst);
});

test('gull: utdatert gull gis til visningen mens det nye regnes ut, og regnes ut på nytt for den som kaller', async () => {
  let n = 0;
  const T = tabell<string, number>({ lag: 'gull', navn: 'e', om: '', husk: 2, etl: async () => ++n });
  assert.equal(await T('5001'), 1);
  utdaterGull('5001');
  assert.equal(les(T, '5001')!.verdi, 1); /* det gamle, mens det nye regnes ut */
  assert.equal(await T('5001'), 2);
});
