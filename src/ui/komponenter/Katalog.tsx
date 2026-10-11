/* Katalogen og cachen, i teknisk visning på siden Om og metode: én kort tabell over tabellene i bronse, sølv og gull, med hvor mye
   cachen har lagret i hver. «Info» viser hva tabellen er og hvor ETL-funksjonen ligger. «Data» viser radene i cachen, og hver rad
   kan åpnes for å se innholdet: bilder, rutenett, tabeller og flater (Datavisning.tsx), og alle feltene som tre. Innholdet leses
   når man ber om det, så det ikke regnes ut på nytt hver gang siden tegnes. */
import { Fragment, useState } from 'react';
import { innhold, verdiI } from '../../data/cache.ts';
import { kb, nf, tid } from '../tekst.ts';
import Datavisning, { finnFormer, type Form } from './Datavisning.tsx';
import { MdButton } from './md.ts';
import './Katalog.css';

type Innhold = ReturnType<typeof innhold>;
type Tabellen = Innhold[number];
type Raden = Tabellen['rader'][number];

const LAGNAVN: Record<string, string> = {
  bronse: 'Bronse: svar fra kildene',
  solv: 'Sølv: tolket til felles standard',
  gull: 'Gull: det sidene viser'
};
const stor = (s: string) => s[0].toUpperCase() + s.slice(1) + (s.endsWith('.') ? '' : '.');
const nokkelen = (k: string) => k || 'uten nøkkel';
const alder = (s: number) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${nf(s / 3600)} t`);
/* Navnet kan deles foran hver stor bokstav, så lange navn som verdsattNaturIKartlagt brytes mellom ordene på smal skjerm */
const deltNavn = (navn: string) =>
  navn.split(/(?=[A-ZÆØÅ])/).map((del, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {del}
    </Fragment>
  ));
const statusen = (r: Raden) => (r.utdatert ? 'utdatert' : r.status === 'feil' ? 'feilet' : r.status);

/* En verdi fra cachen som lesbar tekst, med innrykk: de første leddene i lister og kart, og de første feltene i objekter. Bilder,
   lerreter og lange tallrekker vises med type og størrelse i stedet for innholdet. Felt uten verdi (undefined) er utelatt. Høyst MAKS
   linjer. */
const MAKS = 80;
function somTekst(v: unknown): string {
  const linjer: string[] = [],
    sett = new Set<unknown>();
  const kort = (x: unknown): string | null => {
    if (x === undefined || x === null) return String(x);
    if (typeof x === 'string') return JSON.stringify(x.length > 80 ? x.slice(0, 80) + '…' : x);
    if (typeof x === 'number') return String(Number.isInteger(x) ? x : +x.toPrecision(6));
    if (typeof x === 'boolean') return String(x);
    if (typeof x === 'function') return 'funksjon';
    if (typeof x !== 'object') return String(x);
    if (x instanceof ArrayBuffer) return `ArrayBuffer, ${kb(x.byteLength)}`;
    if (ArrayBuffer.isView(x)) {
      const n = (x as unknown as { length?: number }).length;
      if (n !== undefined && n <= 12)
        return `${x.constructor.name} [${Array.from(x as unknown as ArrayLike<number>).join(', ')}]`;
      return (
        `${x.constructor.name}(${n === undefined ? x.byteLength : n})` +
        (x.byteLength >= 1024 ? `, ${kb(x.byteLength)}` : '')
      );
    }
    if (typeof HTMLCanvasElement !== 'undefined' && x instanceof HTMLCanvasElement)
      return `lerret ${x.width} × ${x.height}`;
    if (typeof ImageBitmap !== 'undefined' && x instanceof ImageBitmap) return `bilde ${x.width} × ${x.height}`;
    if (typeof CanvasRenderingContext2D !== 'undefined' && x instanceof CanvasRenderingContext2D) return 'tegneflate';
    if (Array.isArray(x) && x.length && x.length <= 12 && x.every(y => typeof y === 'number'))
      return '[' + x.map(y => kort(y)).join(', ') + ']';
    if (Array.isArray(x) && x.length && Array.isArray(x[0]) && typeof x[0][0] === 'number')
      return `${x.length} punkter`;
    if (sett.has(x)) return '(samme som over)';
    return null;
  };
  const skriv = (x: unknown, inn: string, foran: string, dybde: number) => {
    if (linjer.length >= MAKS) return;
    const k = kort(x);
    if (k !== null) return void linjer.push(inn + foran + k);
    sett.add(x);
    let ledd: [string, unknown][], antall: number, merke: string;
    if (x instanceof Map) {
      ledd = [...x].slice(0, 8).map(([a, b]) => [String(a), b]);
      antall = x.size;
      merke = `Map med ${x.size}`;
    } else if (x instanceof Set) {
      ledd = [...x].slice(0, 8).map((b, i) => [String(i), b]);
      antall = x.size;
      merke = `Set med ${x.size}`;
    } else if (Array.isArray(x)) {
      ledd = x.slice(0, 3).map((b, i) => [String(i), b]);
      antall = x.length;
      merke = `liste med ${x.length}`;
    } else {
      const e = Object.entries(x as object).filter(([, b]) => b !== undefined);
      ledd = e.slice(0, 16);
      antall = e.length;
      merke = `${e.length} felt`;
    }
    if (dybde >= 4 && antall) return void linjer.push(inn + foran + merke);
    const overskrift = !!foran || x instanceof Map || x instanceof Set || Array.isArray(x);
    if (overskrift) linjer.push(inn + foran + merke);
    const under = overskrift ? inn + '  ' : inn;
    for (const [a, b] of ledd) skriv(b, under, a + ': ', dybde + 1);
    if (antall > ledd.length && linjer.length < MAKS) linjer.push(`${under}… og ${antall - ledd.length} til`);
  };
  skriv(v, '', '', 0);
  if (linjer.length >= MAKS) linjer.push('… (kortet av)');
  return linjer.join('\n');
}

/* Én rad i cachen. Verdien vises først når raden åpnes, og leses da fra cachen: innholdet etter formen det har, og alle feltene som
   tre. */
function Rad({ navn, r }: { navn: string; r: Raden }) {
  const [vist, settVist] = useState<{ former: Form[]; tekst: string } | null>(null);
  const vis = (apen: boolean) => {
    if (!apen) return settVist(null);
    const v = verdiI(navn, r.nokkel);
    settVist(
      v === undefined
        ? { former: [], tekst: 'Ingen verdi ennå, eller ikke lenger i cachen.' }
        : { former: finnFormer(v), tekst: somTekst(v) }
    );
  };
  return (
    <details onToggle={e => vis(e.currentTarget.open)}>
      <summary>
        <b>{nokkelen(r.nokkel)}</b> · {statusen(r)}
        {r.delvis ? ', delvis' : ''}
        {r.byte ? ` · ${kb(r.byte)}` : ''}
        {r.ms ? ` · laget på ${tid(r.ms)}` : ''} · {alder(r.sekunder)} siden
      </summary>
      {vist &&
        (vist.former.length ? (
          <>
            <Datavisning former={vist.former} />
            <details className="tre">
              <summary>Alle feltene som tre</summary>
              <pre>{vist.tekst}</pre>
            </details>
          </>
        ) : (
          <pre>{vist.tekst}</pre>
        ))}
    </details>
  );
}

/* Det «Info» viser: hva tabellen er, hvordan den kalles, hvor ETL-funksjonen ligger, og hvor mye som huskes */
function Info({ d }: { d: Tabellen }) {
  return (
    <>
      <p>{stor(d.om)}</p>
      <p>
        Kalles som <code>katalog.{d.navn}(nøkkel)</code>.{' '}
        {d.etl ? (
          <>
            ETL-funksjonen er <code>{d.navn.split('.')[1]}()</code> i <code>src/data/{d.lag}/</code>.
          </>
        ) : (
          <>Har ingen ETL-funksjon, se over.</>
        )}
      </p>
      <p>
        {d.husk === Infinity
          ? 'Huskes for alle nøkler.'
          : `Huskes for ${d.husk === 1 ? 'den siste nøkkelen' : `de ${d.husk} siste nøklene`}. Det som er brukt lengst siden, går ut først.`}
        {d.voksende ? ' Fylles på etter at den er lagt inn.' : ''}
        {d.brukerstyrt
          ? ' Bygger på det brukeren gjør, og regnes ut på nytt når egne områder endres eller det er hentet mer kart.'
          : ''}
      </p>
    </>
  );
}

export default function Katalog() {
  const [K, settK] = useState<Innhold | null>(null),
    [apen, settApen] = useState<{ navn: string; hva: 'info' | 'data' } | null>(null);
  const veksle = (navn: string, hva: 'info' | 'data') =>
    settApen(apen && apen.navn === navn && apen.hva === hva ? null : { navn, hva });
  const sum = (d: Tabellen) => d.rader.reduce((s, x) => s + x.byte, 0);
  return (
    <section className="prosa katalog">
      <h2 className="md-typography-heading-s">Katalogen</h2>
      <p>
        Tabellene i datapipelinen, og hva cachen har lagret i hver akkurat nå. «Info» sier hva tabellen er og hvor
        ETL-funksjonen ligger. «Data» viser radene, som regel én per kommune. Ingenting lagres i nettleseren etter at
        siden er lukket.
      </p>
      <MdButton theme="secondary" mode="small" onClick={() => settK(innhold())}>
        {K ? 'Oppdater' : 'Vis innholdet nå'}
      </MdButton>
      {K && (
        <div className="tabellramme">
          <table className="talltabell">
            <thead>
              <tr>
                <th scope="col">Tabell</th>
                <th scope="col" className="tall">
                  Lagret
                </th>
                <td />
              </tr>
            </thead>
            {(['bronse', 'solv', 'gull'] as const).map(lag => (
              <tbody key={lag}>
                <tr className="gruppe">
                  <th colSpan={3} scope="colgroup">
                    {LAGNAVN[lag]}
                  </th>
                </tr>
                {K.filter(d => d.lag === lag).map(d => {
                  const r = d.rader,
                    uferdige = r.filter(x => x.status !== 'ok' || x.utdatert),
                    her = apen && apen.navn === d.navn ? apen.hva : null,
                    id = 'katalog-' + d.navn.replace('.', '-');
                  return (
                    <Fragment key={d.navn}>
                      <tr>
                        <th scope="row">{deltNavn(d.navn.split('.')[1])}</th>
                        <td className="tall">
                          {nf(r.length, 0)} av {d.husk === Infinity ? 'alle' : nf(d.husk, 0)}
                          {r.length > 0 && <small>{kb(sum(d))}</small>}
                          {uferdige.length > 0 && (
                            <small className="uferdig">
                              {uferdige.map(x => `${nokkelen(x.nokkel)} ${statusen(x)}`).join(', ')}
                            </small>
                          )}
                        </td>
                        <td className="handling">
                          <div className="knapper">
                            <MdButton
                              theme="tertiary"
                              mode="small"
                              aria-expanded={her === 'info'}
                              aria-controls={her === 'info' ? id : undefined}
                              aria-label={`Info om ${d.navn}`}
                              onClick={() => veksle(d.navn, 'info')}
                            >
                              Info
                            </MdButton>
                            <MdButton
                              theme="tertiary"
                              mode="small"
                              aria-expanded={her === 'data'}
                              aria-controls={her === 'data' ? id : undefined}
                              aria-label={`Data i ${d.navn}`}
                              onClick={() => veksle(d.navn, 'data')}
                            >
                              Data
                            </MdButton>
                          </div>
                        </td>
                      </tr>
                      {her && (
                        <tr className="detalj" id={id}>
                          <td colSpan={3}>
                            <div>
                              {her === 'info' ? (
                                <Info d={d} />
                              ) : r.length ? (
                                r.map(x => <Rad key={x.nokkel} navn={d.navn} r={x} />)
                              ) : (
                                <p>Ingenting lagret ennå.</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            ))}
            <tbody>
              <tr className="sum">
                <th scope="row">Til sammen</th>
                <td className="tall">
                  {nf(
                    K.reduce((s, d) => s + d.rader.length, 0),
                    0
                  )}
                  <small>{kb(K.reduce((s, d) => s + sum(d), 0))}</small>
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
