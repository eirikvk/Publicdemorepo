/* Delene sidene i tvillingen er bygd av, etter Figma-skissene: brødsmuler, toppen av en temaside, tallkort, trekkspill, figurer med
   tekst og kilde, stolper, flisene for temaene, ressurser, og en ramme for det som ikke er laget ennå. Bildene fra skissene er ikke med
   (rettighetene er ikke avklart), så det står en plassholder i temaets farge der. */
import type { ReactNode } from 'react';
import { KILDE } from '../../src/data/katalog.ts';
import { MdAccordionItem, MdIconArrowForward, MdIconChevronForward, MdIconOpenInNew } from '../md.ts';
import { iTekst, pst } from '../../src/ui/tekst.ts';
import { lenke, type Rute } from '../navigasjon.ts';
import { Illustrasjon } from '../illustrasjoner.tsx';
import { GRUPPER, TEMAER, type Tema } from '../temaer.ts';
import { temaflis, type Svar } from '../tall.ts';

/* En lenke til en side i tvillingen */
export function Lenke({
  til,
  children,
  className,
  naa
}: {
  til: Rute;
  children: ReactNode;
  className?: string;
  naa?: boolean;
}) {
  return (
    <a className={className} aria-current={naa ? 'page' : undefined} {...lenke(til)}>
      {children}
    </a>
  );
}

/* Et tall som hentes, som tekst: verdien når den er der, ellers henter, feil eller ingen */
export function svar<T>(S: Svar<T>, vis: (v: T) => ReactNode, ingen = 'Ingen i kommunen'): ReactNode {
  if (S.s === 'ok') return vis(S.v);
  if (S.s === 'mangler') return <span className="mangler-tall">{S.hvorfor}</span>;
  return S.s === 'henter' ? <span className="henter">Henter …</span> : S.s === 'feil' ? 'Kunne ikke hentes' : ingen;
}

export function Brodsmuler({ tema }: { tema: Tema }) {
  return (
    <nav className="brodsmuler" aria-label="Du er her">
      <Lenke til={{ side: 'utforsk' }}>Utforsk naturen</Lenke>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{tema.navn}</span>
    </nav>
  );
}

/* Bildet for temaet: illustrasjonen (illustrasjoner.tsx), på temaets farge mens den tegnes */
export const Bilde = ({ tema, farge, liten }: { tema: string; farge: string; liten?: boolean }) => (
  <div
    className={'bilde' + (liten ? ' liten' : '')}
    style={{ ['--farge' as string]: `var(--${farge})` }}
    aria-hidden="true"
  >
    <Illustrasjon tema={tema} />
  </div>
);

/* Toppen av en temaside: tittel, ingress, trekkspill under, og bildet ved siden av (under ingressen på mobil) */
export function Helt({ tema, children }: { tema: Tema; children?: ReactNode }) {
  return (
    <section className="helt">
      <div className="helt-tekst">
        <h1 className="md-typography-heading-l">{tema.navn}</h1>
        <p className="ingress">{tema.ingress}</p>
      </div>
      <Bilde tema={tema.id} farge={tema.farge} />
      {children && <div className="trekkspill-liste">{children}</div>}
    </section>
  );
}

/* Ett trekkspill med pluss, som i skissene */
export const Trekkspill = ({ tittel, children }: { tittel: string; children: ReactNode }) => (
  <MdAccordionItem label={tittel} theme="add" hideCloseButton>
    <div className="trekkspill-innhold">{children}</div>
  </MdAccordionItem>
);

/* Tallkortene øverst: [etikett, tallet] */
export const Tallkort = ({ kort }: { kort: [etikett: string, tall: ReactNode][] }) => (
  <dl className="tallkort">
    {kort.map(([etikett, tall]) => (
      <div key={etikett}>
        <dt>{etikett}</dt>
        <dd>{tall}</dd>
      </div>
    ))}
  </dl>
);

/* Kilden under en figur, med lenke til datasettet */
export function Kilde({ kilder }: { kilder: (keyof typeof KILDE)[] }) {
  return (
    <div className="kilde">
      <b>Kilde:</b>
      {kilder.map(k => (
        <a key={k} href={KILDE[k].adresse} target="_blank" rel="noopener">
          {KILDE[k].datasett}, {KILDE[k].navn}
        </a>
      ))}
    </div>
  );
}

/* En figur: tittel, tekst og kilde til venstre, figuren til høyre (under på mobil) */
export function Figur({
  tittel,
  tekst,
  kilder,
  children,
  etter
}: {
  tittel: string;
  tekst: ReactNode;
  kilder: (keyof typeof KILDE)[];
  children: ReactNode;
  etter?: ReactNode;
}) {
  return (
    <section className="figur">
      <div className="figur-tekst">
        <h2 className="md-typography-heading-s">{tittel}</h2>
        <div className="figur-forklaring">{tekst}</div>
        <Kilde kilder={kilder} />
      </div>
      <div className="figur-flate">{children}</div>
      {etter && <div className="trekkspill-liste figur-etter">{etter}</div>}
    </section>
  );
}

