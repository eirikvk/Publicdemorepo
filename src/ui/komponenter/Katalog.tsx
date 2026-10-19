/* Katalogen og cachen, i teknisk visning på siden Om og metode: bronse, sølv og gull som trekkspill, og i hvert lag tabellene gruppert
   etter datasettet i sølv de hører til (DATASETT i katalogen), delt i data og støttedata, og ellers etter ETL-filen, med tittelen og
   hvor mye cachen har lagret i hver. «Info» viser hva tabellen er, det tekniske navnet og hvor
   ETL-funksjonen ligger. «Data» viser radene i cachen. For tabeller som ikke lagres, kan katalogen spørres i stedet, også fra kildene.
   Innholdet vises som bilder, rutenett, tabeller og flater (Datavisning.tsx), og alle feltene som tre. Til slutt kartets
   minne: flisene OpenLayers holder på i hvert kartlag. Innholdet leses når man ber om det, så det ikke regnes ut på nytt hver gang
   siden tegnes. */
import { useState } from 'react';
import { eksempelI, innhold, kallI, verdiI } from '../../data/cache.ts';
import { app } from '../../data/motor/tilstand.ts';
import { kartetsMidte, kartetsMinne } from '../kart/kart.ts';
import { kb, nf, tid } from '../tekst.ts';
import Datavisning, { finnFormer, type Form } from './Datavisning.tsx';
import { MdAccordionItem, MdButton } from './md.ts';
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

/* En verdi vist i to deler: om dataene (foran, og feltene som beskriver dataene) og dataene selv, etter formen de har (Datavisning.tsx).
   Alle feltene står også som tre. */
