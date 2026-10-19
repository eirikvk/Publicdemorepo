/* Overskriften på et kort med tall, med infoknappen som forklarer tallene (Infoknapp.tsx). Panelet åpnes rett under overskriften. Et
   steg et annet kort forklarer, lenker til siden der det kortet står. */
import type { ReactNode } from 'react';
import { kortet } from '../forklaringer.ts';
import { Sidelenke } from './deler.tsx';
import { useInfoknapp, type Se } from './Infoknapp.tsx';

const tilSiden: Se = k => <Sidelenke id={k.side}>{k.tittel}</Sidelenke>;

/* Overskriften (h2 med id-en) for kortet med id-en kort, med infoknappen, og panelet med forklaringen når knappen er trykket */
export function Korttittel({ kort, id, children }: { kort: string; id: string; children?: ReactNode }) {
  const { knapp, panel } = useInfoknapp(kort, tilSiden);
  return (
    <>
      <div className="korttittel">
        <h2 className="md-typography-heading-s" id={id}>
          {children || kortet(kort).tittel}
        </h2>
        {knapp}
      </div>
      {panel}
    </>
  );
}
