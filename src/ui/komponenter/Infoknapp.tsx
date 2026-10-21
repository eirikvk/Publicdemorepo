/* Infoknappen som forklarer tallene, og panelet den åpner. Panelet har tre lag: kort fortalt, regnestykket for valgt kommune
   (tallene fra gull satt inn i tekst), og stegene fra kilde til tall med usikkerheten og lenker til metoden og koden. I stegene står
   hver kilde sammen med det den justeres til i sølv: «hentes fra … og justeres til …» (infostegFor). Et kort med tall (tall i
   kortet, foreløpig verdsatt natur) har ingen infoboks for hele kortet, men én per tall, der tallet står, og hver av dem står på
   egne bein: kort fortalt og regnestykket for tallet, stegene fra kilde til det tallet og usikkerheten (linjeFor). Kildene står
   først, med kildens egen beskrivelse og detaljene bak en knapp, så stegene i gull, der støttedataene står under steget som bruker
   dem. Det er ingen infobokser inni hverandre, og ingen henvisninger til andre infobokser. Innholdet står i src/ui/forklaringer.ts
   og i katalogen, så det samme står i METODE.md og katalogvisningen. Hovedsiden bruker knappen ved overskriften på kortene
   (Tallforklaring.tsx) og ved tallene på temasidene, og tvillingen fra Figma ved figurene og tallkortene. Filen bruker ingen av sidene
   på hovedsiden, så tvillingen kan bruke den. */
import { useId, useState, type ReactNode } from 'react';
import { valgtNr, verdi } from '../../data/motor/valgt.ts';
import { app } from '../../data/motor/tilstand.ts';
import {
  ankerFor,
  infostegFor,
  kortet,
  linjeFor,
  REPO,
  tabellen,
  usikkerhetFor,
  type Kildesteg,
  type Kort,
  type Steg
} from '../forklaringer.ts';
import { MdHelpButton, MdHelpText } from './md.ts';
import './Tallforklaring.css';

/* Lenken til kortet som forklarer et steg: til siden der kortet står, eller til kapitlet i METODE.md */
export type Se = (k: Kort) => ReactNode;

/* Infoknappen og panelet med forklaringen for kortet med id-en kort, hver for seg, så de kan stå der det passer: knappen ved
   overskriften eller tallet, og panelet rett under. Panelet er der bare når knappen er trykket. Uten kort er begge tomme. se lager
   lenken til kortet som forklarer et steg, når det er et annet kort. tall er tabellen for ett tall i et kort med tall: da forklarer
   infoboksen bare det tallet. Et kort med tall har ingen infoboks for hele kortet, og et tall kortet ikke har, heller ingen. */
export function useInfoknapp(kort: string | null, se: Se, tall?: string) {
  const [apen, settApen] = useState(false),
    panel = useId();
  const k = kort ? kortet(kort) : null;
  if (!k || (k.tall ? !tall || !k.tall[tall] : !!tall)) return { knapp: null, panel: null };
  const tittel = `Om tallene: ${tall ? tabellen(tall).tittel : k.tittel}`;
  return {
    knapp: (
      <MdHelpButton
        expanded={apen}
        labels={{ helpText: tittel }}
        aria-pressed={undefined}
        aria-expanded={apen}
        aria-controls={panel}
        onClick={() => settApen(!apen)}
      />
    ),
    panel: apen ? (
      <MdHelpText id={panel} role="region" aria-label={tittel} className="tallforklaring">
        {tall ? <Tallet k={k} t={tall} /> : <Innhold kort={k.id} se={se} />}
      </MdHelpText>
    ) : null
  };
}

/* Forklaringen på et steg. En kilde i bronse sier hvor den hentes fra: endepunktet, eller bare «Hentes» når den har eier uten
   endepunkt. */
const Hentes = ({ t: { tabell: t } }: { t: Steg }) => (
  <>
    {t.endepunkt ? (
      <>
        Hentes fra <code>{t.endepunkt}</code>:{' '}
      </>
    ) : t.kilde ? (
      'Hentes: '
    ) : (
      ''
    )}
    {t.forklaring}
  </>
);
/* Kilden til et steg i bronse, med lenke til datasettet og lisensen */
const Kilde = ({ t: { tabell: t } }: { t: Steg }) =>
  t.kilde ? (
    <>
      {' '}
      Kilde:{' '}
      <a href={t.kilde.adresse}>
        {t.kilde.navn}, {t.kilde.datasett}
      </a>
      , {t.kilde.lisens}.
    </>
  ) : null;

