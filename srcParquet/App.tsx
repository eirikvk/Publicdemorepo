/* Testsiden: velg en kommune, og siden spør i GeoParquet-filen med verneområdene (parquet.ts) etter dem som ligger i kommunen.
   Flatene hentes når man ber om dem, og tegnes (Flatene.tsx). Siden viser hvor mye hvert steg hentet av filen, så man ser at den
   ikke lastes ned. Kommunelisten er den samme som hovedsiden bruker (kommuner.json, én mappe opp). */
import { useEffect, useMemo, useState } from 'react';
import { MdAlertMessage, MdButton, MdComboBox, MdLoadingSpinner } from '../src/ui/komponenter/md.ts';
import { kb, nf } from '../src/ui/tekst.ts';
import { Flatene } from './Flatene.tsx';
import {
  BOTTA,
  FIL,
  STAC,
  TEKST,
  dato,
  flateneI,
  hentet,
  iKommunen,
  verneform,
  Sporrefeil,
  type Flate,
  type Hentet,
  type Verneomrade
} from './parquet.ts';

type Kommuneliste = [fylke: string, navn: string, kommuner: [nr: string, navn: string, ...utsnitt: number[]][]][];
type Tilstand<T> =
  { tilstand: 'henter' } | { tilstand: 'ok'; R: T; hentet: Hentet } | { tilstand: 'feil'; feil: unknown };

/* Forklaringen på en feil, med det som må gjøres */
function Feilen({ feil }: { feil: unknown }) {
  const hva = feil instanceof Sporrefeil ? feil.hva : 'annet';
  return (
    <MdAlertMessage
      theme="error"
      fullWidth
      label="Spørringen virket ikke"
      description={
        hva === 'cors'
          ? 'Nettleseren fikk ikke lese filen. Enten tillater ikke tjenesten at andre nettsider leser den (CORS), eller så fikk nettleseren ikke kontakt med tjenesten.'
          : hva === 'helefilen'
            ? 'Tjenesten svarte med hele filen i stedet for bare biten siden spurte etter, så hentingen ble stoppet.'
            : `Noe gikk galt: ${feil instanceof Error ? feil.message : String(feil)}`
      }
    />
  );
}
/* Hva et steg hentet, eller at det var hentet før */
const Kostet = ({ H, hva }: { H: Hentet; hva: string }) => (
  <>
    {H.kall
      ? `${hva}: ${kb(H.byte)} i ${nf(H.kall, 0)} kall${H.apnet ? ', med beskrivelsen av filen, sideindeksen og kommunekolonnen, som bare hentes første gang' : ''}.`
      : `${hva}: hentet før, ingenting nytt.`}
  </>
);
const Henter = ({ tekst }: { tekst: string }) => (
  <p className="henter" role="status">
    <MdLoadingSpinner /> {tekst}
  </p>
);

