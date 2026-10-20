/* Katalogen og cachen, i teknisk visning på siden Om og metode: bronse, sølv og gull som trekkspill, med tittelen og hvor mye cachen
   har lagret i hver tabell. I bronse og sølv står tabellene gruppert etter ETL-filen. Dataene i et datasett i sølv (DATASETT i
   katalogen) står som én vanlig rad, og støttedataene ligger bak knappen «Støttedata» på raden, med hva hver av dem er til for først.
   Støttedata som ikke hører til ett datasett, står for seg sist i laget, som «Andre støttedata». Gull står etter kortene som viser
   tallene (KORT i forklaringer.ts): hvert kort med tabellene det viser, og støttedataene det bygger på, mellomregninger og
   hurtigminne, bak knappen på den siste. «Info» viser hva tabellen er, kilden med kildens egen beskrivelse, hvor den hentes fra og
   hvordan den lages, hva den bygger på, usikkerheten, det tekniske navnet og hvor ETL-funksjonen ligger: det samme som infoboksene
   og METODE.md bygger på. «Data» viser radene i cachen. For tabeller som ikke lagres, kan katalogen spørres i stedet, også fra kildene.
   Innholdet vises som bilder, rutenett, tabeller og flater (Datavisning.tsx), og alle feltene som tre. Til slutt kartets
   minne: flisene OpenLayers holder på i hvert kartlag. Innholdet leses når man ber om det, så det ikke regnes ut på nytt hver gang
   siden tegnes. */
import { useId, useState } from 'react';
import { eksempelI, innhold, kallI, verdiI } from '../../data/cache.ts';
import { app } from '../../data/motor/tilstand.ts';
import { kartetsMidte, kartetsMinne } from '../kart/kart.ts';
import { kb, nf, tid } from '../tekst.ts';
import Datavisning, { finnFormer, type Form } from './Datavisning.tsx';
import { celle, eksempelrader, kodenavn, type Eksempelrader, type Kolonne } from '../eksempelrader.ts';
import type { Kolonneinfo, Radform, Tom } from '../../data/cache.ts';
import { MdAccordionItem, MdButton } from './md.ts';
import { AVHENGIGHETER } from '../../data/avhengigheter.ts';
import { KORT, tabellen } from '../forklaringer.ts';
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