function Innholdet({ v, foran }: { v: unknown; foran: [string, string][] }) {
  const [vist] = useState<{ om: [string, string][]; former: Form[]; tekst: string }>(() => ({
    ...finnFormer(v),
    tekst: somTekst(v)
  }));
  return (
    <>
      <h4 className="md-typography-label-s">Om dataene</h4>
      <div className="rullbar">
        <table className="talltabell">
          <tbody>
            {[...foran, ...vist.om].map(([k, x], i) => (
              <tr key={k}>
                <th scope="row">{i < foran.length ? k : <code>{k}</code>}</th>
                <td>{x}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="md-typography-label-s">Dataene</h4>
      {vist.former.length ? <Datavisning former={vist.former} /> : <pre>{vist.tekst}</pre>}
      {vist.former.length > 0 && (
        <details className="tre">
          <summary>Alle feltene som tre</summary>
          <pre>{vist.tekst}</pre>
        </details>
      )}
    </>
  );
}

/* Én rad i cachen. Verdien leses fra cachen først når raden åpnes. */
function Rad({ navn, r }: { navn: string; r: Raden }) {
  const [apen, settApen] = useState(false),
    v = apen ? verdiI(navn, r.nokkel) : undefined;
  return (
    <details onToggle={e => settApen(e.currentTarget.open)}>
      <summary>
        <b>{nokkelen(r.nokkel)}</b> · {statusen(r)}
        {r.byte ? ` · ${kb(r.byte)}` : ''}
      </summary>
      {apen &&
        (v === undefined ? (
          <p>Ingen verdi ennå, eller ikke lenger i cachen.</p>
        ) : (
          <Innholdet
            v={v}
            foran={[
              ['Status', statusen(r)],
              ...(r.ms ? ([['Laget på', tid(r.ms)]] as [string, string][]) : []),
              ['Lagret', alder(r.sekunder) + ' siden']
            ]}
          />
        ))}
    </details>
  );
}

/* For tabeller som ikke lagres: spør katalogen, som enhver som bruker den, med valgt kommune eller midten av kartet som nøkkel. Det kan
   gi kall til kildene, men spør ikke etter noe som ikke finnes, som egne områder som ikke er tegnet. Tabeller som lagres, viser det
   som står i cachen i stedet. */
function Sporring({ d }: { d: Tabellen }) {
  const [svar, settSvar] = useState<{ nokkel: string; v?: unknown; feil?: string; ms: number } | null>(null),
    [spor, settSpor] = useState(false);
  if (!d.sporbar) return <p>Har ingen ETL-funksjon, så den kan ikke spørres.</p>;
  const midte = kartetsMidte(),
    E = eksempelI(d.navn, { nr: app.valgt ? app.valgt.nr : null, midt: midte && midte.midt, z: midte ? midte.z : 0 });
  if (!E) return <p>Lagres ikke. Kan spørres når det den bygger på, finnes: velg en kommune og vis kartet.</p>;
  const kjor = async () => {
    settSpor(true);
    const t0 = performance.now();
    try {
      const v = await kallI(d.navn, E.n);
      settSvar({ nokkel: E.nokkel, v, ms: performance.now() - t0 });
    } catch (e) {
      settSvar({ nokkel: E.nokkel, feil: e instanceof Error ? e.message : String(e), ms: performance.now() - t0 });
    } finally {
      settSpor(false);
    }
  };
  return (
    <>
      <MdButton theme="secondary" mode="small" onClick={kjor} disabled={spor}>
        {spor ? 'Spør …' : `Spør med ${nokkelen(E.nokkel)}`}
      </MdButton>
      {svar &&
        (svar.feil !== undefined ? (
          <p>
            {nokkelen(svar.nokkel)}: feilet ({svar.feil}).
          </p>
        ) : (
          <Innholdet
            key={svar.nokkel + svar.ms}
            v={svar.v}
            foran={[
              ['Nøkkel', nokkelen(svar.nokkel)],
              ['Tid', tid(svar.ms)]
            ]}
          />
        ))}
    </>
  );
}

/* Det «Info» viser: hva tabellen er, hvilket datasett den hører til, hvordan den kalles, hvor ETL-funksjonen ligger, og hvor mye som
   huskes */
function Info({ d }: { d: Tabellen }) {
  return (
    <>
      <p>{stor(d.om)}</p>
      {d.datasett && (
        <p>
          {d.stotte ? 'Støttedata' : 'Data'} i datasettet «{d.datasett.navn}».{d.stotte ? ' ' + stor(d.stotte) : ''}
        </p>
      )}
      <p>
        Kalles som <code>katalog.{d.navn}(nøkkel)</code>.{' '}
        {d.etl ? (
          <>
            ETL-funksjonen er <code>{d.navn.split('.')[1]}()</code> i <code>src/data/{d.fil}</code>.
          </>
        ) : (
          <>
            Har ingen ETL-funksjon. Den fylles i <code>src/data/{d.fil}</code>.
          </>
        )}
      </p>
      <p>
        {d.husk === Infinity
          ? 'Huskes for alle nøkler.'
          : !d.husk
            ? 'Lagres ikke: kallet går gjennom katalogen rett til ETL-funksjonen.'
            : `Huskes for ${d.husk === 1 ? 'den siste nøkkelen' : `de ${d.husk} siste nøklene`}. Det som er brukt lengst siden, går ut først.`}
        {d.lagret
          ? ' Har ferdige svar lagret sammen med siden. Finnes svaret der, brukes det, og ETL-funksjonen kjøres ikke.'
          : ''}
        {d.voksende ? ' Fylles på etter at den er lagt inn.' : ''}
        {d.brukerstyrt
          ? ' Bygger på det brukeren gjør, og regnes ut på nytt når egne områder endres eller det er hentet mer kart.'
          : ''}
      </p>
    </>
  );
}

const sum = (d: Tabellen) => d.rader.reduce((s, x) => s + x.byte, 0);
type Apen = { navn: string; hva: 'info' | 'data' } | null;
type Minne = ReturnType<typeof kartetsMinne>;
const mellomrom = (s: string) => s.replace(/ /g, '\u00a0');

/* Kartets minne: flisene OpenLayers holder på per kartlag, ved siden av cachen. Dataene ligger i cachen; dette er bildene kartet har
   tegnet av dem. */
function KartetsMinne({ M }: { M: Minne }) {
  const byte = M.reduce((s, x) => s + x.byte, 0);
  return (
    <MdAccordionItem
      label="Kartets minne: ferdige kartfliser"
      headerContent={mellomrom(`${nf(M.length, 0)} lag · ${kb(byte)}`)}
      hideCloseButton
      className="lag"
    >
      <p>
        OpenLayers, som tegner kartet, holder på flisene det har tegnet ferdig i hvert kartlag, så kartet kan flyttes
        fram og tilbake uten å tegne dem på nytt. Når det er fullt, går flisen som er brukt lengst siden, ut først.
        Dataene selv ligger i cachen over; dette er bildene av dem. Minnet er regnet som bredde × høyde × 4 byte per
        flis.
      </p>
      <div className="tabellramme">
        <table className="talltabell">
          <thead>
            <tr>
              <th scope="col">Kartlag</th>
              <th scope="col" className="tall">
                Fliser
              </th>
              <th scope="col" className="tall">
                Minne
              </th>
            </tr>
          </thead>
          <tbody>
            {M.map(x => (
              <tr key={x.tittel}>
                <th scope="row">{x.tittel}</th>
                <td className="tall">
                  {nf(x.fliser, 0)} av {nf(x.plass, 0)}
                </td>
                <td className="tall">{x.fliser ? kb(x.byte) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MdAccordionItem>
  );
}

/* Én tabell i katalogen: tittelen, hvor mye som er lagret, og knappene Info og Data med det de viser under */
function Tabellrad({
  d,
  apen,
  veksle
}: {
  d: Tabellen;
  apen: Apen;
  veksle: (navn: string, hva: 'info' | 'data') => void;
}) {
  const r = d.rader,
    uferdige = r.filter(x => x.status !== 'ok' || x.utdatert),
    her = apen && apen.navn === d.navn ? apen.hva : null,
    id = 'katalog-' + d.navn.replace('.', '-');
  return (
    <>
      <tr>
        <th scope="row">
          {d.tittel}
          {d.stotte && <small>{d.stotte}</small>}
        </th>
        <td className="tall">
          {d.husk ? `${nf(r.length, 0)} av ${d.husk === Infinity ? 'alle' : nf(d.husk, 0)}` : 'lagres ikke'}
          {r.length > 0 && <small>{kb(sum(d))}</small>}
          {uferdige.length > 0 && (
            <small className="uferdig">{uferdige.map(x => `${nokkelen(x.nokkel)} ${statusen(x)}`).join(', ')}</small>
          )}
        </td>
        <td className="handling">
          <div className="knapper">
            <MdButton
              theme="tertiary"
              mode="small"
              aria-expanded={her === 'info'}
              aria-controls={her === 'info' ? id : undefined}
              aria-label={`Info om ${d.tittel} (${d.navn})`}
              onClick={() => veksle(d.navn, 'info')}
            >
              Info
            </MdButton>
            <MdButton
              theme="tertiary"
              mode="small"
              aria-expanded={her === 'data'}
              aria-controls={her === 'data' ? id : undefined}
              aria-label={`Data i ${d.tittel} (${d.navn})`}
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
              ) : (
                <>
                  {!d.husk ? (
                    <Sporring d={d} />
                  ) : r.length ? (
                    r.map(x => <Rad key={x.nokkel} navn={d.navn} r={x} />)
                  ) : (
                    <p>Ingenting lagret ennå.</p>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Katalog() {
  const [K, settK] = useState<Innhold | null>(null),
    [M, settM] = useState<Minne>([]),
    [apen, settApen] = useState<Apen>(null);
  const veksle = (navn: string, hva: 'info' | 'data') =>
    settApen(apen && apen.navn === navn && apen.hva === hva ? null : { navn, hva });
  return (
    <section className="prosa katalog">
      <h2 className="md-typography-heading-s">Katalogen</h2>
      <p>
        Tabellene i datapipelinen, og hva cachen har lagret i hver akkurat nå. I bronse og sølv er tabellene samlet i
        datasett der det er gjort. Et datasett er ett sett data fra virkeligheten, gjort om til vår standard. Under
        datasettet står dataene, som innholdet lages av, og støttedataene, som trengs for å hente og forstå dem.
        Foreløpig gjelder det kommuneplanen. De andre tabellene står etter filen de lages i. «Info» sier hva tabellen er
        og hvor ETL-funksjonen ligger. «Data» viser det som ligger i cachen. Tabeller som ikke lagrer, kan spørres i
        stedet, også fra kildene, men ikke etter noe som ikke finnes. Alt ligger i minnet og er borte når siden lukkes:
        siden lagrer ingenting selv i nettleseren. Nettleserens vanlige hurtigbuffer kan likevel ta vare på svar fra
        tjenestene, slik tjenestene selv bestemmer.
      </p>
      <MdButton
        theme="secondary"
        mode="small"
        onClick={() => {
          settK(innhold());
          settM(kartetsMinne());
        }}
      >
        {K ? 'Oppdater' : 'Vis innholdet nå'}
      </MdButton>
      {K &&
        (['bronse', 'solv', 'gull'] as const).map(lag => {
          const T = K.filter(d => d.lag === lag),
            sett = [...new Map(T.flatMap(d => (d.datasett ? [[d.datasett.navn, d.datasett] as const] : []))).values()],
            filer = [...new Set(T.filter(d => !d.datasett).map(d => d.fil))],
            rad = (d: Tabellen) => <Tabellrad key={d.navn} d={d} apen={apen} veksle={veksle} />;
          return (
            <MdAccordionItem
              key={lag}
              label={LAGNAVN[lag]}
              headerContent={mellomrom(`${nf(T.length, 0)} tabeller · ${kb(T.reduce((s, d) => s + sum(d), 0))}`)}
              hideCloseButton
              className="lag"
            >
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
                  {sett.map(ds => {
                    const I = T.filter(d => d.datasett && d.datasett.navn === ds.navn);
                    return (
                      <tbody key={ds.navn} className="datasett">
                        <tr className="gruppe">
                          <th colSpan={3} scope="colgroup">
                            Datasett: {ds.navn}
                            <small>{ds.om}</small>
                          </th>
                        </tr>
                        <tr className="undergruppe">
                          <th colSpan={3} scope="colgroup">
                            Data
                          </th>
                        </tr>
                        {I.filter(d => !d.stotte).map(rad)}
                        <tr className="undergruppe">
                          <th colSpan={3} scope="colgroup">
                            Støttedata
                          </th>
                        </tr>
                        {I.filter(d => d.stotte).map(rad)}
                      </tbody>
                    );
                  })}
                  {filer.map(fil => (
                    <tbody key={fil}>
                      <tr className="gruppe">
                        <th colSpan={3} scope="colgroup">
                          <code>{fil.startsWith(lag + '/') ? fil.slice(lag.length + 1) : fil}</code>
                        </th>
                      </tr>
                      {T.filter(d => !d.datasett && d.fil === fil).map(rad)}
                    </tbody>
                  ))}
                </table>
              </div>
            </MdAccordionItem>
          );
        })}
      {K && (
        <p>
          Til sammen{' '}
          {nf(
            K.reduce((s, d) => s + d.rader.length, 0),
            0
          )}{' '}
          rader i cachen, {kb(K.reduce((s, d) => s + sum(d), 0))}.
        </p>
      )}
      {K && M.length > 0 && <KartetsMinne M={M} />}
    </section>
  );
}
