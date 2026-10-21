/* Testsiden: velg en kommune, og siden spør i GeoParquet-filen med verneområdene (parquet.ts) etter dem som ligger i kommunen. Siden
   viser hvor mye som er hentet av filen, så man ser at den ikke lastes ned. Kommunelisten er den samme som hovedsiden bruker
   (kommuner.json, én mappe opp). */
import { useEffect, useMemo, useState } from 'react';
import { MdAlertMessage, MdComboBox, MdLoadingSpinner } from '../src/ui/komponenter/md.ts';
import { kb, nf } from '../src/ui/tekst.ts';
import { FIL, KOLONNER, dato, hentet, iKommunen, verneform, verneomrader, Sporrefeil, type Verneomrade } from './parquet.ts';

type Kommuneliste = [fylke: string, navn: string, kommuner: [nr: string, navn: string, ...utsnitt: number[]][]][];
type Svar =
  | { tilstand: 'henter' }
  | { tilstand: 'ok'; R: Verneomrade[] }
  | { tilstand: 'feil'; feil: unknown };

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
          ? 'Nettleseren fikk ikke lese filen. Lagringskontoen tillater ikke at andre nettsider leser den (CORS er ikke slått på). Eieren av lagringskontoen må slå på CORS for denne siden, med GET, HEAD og OPTIONS, overskriften Range, og Content-Range og Content-Length som synlige overskrifter i svaret.'
          : hva === 'helefilen'
            ? 'Tjenesten svarte med hele filen i stedet for bare biten siden spurte etter, så hentingen ble stoppet.'
            : `Noe gikk galt: ${feil instanceof Error ? feil.message : String(feil)}`
      }
    />
  );
}

export default function App() {
  const [liste, settListe] = useState<Kommuneliste>([]),
    [nr, settNr] = useState(''),
    [svar, settSvar] = useState<Svar | null>(null);
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
    settSvar({ tilstand: 'henter' });
    verneomrader()
      .then(R => settSvar({ tilstand: 'ok', R: iKommunen(R, n) }))
      .catch(feil => settSvar({ tilstand: 'feil', feil }));
  };
  const kommunen = navnPa.get(nr) || nr;
  return (
    <main className="parquet">
      <p className="tilbake">
        <a href="../">Til Kommunalt naturregnskap</a>
      </p>
      <h1 className="md-typography-heading-l">Verneområder fra en GeoParquet-fil</h1>
      <p>
        En test av å spørre direkte i en fil på nettet, uten å laste den ned. Filen har alle verneområdene i Norge, med flatene, og
        er rundt 33 MB. Siden henter bare beskrivelsen av filen og kolonnene den trenger ({KOLONNER.join(', ')}), med
        Range-forespørsler. Flatene hentes ikke.
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
      {svar && svar.tilstand === 'henter' && (
        <p className="henter" role="status">
          <MdLoadingSpinner /> Spør i filen …
        </p>
      )}
      {svar && svar.tilstand === 'feil' && <Feilen feil={svar.feil} />}
      {svar && svar.tilstand === 'ok' && (
        <>
          <h2 className="md-typography-heading-m">
            {svar.R.length
              ? `${nf(svar.R.length, 0)} ${svar.R.length === 1 ? 'verneområde' : 'verneområder'} i ${kommunen}`
              : `Ingen verneområder i ${kommunen}`}
          </h2>
          <p className="hentet" role="status">
            Hentet {kb(hentet.byte)} av {kb(hentet.fil)} i {nf(hentet.kall, 0)} kall. Det som er hentet, brukes om igjen for
            neste kommune.
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
                    <tr key={r.faktaark || r.navn}>
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
        </>
      )}
      <p className="kilde">
        Kilde: Miljødirektoratet, Naturvernområder (NLOD 2.0), som testfil i GeoParquet:{' '}
        <a href={FIL}>{decodeURIComponent(FIL.split('/').pop()!)}</a>. Lenken laster ned hele filen.
      </p>
    </main>
  );
}