/* Hvor mange rader det er, og hvilke som vises */
function antallTekst(E: Eksempelrader) {
  if (E.antall === null) return '';
  if (E.antall === 0) return 'Ingen rader.';
  const n = `${nf(E.antall, 0)} ${E.antall === 1 ? 'rad' : 'rader'}.`;
  return E.spredt ? `${n} Her er ${nf(E.rader.length, 0)} av dem, spredt jevnt fra den første.` : n;
}
/* En verdi i full lengde, med lenke når det er en nettadresse */
function Verdi({ x, k }: { x: unknown; k?: Kolonneinfo }) {
  const navn = k ? kodenavn(k, x) : '',
    t = celle(x, true).tekst + (navn ? ' ' + navn : '');
  return typeof x === 'string' && /^https?:\/\//.test(x) ? (
    <a href={x} target="_blank" rel="noopener">
      {t}
    </a>
  ) : (
    <>{t}</>
  );
}
/* Alle feltene i en rad, loddrett: felt, type og verdi, med kolonnene i tabellen først */
function Feltene({ r, K, id, tittel }: { r: Record<string, unknown>; K: Kolonne[]; id?: string; tittel: string }) {
  const navn = [...K.map(k => k.navn).filter(k => k in r), ...Object.keys(r).filter(k => !K.some(x => x.navn === k))],
    info = (n: string) => K.find(k => k.navn === n);
  return (
    <div className="feltene" id={id}>
      <table className="talltabell">
        <caption>{tittel}</caption>
        <thead>
          <tr>
            <th scope="col">Felt</th>
            <th scope="col">Type</th>
            <th scope="col">Verdi</th>
          </tr>
        </thead>
        <tbody>
          {navn.map(k => (
            <tr key={k}>
              <th scope="row">
                <code>{k}</code>
                {info(k) && info(k)!.om && <small>{info(k)!.om}</small>}
              </th>
              <td>
                {celle(r[k]).type}
                {info(k) && info(k)!.enhet ? `, ${info(k)!.enhet}` : ''}
              </td>
              <td>
                <Verdi x={r[k]} k={info(k)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
/* Punktum etter en oppramsing, når den siste teksten ikke alt slutter med punktum */
const punktum = (t: string) => (/[.!?]$/.test(t) ? '' : '.');
/* Hva hver kolonne er: navnet, typen og enheten, forklaringen, og navnet på kodene, som en liste som kan foldes ut */
function OmKolonnene({ K }: { K: Kolonne[] }) {
  return (
    <details className="omkolonnene">
      <summary>Om kolonnene</summary>
      <dl>
        {K.map(k => (
          <div key={k.navn}>
            <dt>
              <code>{k.navn}</code>
              <small>
                {' '}
                {k.type}
                {k.enhet ? `, ${k.enhet}` : ''}
              </small>
            </dt>
            <dd>
              {k.om ? stor(k.om) : 'Ingen forklaring.'}
              {k.koder && (
                <>
                  {' '}
                  Kodene:{' '}
                  {Object.entries(k.koder)
                    .map(([v, n]) => `${v} ${n}`)
                    .join(', ')}
                  .
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
/* Eksempelradene: hva én rad er, hvor mange det er og hvilke som vises, feltene som står én gang ved siden av radene, og radene som
   tabell med navnet og typen til hver kolonne, og hvor mange rader som har verdi når ikke alle har det. Kolonner med samme verdi i
   alle radene som vises, står på én linje over tabellen, så tabellen blir smalere. Ett svar står loddrett, som felt, type og verdi.
   Knappen først i en rad, med plassen til raden blant alle, viser alle feltene i raden under tabellen. Den første kolonnen står fast
   når tabellen rulles sidelengs. */
const MAKS_KOLONNER = 30;
function Eksempeltabell({ E }: { E: Eksempelrader }) {
  const id = useId(),
    [apen, settApen] = useState<number | null>(null),
    lik =
      E.rader.length >= 3
        ? E.kolonner.filter(
            k =>
              !E.nokler.includes(k.navn) &&
              E.rader.every(r => celle(r[k.navn]).tekst === celle(E.rader[0][k.navn]).tekst)
          )
        : [],
    vises = E.kolonner.filter(k => !lik.includes(k)),
    K = vises.slice(0, MAKS_KOLONNER),
    ett = E.rader.length === 1 && E.antall === 1;
  return (
    <>
      <h4 className="md-typography-label-s" id={id + 't'}>
        Eksempelrader
      </h4>
      <p className="hint" id={id + 'o'}>
        {E.hva} {ett ? '' : antallTekst(E)}
        {E.merknad ? ' ' + E.merknad : ''}
      </p>
      {E.om.length > 0 && (
        <p className="hint">
          Står én gang ved siden av radene:{' '}
          {E.om.map(([k, x], i) => (
            <span key={k}>
              {i ? ', ' : ''}
              <code>{k}</code> {x}
            </span>
          ))}
          {punktum(E.om[E.om.length - 1][1])}
        </p>
      )}
      {lik.length > 0 && (
        <p className="hint">
          Lik i alle radene som vises:{' '}
          {lik.map((k, i) => (
            <span key={k.navn}>
              {i ? ', ' : ''}
              <code>{k.navn}</code> {celle(E.rader[0][k.navn]).tekst || 'tom'}
              {kodenavn(k, E.rader[0][k.navn]) ? ' ' + kodenavn(k, E.rader[0][k.navn]) : ''}
              {k.enhet && celle(E.rader[0][k.navn]).type === 'tall' ? ' ' + k.enhet : ''}
            </span>
          ))}
          .
        </p>
      )}
      {ett ? (
        <Feltene r={E.rader[0]} K={E.kolonner} tittel="Feltene i svaret" />
      ) : (
        E.rader.length > 0 && (
          <div
            className="rullbar eksempler"
            role="region"
            tabIndex={0}
            aria-labelledby={id + 't'}
            aria-describedby={id + 'o'}
          >
            <table className="talltabell eksempelrader">
              <thead>
                <tr>
                  <th scope="col">Rad</th>
                  {K.map(k => (
                    <th key={k.navn} scope="col" className={k.type === 'tall' ? 'tall' : undefined}>
                      {k.navn}
                      <small>
                        <span className="skjult">, type </span>
                        {k.type}
                        {k.enhet ? `, ${k.enhet}` : ''}
                        {k.fylt < k.av ? `, i ${nf(k.fylt, 0)} av ${nf(k.av, 0)}` : ''}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {E.rader.map((r, i) => (
                  <tr key={i}>
                    <td>
                      <button
                        type="button"
                        className="fold"
                        aria-expanded={apen === i}
                        aria-controls={apen === i ? id + 'r' : undefined}
                        aria-label={`Alle feltene i rad ${E.plass[i]}`}
                        onClick={() => settApen(apen === i ? null : i)}
                      >
                        {apen === i ? '▾' : '▸'} {E.plass[i]}
                      </button>
                    </td>
                    {K.map(k => {
                      const c = celle(r[k.navn]),
                        navn = kodenavn(k, r[k.navn]);
                      return (
                        <td
                          key={k.navn}
                          className={
                            c.type === 'tall'
                              ? 'tall'
                              : ['flate', 'liste', 'objekt'].includes(c.type)
                                ? 'forkortet'
                                : undefined
                          }
                        >
                          {c.tekst}
                          {navn ? <span className="kodenavn"> {navn}</span> : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {E.kolonner.some(k => k.om || k.enhet || k.koder) && <OmKolonnene K={E.kolonner} />}
      {!ett && vises.length > K.length && (
        <p className="hint">
          Tabellen viser {K.length} av {vises.length} kolonner. Trykk på ▸ for å se alle feltene i en rad.
        </p>
      )}
      {!ett && apen !== null && E.rader[apen] && (
        <Feltene r={E.rader[apen]} K={E.kolonner} id={id + 'r'} tittel={`Alle feltene i rad ${E.plass[apen]}`} />
      )}
    </>
  );
}

/* Former som viser dataene som bilde: de står også når eksempelradene vises, mens tabellene og feltene da står i eksempelradene */
const BILDER = new Set<Form['type']>(['png', 'bilde', 'rutenett', 'flater']);
/* ja og nei for sant og usant i feltene som beskriver dataene, som i eksempelradene */
const janei = (x: string) => (x === 'true' ? 'ja' : x === 'false' ? 'nei' : x);
/* En verdi vist i deler: om dataene (foran, og feltene som beskriver dataene), eksempelradene, dataene som bilde etter formen de har
   (Datavisning.tsx), og alle feltene som tre. Uten eksempelrader vises dataene etter formen de har, som før. Kan eksempelradene ikke
   lages, vises verdien uten dem. */
/* Det tabellen sier om eksempelradene: hva én rad er, kolonnene og verdien for ruter uten data */
type Radvalg = { radform: Radform | null; kolonner: Record<string, Kolonneinfo> | null; tom?: Tom | null };
function Innholdet({ v, foran, t }: { v: unknown; foran: [string, string][]; t: Radvalg }) {
  const [vist] = useState<{ om: [string, string][]; former: Form[]; tekst: string; E: Eksempelrader | null }>(() => {
    let E: Eksempelrader | null = null;
    try {
      E = eksempelrader(v, t.radform, { kolonner: t.kolonner, tom: t.tom });
    } catch (e) {
      E = null;
    }
    return { ...finnFormer(v), tekst: somTekst(v), E };
  });
  const former = vist.E ? vist.former.filter(f => BILDER.has(f.type)) : vist.former;
  return (
    <>
      <h4 className="md-typography-label-s">Om dataene</h4>
      <div className="rullbar om">
        <table className="talltabell">
          <tbody>
            {[...foran, ...vist.om].map(([k, x], i) => (
              <tr key={k}>
                <th scope="row">{i < foran.length ? k : <code>{k}</code>}</th>
                <td>{janei(x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {vist.E && <Eksempeltabell E={{ ...vist.E, om: vist.E.om.filter(([k]) => !vist.om.some(([n]) => n === k)) }} />}
      {vist.E ? (
        former.length > 0 && (
          <>
            <h4 className="md-typography-label-s">Som bilde</h4>
            <Datavisning former={former} />
          </>
        )
      ) : (
        <>
          <h4 className="md-typography-label-s">Dataene</h4>
          {former.length ? <Datavisning former={former} /> : <pre>{vist.tekst}</pre>}
        </>
      )}
      {(vist.E || former.length > 0) && (
        <details className="tre">
          <summary>Alle feltene som tre</summary>
          <pre>{vist.tekst}</pre>
        </details>
      )}
    </>
  );
}

/* Én rad i cachen. Verdien leses fra cachen først når raden åpnes. */
function Rad({ navn, r, t }: { navn: string; r: Raden; t: Radvalg }) {
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
            t={t}
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
            t={d}
          />
        ))}
    </>
  );
}

/* Det «Info» viser: for dataene i et datasett hva datasettet er og tabellen dataene ligger i, for støttedata hvilke data de støtter,
   og innholdet. Så hva tabellen er, kilden med kildens egen beskrivelse, hvor den hentes fra og hvordan den lages (forklaringen),
   hva den bygger på, og usikkerheten: det samme som infoboksene og METODE.md bygger på. Til slutt hvordan den kalles, hvor
   ETL-funksjonen ligger, og hvor mye som huskes. */
function Info({ d }: { d: Tabellen }) {
  const bygger = AVHENGIGHETER[d.navn] || [];
  return (
    <>
      {d.datasett && !d.stotte && <p>{stor(d.datasett.om)}</p>}
      {(d.datasett || d.stotte) && (
        <p>
          {!d.datasett
            ? d.lag === 'gull'
              ? 'Støttedata i gull: en mellomregning eller et hurtigminne for det sidene viser.'
              : 'Støttedata som ikke hører til ett datasett.'
            : d.stotte
              ? `Støttedata for «${d.datasett.navn}».`
              : `Dataene ligger i tabellen «${d.tittel}».`}
          {d.innholdet ? ' ' + stor(d.innholdet) : ''}
        </p>
      )}
      <p>{stor(d.om)}</p>
      {d.kilde && (
        <p>
          Kilde:{' '}
          <a href={d.kilde.adresse}>
            {d.kilde.navn}: {d.kilde.datasett}
          </a>
          , {d.kilde.lisens}.
          {d.kilde.beskrivelse ? ` Slik kilden beskriver dataene, kort og med egne ord: ${d.kilde.beskrivelse}` : ''}
        </p>
      )}
      {(d.endepunkt || d.forklaring) && (
        <p>
          {d.endepunkt ? (
            <>
              Hentes fra <code>{d.endepunkt}</code>
              {d.forklaring ? ': ' : '.'}
            </>
          ) : (
            'Slik lages den: '
          )}
          {d.forklaring}
        </p>
      )}
      {bygger.length > 0 && (
        <p>
          Bygger på{' '}
          {bygger.map((n, i) => (
            <span key={n}>
              {i > 0 && (i === bygger.length - 1 ? ' og ' : ', ')}«{tabellen(n).tittel}» <code>{n}</code>
            </span>
          ))}
          .
        </p>
      )}
      {d.usikkerhet.length > 0 && (
        <>
          <p>Usikkerhet:</p>
          <ul className="usikkerhet">
            {d.usikkerhet.map(u => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </>
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

/* En gruppe i et lag: overskriften, om den er et filnavn (fil), tabellene med data, og støttedataene til hver (stotteFor) */
interface Gruppe {
  tittel: string;
  fil: boolean;
  data: Tabellen[];
  stotteFor: (d: Tabellen) => Tabellen[];
}
/* Gull etter kortene som viser tallene, i rekkefølgen kortene står. En tabell står under det første kortet som viser den. Støttedataene
   et kort bygger på, også gjennom andre støttedata, står bak knappen på den siste tabellen kortet viser, under det første kortet som
   bygger på dem. Det som ikke hører til noe kort, står sist som «Andre støttedata». */
function gullEtterKort(T: Tabellen[]): Gruppe[] {
  const finn = new Map(T.map(d => [d.navn, d])),
    brukt = new Set<string>(),
    grupper: Gruppe[] = [];
  /* støttedataene tabellen n bygger på, gjennom støttedata */
  const bygger = (n: string, ut: Set<string>) => {
    for (const a of AVHENGIGHETER[n] || []) {
      const d = finn.get(a);
      if (!d || !d.stotte || ut.has(a)) continue;
      ut.add(a);
      bygger(a, ut);
    }
  };
  for (const k of KORT) {
    const data = k.tabeller.map(n => finn.get(n)).filter((d): d is Tabellen => !!d && !d.stotte && !brukt.has(d.navn));
    if (!data.length) continue;
    const S = new Set<string>();
    for (const n of k.tabeller) bygger(n, S);
    const stotte = [...S].map(n => finn.get(n)!).filter(d => !brukt.has(d.navn));
    [...data, ...stotte].forEach(d => brukt.add(d.navn));
    const siste = data[data.length - 1];
    grupper.push({
      tittel: (k.gruppe === 'tvilling' ? 'Tvillingen: ' : '') + k.tittel,
      fil: false,
      data,
      stotteFor: d => (d === siste ? stotte : [])
    });
  }
  const rest = T.filter(d => !brukt.has(d.navn));
  if (rest.length) grupper.push({ tittel: 'Andre støttedata', fil: false, data: rest, stotteFor: () => [] });
  return grupper;
}
/* Bronse og sølv etter ETL-filen, med støttedataene i hvert datasett under den siste tabellen med data i datasettet i laget, og
   støttedata som ikke hører til ett datasett, sist som «Andre støttedata» */
function etterFil(T: Tabellen[], lag: string): Gruppe[] {
  const vises = T.filter(d => !d.stotte) /* støttedataene står under dataene de støtter */,
    andre = T.filter(d => d.stotte && !d.datasett),
    stotteFor = (d: Tabellen) =>
      d.datasett && T.filter(x => x.datasett && x.datasett.navn === d.datasett!.navn && !x.stotte).pop() === d
        ? T.filter(s => s.stotte && s.datasett && s.datasett.navn === d.datasett!.navn)
        : [];
  return [
    ...[...new Set(vises.map(d => d.fil))].map(fil => ({
      tittel: fil.startsWith(lag + '/') ? fil.slice(lag.length + 1) : fil,
      fil: true,
      data: vises.filter(d => d.fil === fil),
      stotteFor
    })),
    ...(andre.length ? [{ tittel: 'Andre støttedata', fil: false, data: andre, stotteFor: () => [] }] : [])
  ];
}
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

/* Det som ikke er ferdig i tabellen: nøklene som henter, har feilet eller er utdatert */
const uferdigeI = (d: Tabellen) => d.rader.filter(x => x.status !== 'ok' || x.utdatert);
/* Én tabell i katalogen: tittelen, hvor mye som er lagret, og knappene Info og Data med det de viser under. Dataene i et datasett har i
   tillegg knappen «Støttedata», som viser hva hver støttedata i laget er til for, og så støttedataene under raden. Bare én av de tre knappene
   på en rad er åpen om gangen. Det som ikke er ferdig i støttedataene, står også på raden, så det ikke skjules. Støttedata har
   innholdet under tittelen. */
function Tabellrad({
  d,
  apen,
  veksle,
  stotte = []
}: {
  d: Tabellen;
  apen: Apen;
  veksle: (navn: string, hva: 'info' | 'data') => void;
  stotte?: Tabellen[];
}) {
  const [visStotte, settVisStotte] = useState(false),
    r = d.rader,
    uferdige = uferdigeI(d),
    uferdigStotte = stotte.filter(s => uferdigeI(s).length),
    her = apen && apen.navn === d.navn ? apen.hva : null,
    id = 'katalog-' + d.navn.replace('.', '-'),
    tittel = d.tittel,
    /* Info og Data lukker støttedataene, og støttedataene lukker Info og Data på raden */
    vis = (hva: 'info' | 'data') => {
      settVisStotte(false);
      veksle(d.navn, hva);
    },
    visStotteNa = () => {
      if (!visStotte && her) veksle(d.navn, her);
      settVisStotte(!visStotte);
    };
  return (
    <>
      <tr className={d.stotte ? 'stotterad' : undefined}>
        <th scope="row">
          {tittel}
          {d.stotte && d.innholdet && <small>{d.innholdet}</small>}
        </th>
        <td className="tall">
          {d.husk ? `${nf(r.length, 0)} av ${d.husk === Infinity ? 'alle' : nf(d.husk, 0)}` : 'lagres ikke'}
          {r.length > 0 && <small>{kb(sum(d))}</small>}
          {uferdige.length > 0 && (
            <small className="uferdig">{uferdige.map(x => `${nokkelen(x.nokkel)} ${statusen(x)}`).join(', ')}</small>
          )}
          {uferdigStotte.length > 0 && (
            <small className="uferdig">
              Støttedata: {uferdigStotte.map(s => `${s.tittel} ${uferdigeI(s).map(statusen).join(', ')}`).join('; ')}
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
              aria-label={`Info om ${tittel} (${d.navn})`}
              onClick={() => vis('info')}
            >
              Info
            </MdButton>
            <MdButton
              theme="tertiary"
              mode="small"
              aria-expanded={her === 'data'}
              aria-controls={her === 'data' ? id : undefined}
              aria-label={`Data i ${tittel} (${d.navn})`}
              onClick={() => vis('data')}
            >
              Data
            </MdButton>
          </div>
          {stotte.length > 0 && (
            <div className="knapper">
              <MdButton
                theme="tertiary"
                mode="small"
                aria-expanded={visStotte}
                aria-controls={visStotte ? id + '-stotte' : undefined}
                aria-label={`Støttedata for ${tittel}, ${stotte.length} tabeller`}
                onClick={visStotteNa}
              >
                Støttedata ({stotte.length})
              </MdButton>
            </div>
          )}
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
                    r.map(x => <Rad key={x.nokkel} navn={d.navn} r={x} t={d} />)
                  ) : (
                    <p>Ingenting lagret ennå.</p>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}
      {visStotte && (
        <>
          <tr className="stotteforklaring" id={id + '-stotte'}>
            <td colSpan={3}>
              <b>Støttedata</b> trengs for å hente, forstå og regne med dataene. De er opplysninger om dataene, dataene
              i en annen form eller mellomregninger, ikke nye data.
              {d.datasett && d.datasett.stotte && (
                <ul>
                  {d.datasett.stotte
                    .filter(([navn]) => stotte.some(s => s.tittel.split(', ')[0] === navn))
                    .map(([navn, hva]) => (
                      <li key={navn}>
                        <b>{navn}:</b> {hva}
                      </li>
                    ))}
                </ul>
              )}
            </td>
          </tr>
          {stotte.map(s => (
            <Tabellrad key={s.navn} d={s} apen={apen} veksle={veksle} />
          ))}
        </>
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
        Tabellene i datapipelinen, og hva cachen har lagret i hver akkurat nå. I bronse og sølv står de etter filen de
        lages i, og hvert datasett som én rad med dataene. Støttedataene, som trengs for å hente, forstå og regne med
        dataene, ligger bak knappen «Støttedata». Støttedata som ikke hører til ett datasett, står sist i laget som
        «Andre støttedata». Gull står etter kortene som viser tallene, med mellomregningene og hurtigminnet som
        støttedata. «Info» sier hva tabellen er og hvor ETL-funksjonen ligger. «Data» viser det som ligger i cachen.
        Tabeller som ikke lagrer, kan spørres i stedet, også fra kildene, men ikke etter noe som ikke finnes. Alt ligger
        i minnet og er borte når siden lukkes: siden lagrer ingenting selv i nettleseren. Nettleserens vanlige
        hurtigbuffer kan likevel ta vare på svar fra tjenestene, slik tjenestene selv bestemmer.
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
            grupper = lag === 'gull' ? gullEtterKort(T) : etterFil(T, lag);
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
                  {grupper.map(g => (
                    <tbody key={g.tittel}>
                      <tr className="gruppe">
                        <th colSpan={3} scope="colgroup">
                          {g.fil ? <code>{g.tittel}</code> : g.tittel}
                        </th>
                      </tr>
                      {g.data.map(d => (
                        <Tabellrad key={d.navn} d={d} apen={apen} veksle={veksle} stotte={g.stotteFor(d)} />
                      ))}
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
