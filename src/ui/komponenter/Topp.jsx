/* Toppen av siden: navnet på løsningen, valg av fylke og kommune, og overskriften med kommunen som er valgt. */
import { useMemo } from 'react';
import { app } from '../../data/motor/felles.js';
import { finn, velg, velgFylke } from '../../data/motor/handlinger.js';
import { MdComboBox, MdSelect } from './md.js';
import './Topp.css';

export default function Topp() {
  const valgt = app.valgt ? finn(app.valgt.nr) : null,
    fylke = valgt ? valgt[0] : null;
  /* Kommunevelgeren søker i alle kommuner. Uten søketekst viser den kommunene i valgt fylke. Navn som finnes i flere fylker, får
     fylket i parentes. */
  const alle = useMemo(() => {
    const antall = {};
    app.fylker.forEach(f => f.kommuner.forEach(k => (antall[k.navn] = (antall[k.navn] || 0) + 1)));
    return app.fylker.flatMap(f =>
      f.kommuner.map(k => ({ value: k.nr, text: antall[k.navn] > 1 ? `${k.navn} (${f.navn})` : k.navn, fylke: f.nr }))
    );
  }, [app.fylker]);
  const iFylket = useMemo(() => (fylke ? alle.filter(k => k.fylke === fylke.nr) : []), [alle, fylke]);
  const fylker = useMemo(() => app.fylker.map(f => ({ value: f.nr, text: f.navn })), [app.fylker]);
  return (
    <>
      <header className="topp">
        <div className="merke">
          Bebygd, jordbruk, natur<small>Direkte fra åpne kilder, uten egen server</small>
        </div>
        <div className="velgere">
          <MdSelect
            label="Fylke"
            options={fylker}
            value={fylke ? fylke.nr : ''}
            placeholder={app.fylker.length ? 'Velg fylke' : 'Henter …'}
            disabled={!app.fylker.length}
            onSelectOption={v => v && v !== (fylke && fylke.nr) && velgFylke(v)}
          />
          <MdComboBox
            label="Kommune"
            options={alle}
            defaultOptions={iFylket}
            value={app.valgt ? app.valgt.nr : ''}
            placeholder={app.fylker.length ? 'Søk etter kommune' : 'Henter …'}
            noResultsText="Ingen kommune med det navnet"
            disabled={!app.fylker.length}
            onSelectOption={v => v && v !== (app.valgt && app.valgt.nr) && velg(v)}
          />
        </div>
      </header>
      <div className="overskrift">
        <h1 className="md-typography-heading-l">
          {app.listeFeil ? 'Kommunelisten kunne ikke hentes' : valgt ? valgt[1].navn : 'Henter kommuner …'}
        </h1>
        <p className="hint">
          {app.listeFeil
            ? 'Sjekk nettforbindelsen og last siden på nytt.'
            : valgt
              ? `${valgt[0].navn} fylke · kommunenummer ${valgt[1].nr}`
              : ''}
        </p>
      </div>
    </>
  );
}