/* Stående stolper med arealet over og navnet under, i kartets farger */
export interface Stolpe {
  navn: string;
  km2: number;
  farge: string;
  under?: string;
}
export function Stolper({ data, hva }: { data: Stolpe[]; hva: string }) {
  const maks = Math.max(...data.map(d => d.km2), 1e-9);
  return (
    <figure className="stolper" aria-label={hva}>
      {data.map(d => (
        <div className="stolpe" key={d.navn}>
          <div className="stolpe-ramme">
            <span className="stolpe-tall">{iTekst(d.km2)}</span>
            <div
              className="stolpe-fyll"
              style={{ height: `${Math.max(2, (d.km2 / maks) * 150)}px`, background: `var(--${d.farge})` }}
            />
          </div>
          <span className="stolpe-navn">
            {d.navn}
            {d.under && <small>{d.under}</small>}
          </span>
        </div>
      ))}
    </figure>
  );
}

/* Liggende stolper med tallet etter, til lange navn */
export function Liggende({ data, hva, tekst }: { data: Stolpe[]; hva: string; tekst?: (d: Stolpe) => string }) {
  const maks = Math.max(...data.map(d => Math.abs(d.km2)), 1e-9);
  return (
    <figure className="liggende" aria-label={hva}>
      {data.map(d => (
        <div className="liggende-rad" key={d.navn}>
          <span className="liggende-navn">{d.navn}</span>
          <span className="liggende-ramme">
            <span
              className="liggende-fyll"
              style={{ width: `${Math.max(0.5, (Math.abs(d.km2) / maks) * 100)}%`, background: `var(--${d.farge})` }}
            />
          </span>
          <span className="liggende-tall">{tekst ? tekst(d) : iTekst(d.km2)}</span>
        </div>
      ))}
    </figure>
  );
}

/* Et felt i skissen som ikke er laget ennå: hva det skal vise, og hva som trengs. merke står øverst (til vanlig «Ikke laget ennå»). */
export const Mangler = ({ tittel, trenger, merke }: { tittel: string; trenger: string; merke?: string }) => (
  <section className="mangler">
    <span className="mangler-merke">{merke || 'Ikke laget ennå'}</span>
    <h2 className="md-typography-heading-s">{tittel}</h2>
    <p>Krever: {trenger}</p>
  </section>
);

/* En fremhevet melding, som planlagt utbygging i temaet */
export const Fremhevet = ({ children, varsel }: { children: ReactNode; varsel?: boolean }) => (
  <div className={'fremhevet' + (varsel ? ' varsel' : '')}>{children}</div>
);

/* Ressurser: lenker ut, i to kolonner */
export function Ressurser({ lenker }: { lenker: [tekst: string, url: string][] }) {
  return (
    <section className="ressurser">
      <h2 className="md-typography-heading-s">Ressurser</h2>
      <ul>
        {lenker.map(([tekst, url]) => {
          const ut = /^https?:/.test(url);
          return (
            <li key={tekst}>
              <a href={url} {...(ut ? { target: '_blank', rel: 'noopener' } : {})}>
                <span>
                  {tekst}
                  {ut && <MdIconOpenInNew aria-label="(åpnes i ny fane)" />}
                </span>
                <MdIconChevronForward aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* Ofte stilte spørsmål: [spørsmål, svar] */
export function Sporsmal({ liste }: { liste: [sporsmal: string, svar: ReactNode][] }) {
  return (
    <section className="sporsmal">
      <h2 className="md-typography-heading-s">Ofte stilte spørsmål</h2>
      {liste.map(([s, sv]) => (
        <Trekkspill key={s} tittel={s}>
          {sv}
        </Trekkspill>
      ))}
    </section>
  );
}

/* «Utforsk neste perspektiv»: en flis per tema, unntatt det man står på */
export function NestePerspektiv({ unntatt }: { unntatt: string }) {
  return (
    <section className="neste">
      <h2 className="md-typography-heading-s">Utforsk neste perspektiv</h2>
      <ul className="fliser">
        {TEMAER.filter(t => t.id !== unntatt).map(t => (
          <li key={t.id}>
            <Lenke til={{ side: 'utforsk', tema: t.id }} className="flis">
              <Bilde tema={t.id} farge={t.farge} liten />
              <span className="flis-navn">{t.navn}</span>
              <MdIconArrowForward aria-hidden="true" />
            </Lenke>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* Temaene i gruppene sine, med arealet og andelen av landarealet. Til oversikten og «Utforsk naturen». */
export function Temagrupper() {
  return (
    <div className="temagrupper">
      {GRUPPER.map(g => (
        <section key={g}>
          <h3 className="md-typography-heading-xs">{g}</h3>
          <ul className="temakort">
            {TEMAER.filter(t => t.gruppe === g).map(t => {
              const S = temaflis(t.id);
              return (
                <li key={t.id}>
                  <Lenke til={{ side: 'utforsk', tema: t.id }} className="temakort-lenke">
                    <Bilde tema={t.id} farge={t.farge} />
                    <span className="temakort-tekst">
                      <b>{t.navn}</b>
                      <span>
                        {svar(
                          S,
                          v => `${v.andel !== null ? pst(v.andel) + ' % av landarealet, ' : ''}${iTekst(v.km2)}`
                        )}
                      </span>
                    </span>
                    <MdIconArrowForward aria-hidden="true" />
                  </Lenke>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
