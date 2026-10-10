/* Tallene datamotoren har regnet ut for valgt kommune, lest fra katalogen gjennom window.motor, som siden setter med ?teknisk (se
   src/ui/teknisk.ts). Brukes av regresjonstesten, så tallene kan sammenlignes direkte og ikke bare som tekst. Funksjonen kjøres i nettleseren, så den kan bare
   bruke det som finnes i siden: typene hentes fra src, men ingen funksjoner. */
import type { Motor } from '../src/ui/teknisk.ts';

export function motortall() {
  const M: Motor | undefined = window.motor;
  if (!M) return null;
  const A = M.app,
    K = M.katalog,
    v = M.verdi,
    side = (id: string) => M.ui.side === id,
    r = (x: unknown) => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x),
    rund = (o: unknown): unknown =>
      o == null
        ? o
        : Array.isArray(o) || ArrayBuffer.isView(o)
          ? Array.from(o as ArrayLike<unknown>, rund)
          : typeof o === 'object'
            ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rund(v)]))
            : r(o);
  /* Utvalgte felt fra o, avrundet */
  const plukk = <T extends object, N extends keyof T>(o: T | null, ...navn: N[]) =>
    o ? Object.fromEntries(navn.map(n => [n, rund(o[n])])) : null;
  /* Tilstanden til en rad: henter, feil eller ok */
  const tilstand = (x: { status: string } | null) => (x ? x.status : null);
  const R = M.planrutenett(),
    T = M.valgt(K.solv.arealtall),
    P = v(K.solv.grense) ? M.valgt(K.gull.kommuneplan) : null,
    I = M.valgt(K.gull.inon),
    G = M.valgt(K.gull.graa),
    egne = R ? R.egneIder : [];
  return {
    valgt: A.valgt && A.valgt.nr,
    arealtall:
      T &&
      (T.status === 'ok'
        ? plukk({ tilstand: 'ok', a: T.verdi!.a, aar: T.verdi!.aar }, 'tilstand', 'a', 'aar')
        : { tilstand: T.status }),
    ferskvann: rund(T && T.status === 'ok' ? T.verdi!.ferskvann : null),
    flate: r(v(K.solv.grense) ? v(K.solv.grense)!.km2 : 0),
    historie: plukk(v(K.solv.historie), 'fra', 'til', 'a0', 'a1', 'endret'),
    planInfo:
      P &&
      (P.status === 'ok'
        ? plukk(
            { tilstand: P.verdi!.finnes ? 'ok' : 'ingen', dekning: P.verdi!.dekning, plan: P.verdi!.plan },
            'tilstand',
            'dekning',
            'plan'
          )
        : { tilstand: P.status === 'henter' ? 'sjekker' : 'feil' }),
    planTall: M.planTall(),
    plan: R && {
      ...plukk(R, 'n', 'sum', 'iDag', 'delvis', 'fliser', 'rute', 'w', 'h', 'antallEgne', 'egneTall'),
      basis: R.basis ? { rn: R.basis.rn, rj: R.basis.rj } : null
    },
    planSum: rund(v(K.gull.plansum)),
    tema: M.NATURTEMA.map(t => {
      const x = v(M.TEMATABELLER[t.id].tall);
      if (!x) return { id: t.id, data: null };
      const D = x.D,
        /* ruter med planlagt utbygging per område, og av dem i smale striper */
        plan = Array.from(D.plan),
        smal = Array.from(D.smal);
      return {
        id: t.id,
        feil: false,
        sum: r(D.sum),
        antall: D.omrader.length,
        klasser: rund(D.klasser || null),
        regnet: !!D.regnet,
        plan: plan.reduce((s, x) => s + x, 0),
        smal: smal.reduce((s, x) => s + x, 0),
        berort: plan.filter(x => x).length,
        kryss: D.kryss ? { S: rund(D.kryss.S), P: D.kryss.P ? rund(D.kryss.P) : null } : null,
        gap: D.gap ? { nat: D.gap.nat, ukjent: D.gap.ukjent, plan: D.gap.plan ? rund(D.gap.plan) : null } : null,
        kartlagt: D.ekstra ? r(D.ekstra.km2) : null,
        inne: D.inne ? rund(D.inne) : null
      };
    }),
    /* bildene av hele kommunen: tallene når de er hentet, ellers bare tilstanden */
    inon:
      I &&
      (I.status === 'ok'
        ? { tilstand: 'ok', soner: rund(I.verdi!.soner), sum: r(I.verdi!.sum) }
        : { tilstand: tilstand(I) }),
    graa:
      G &&
      (G.status === 'ok'
        ? { tilstand: 'ok', trinn: rund(G.verdi!.trinn), sum: r(G.verdi!.sum) }
        : { tilstand: tilstand(G) }),
    graaKryss: plukk(v(K.gull.graakryss), 'S', 'P', 'bebygd', 'gront', 'delvis', 'antallEgne'),
    egne: A.egne.map(g => {
      const i = egne.indexOf(g.id);
      return {
        navn: g.navn,
        kilde: g.kilde,
        km2: r(g.km2),
        deler: g.deler.length,
        tall: rund(i < 0 ? null : R!.egneTall[i])
      };
    }),
    vis: { inon: side('inon'), graa: side('graa'), smale: M.ui.visSmale },
    tema_paa: M.NATURTEMA.map(t => side(t.id))
  };
}
