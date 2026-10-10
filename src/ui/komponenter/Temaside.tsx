/* Toppen og rammen for hver temaside: navnet, arealet i kommunen og andelen av landarealet, en linje om planlagt utbygging, og
   kilden nederst. Temasidene er Naturtema.tsx (verneområder, villrein og verdsatt natur), Inon.tsx og Graa.tsx. Tallene kommer ferdig
   regnet ut fra gull. */
import type { ReactNode } from 'react';
import type { Bildetall } from '../../data/gull/felles.ts';
import { app } from '../../data/motor/tilstand.ts';
import { Rute } from './deler.tsx';
import { andelTekst, dekar } from '../tekst.ts';
import './Temaside.css';

/* Toppen av en temaside: navnet, arealet i kommunen og andelen av landarealet (null når landarealet mangler), og en linje om
   planlagt utbygging. status er henter, feil, ingen eller ok. Detaljene står under, med kilden nederst. Mens temaet hentes, står det
   bare det. */
export function Temaside({
  id,
  navn,
  tall,
  under,
  kilde,
  children
}: {
  id: string;
  navn: string;
  tall: Bildetall<{ sum: number; andelLand: number | null }>;
  under?: ReactNode;
  kilde: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="temaside prosa" id={'tema-' + id}>
      <h2 className="md-typography-heading-s">
        <Rute id={id} />
        {navn}
      </h2>
      {tall.tilstand === 'ok' && (
        <div>
          <p>
            <b>{dekar(tall.sum)}</b> i kommunen
            {tall.andelLand !== null ? `, ${andelTekst(tall.andelLand)} av landarealet` : ''}
          </p>
          {under && <p className="hint temaunder">{under}</p>}
        </div>
      )}
      {tall.tilstand === 'henter' ? <p>{app.valgt ? 'Henter …' : ''}</p> : children}
      {kilde}
    </div>
  );
}