/* Innholdet i panelet. Regnestykket leser tabellene i gull for valgt kommune, og vises når de er klare. */
function Innhold({ kort, se }: { kort: string; se: Se }) {
  const k = kortet(kort),
    linjer = valgtNr() && k.regnestykke ? k.regnestykke(verdi) : null;
  return (
    <>
      <p>{k.kortFortalt}</p>
      {linjer && (
        <>
          <h3>Slik er tallene regnet ut for {app.valgt!.navn}</h3>
          <ul className="regnestykke">
            {linjer.map(l => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}
      <details>
        <summary>Fra kilde til tall</summary>
        <ol>
          {infostegFor(k).map(i =>
            'kilde' in i ? (
              <li key={i.kilde.navn}>
                <b>{i.kilde.tabell.tittel}.</b> <Hentes t={i.kilde} />
                <Kilde t={i.kilde} />
                {i.justeres.map(j => (
                  <span key={j.navn} className="justeres">
                    Justeres: {j.tabell.forklaring}
                  </span>
                ))}
                <span className="koder">
                  {[i.kilde, ...i.justeres].map(j => (
                    <code key={j.navn}>{j.navn}</code>
                  ))}
                </span>
              </li>
            ) : (
              <li key={i.steg.navn}>
                <b>{i.steg.tabell.tittel}.</b>{' '}
                {i.steg.se ? <>Forklart under {se(i.steg.se)}.</> : <Hentes t={i.steg} />}
                {!i.steg.se && <Kilde t={i.steg} />} <code>{i.steg.navn}</code>
              </li>
            )
          )}
        </ol>
      </details>
      <Forbehold U={usikkerhetFor(k)} />
      <Lenker k={k} />
    </>
  );
}

/* Lenkene til metoden og koden for kortet */
const Lenker = ({ k }: { k: Kort }) => (
  <p className="lenker">
    <a href={REPO + 'METODE.md#' + ankerFor(k)}>Metoden</a>
    <a href={REPO + k.komponent}>Koden for kortet</a>
  </p>
);
/* Listen over forbehold bak en knapp */
const Forbehold = ({ U, tittel = 'Usikkerhet' }: { U: string[]; tittel?: string }) =>
  U.length > 0 ? (
    <details>
      <summary>{tittel}</summary>
      <ul>
        {U.map(u => (
          <li key={u}>{u}</li>
        ))}
      </ul>
    </details>
  ) : null;

/* Infoboksen for ett tall, på egne bein: kort fortalt, regnestykket for valgt kommune, stegene fra kilde til tall, usikkerheten for
   tallet og kortet, og lenkene. Første steg er kildene, med kildens egen beskrivelse; så stegene i gull, med støttedataene
   (mellomregningene) under steget som bruker dem. */
function Tallet({ k, t }: { k: Kort; t: string }) {
  const L = linjeFor(k, t),
    f = k.tall![t],
    linjer = valgtNr() ? f.regnestykke(verdi) : null;
  return (
    <>
      <p>{f.kortFortalt}</p>
      {linjer && linjer.length > 0 && (
        <>
          <h3>Slik er tallene regnet ut for {app.valgt!.navn}</h3>
          <ul className="regnestykke">
            {linjer.map(l => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </>
      )}
      <details>
        <summary>Fra kilde til tall</summary>
        <ol>
          {L.kilder.length > 0 && (
            <li>
              <b>{L.kilder.length === 1 ? 'Kilden' : 'Kildene'}.</b> Kort om dataene, slik kilden selv beskriver dem.
              <ul>
                {L.kilder.map(q => (
                  <Kildepunkt key={q.tabeller[0].navn} q={q} />
                ))}
              </ul>
            </li>
          )}
          {L.steg.map(s => (
            <li key={s.steg.navn}>
              <b>{s.steg.tabell.tittel}.</b> {s.steg.tabell.forklaring} <code>{s.steg.navn}</code>
              {s.underveis.length > 0 && (
                <details>
                  <summary>Mellomregninger</summary>
                  <ul>
                    {s.underveis.map(u => (
                      <li key={u.navn}>
                        <b>{u.tabell.tittel}.</b> {u.tabell.forklaring} <code>{u.navn}</code>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
        </ol>
      </details>
      <Forbehold U={[...L.usikkerhet, ...(k.usikkerhet || [])]} />
      <Lenker k={k} />
    </>
  );
}

/* En kilde: hvem og datasettet med lenke og lisens, og kildens egen beskrivelse (uten den: hva datasettet er hos oss). Bak knappen:
   tabellene i bronse og sølv som henter og gjør det om. */
function Kildepunkt({ q }: { q: Kildesteg }) {
  const beskrevet = q.kilder.filter(x => x.beskrivelse);
  return (
    <li>
      {q.kilder.length ? (
        q.kilder.map((x, i) => (
          <span key={x.adresse}>
            {i > 0 && ' '}
            <b>
              <a href={x.adresse}>
                {x.navn}: {x.datasett}
              </a>
            </b>
            , {x.lisens}.
          </span>
        ))
      ) : (
        <b>{q.datasett ? q.datasett.navn : q.tabeller[0].tabell.tittel}.</b>
      )}{' '}
      {beskrevet.length ? beskrevet.map(x => x.beskrivelse).join(' ') : q.datasett ? q.datasett.om : null}
      <details>
        <summary>Slik hentes og gjøres {q.kilder.length ? 'den' : 'det'} om</summary>
        <ul>
          {q.tabeller.map(s => (
            <li key={s.navn}>
              <b>{s.tabell.tittel}.</b> <Hentes t={s} /> <code>{s.navn}</code>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}