export default function App() {
  const [liste, settListe] = useState<Kommuneliste>([]),
    [nr, settNr] = useState(''),
    [svar, settSvar] = useState<Tilstand<Verneomrade[]> | null>(null),
    [flater, settFlater] = useState<Tilstand<Flate[]> | null>(null);
  useEffect(() => {
    fetch(new URL('../kommuner.json', location.href))
      .then(r => r.json())
      .then(settListe)
      .catch(() => settListe([]));
  }, []);
  /* Kommunene som valg, og navnet på hver kommune etter nummeret */
  const kommuner = useMemo(
    () =>
      liste
        .flatMap(([, fylke, K]) => K.map(([n, navn]) => ({ value: n, text: navn, fylke })))
        .sort((a, b) => a.text.localeCompare(b.text, 'nb')),
    [liste]
  );
  const navnPa = useMemo(() => new Map(kommuner.map(k => [k.value, k.text])), [kommuner]);
  const velg = (n: string) => {
    settNr(n);
    settFlater(null);
    settSvar({ tilstand: 'henter' });
    iKommunen(n)
      .then(s => settSvar({ tilstand: 'ok', ...s }))
      .catch(feil => settSvar({ tilstand: 'feil', feil }));
  };
  const hentFlatene = () => {
    const n = nr;
    settFlater({ tilstand: 'henter' });
    flateneI(n)
      .then(s => n === nr && settFlater({ tilstand: 'ok', ...s }))
      .catch(feil => settFlater({ tilstand: 'feil', feil }));
  };
  const kommunen = navnPa.get(nr) || nr;
  const navnPaRad = useMemo(
    () => new Map(svar && svar.tilstand === 'ok' ? svar.R.map(r => [r.rad, r.navn]) : []),
    [svar]
  );
  return (
    <main className="parquet">
      <p className="tilbake">
        <a href="../">Til Kommunalt naturregnskap</a>
      </p>
      <h1 className="md-typography-heading-l">Verneområder fra en GeoParquet-fil</h1>
      <p>
        En test av å spørre direkte i en fil på nettet, uten å laste den ned. Filen har alle verneområdene i Norge, med
        flatene, og er rundt 33 MB. Den er sortert etter kommune og har en sideindeks, som sier hvor radene ligger.
        Siden henter først beskrivelsen av filen og kolonnen med kommunene, så bare radene i kommunen du velger (
        {TEKST.join(', ')}). Flatene hentes når du ber om dem. Alt hentes med Range-forespørsler, som ber om bare en bit
        av filen.
      </p>
      <div className="velger">
        <MdComboBox
          label="Kommune"
          options={kommuner}
          value={nr}
          placeholder={kommuner.length ? 'Søk etter kommune' : 'Henter …'}
          noResultsText="Ingen kommune med det navnet"
          disabled={!kommuner.length}
          onSelectOption={v => v && v !== nr && velg(v as string)}
        />
      </div>
      {svar && svar.tilstand === 'henter' && <Henter tekst="Spør i filen …" />}
      {svar && svar.tilstand === 'feil' && <Feilen feil={svar.feil} />}
      {svar && svar.tilstand === 'ok' && (
        <>
          <h2 className="md-typography-heading-m">
            {svar.R.length
              ? `${nf(svar.R.length, 0)} ${svar.R.length === 1 ? 'verneområde' : 'verneområder'} i ${kommunen}`
              : `Ingen verneområder i ${kommunen}`}
          </h2>
          <p className="hentet" role="status">
            <Kostet H={svar.hentet} hva={`Radene for ${kommunen}`} /> Til sammen er {kb(hentet.byte)} av{' '}
            {kb(hentet.fil)} hentet, i {nf(hentet.kall, 0)} kall.
          </p>
          {svar.R.length > 0 && (
            <div className="rullbar">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Navn</th>
                    <th scope="col">Verneform</th>
                    <th scope="col">Vernet</th>
                    <th scope="col">Kommuner</th>
                  </tr>
                </thead>
                <tbody>
                  {svar.R.map(r => (
                    <tr key={r.rad}>
                      <th scope="row">
                        {r.faktaark ? (
                          <a href={r.faktaark} target="_blank" rel="noopener">
                            {r.navn}
                          </a>
                        ) : (
                          r.navn
                        )}
                      </th>
                      <td>{verneform(r.verneform)}</td>
                      <td>{dato(r.vernedato)}</td>
                      <td>
                        {(r.kommune || '')
                          .split(',')
                          .map(k => navnPa.get(k) || k)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {svar.R.length > 0 && !flater && (
            <div>
              <MdButton theme="secondary" mode="small" onClick={hentFlatene}>
                Hent flatene
              </MdButton>
            </div>
          )}
          {flater && flater.tilstand === 'henter' && <Henter tekst="Henter flatene …" />}
          {flater && flater.tilstand === 'feil' && <Feilen feil={flater.feil} />}
          {flater && flater.tilstand === 'ok' && (
            <>
              <h3 className="md-typography-heading-s">Flatene</h3>
              <p className="hentet" role="status">
                <Kostet H={flater.hentet} hva={`Flatene for ${kommunen}`} /> Til sammen er {kb(hentet.byte)} av{' '}
                {kb(hentet.fil)} hentet. Hold over en flate for å se navnet. Områder som også ligger i andre kommuner,
                er tegnet hele.
              </p>
              <Flatene
                F={flater.R}
                navn={navnPaRad}
                tittel={`Flatene for ${nf(flater.R.length, 0)} verneområder i ${kommunen}`}
              />
            </>
          )}
        </>
      )}
      <p className="kilde">
        Kilde: Miljødirektoratet, Naturvernområder (NLOD 2.0), lagt ut som GeoParquet i bøtta{' '}
        <a href={BOTTA}>eirikvk/naturdata</a> på Hugging Face, med en beskrivelse av hvordan filen er laget og en{' '}
        <a href={STAC}>STAC-katalog</a>. Filen: <a href={FIL}>{FIL.split('/').pop()}</a>. Lenken laster ned hele filen.
      </p>
    </main>
  );
}
