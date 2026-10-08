/* Tallene motoren har regnet ut, hentet fra tilstanden i siden (window.motor, som siden setter med ?teknisk). Brukes av
   regresjonstesten, så tallene kan sammenlignes direkte og ikke bare som tekst. Funksjonen kjøres i nettleseren. */
export function motortall() {
  const M = window.motor;
  if (!M) return null;
  const A = M.app,
    r = x => (typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x),
    rund = o =>
      o == null
        ? o
        : Array.isArray(o) || ArrayBuffer.isView(o)
          ? Array.from(o, rund)
          : typeof o === 'object'
            ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rund(v)]))
            : r(o);
  const plukk = (o, ...navn) => (o ? Object.fromEntries(navn.map(n => [n, rund(o[n])])) : null);
  const R = A.planRaster && A.valgt && A.planRaster.nr === A.valgt.nr ? A.planRaster : null;
  const sum = (o, f) => o.reduce((s, x) => s + (x[f] || 0), 0);
  return {
    valgt: A.valgt && A.valgt.nr,
    arealtall: plukk(A.arealtall, 'tilstand', 'a', 'aar'),
    ferskvann: rund(A.ferskvann),
    flate: r(A.flate),
    historie: plukk(A.historie, 'fra', 'til', 'a0', 'a1', 'endret'),
    planInfo: plukk(A.planInfo, 'tilstand', 'dekning', 'kilde'),
    planTall: A.planTall && A.planTall.tilstand,
    plan: R && {
      ...plukk(R, 'n', 'sum', 'iDag', 'delvis', 'fliser', 'rute', 'w', 'h', 'antallEgne', 'egneTall'),
      basis: R.basis ? { rn: R.basis.rn, rj: R.basis.rj } : null
    },
    planSum: rund(A.planSum),
    tema: M.NATURLAG.map(t => {
      const D = t.data;
      if (!D || !A.valgt || D.nr !== A.valgt.nr) return { id: t.id, data: null };
      const o = D.omrader || [];
      return {
        id: t.id,
        feil: !!D.feil,
        sum: r(D.sum),
        antall: o.length,
        klasser: rund(D.klasser || null),
        regnet: !!D.regnet,
        plan: sum(o, 'plan'),
        smal: sum(o, 'smal'),
        berort: o.filter(x => x.plan).length,
        kryss: D.kryss ? { S: rund(D.kryss.S), P: D.kryss.P ? rund(D.kryss.P) : null } : null,
        gap: D.gap ? { nat: D.gap.nat, ukjent: D.gap.ukjent, plan: D.gap.plan ? rund(D.gap.plan) : null } : null,
        kartlagt: D.ekstra ? r(D.ekstra.km2) : null,
        inne: D.ekstra && D.ekstra.inne ? rund(D.ekstra.inne) : null
      };
    }),
    inon: plukk(A.inon, 'tilstand', 'soner', 'sum'),
    graa: plukk(A.graa, 'tilstand', 'trinn', 'sum'),
    graaKryss: plukk(A.graaKryss, 'S', 'P', 'bebygd', 'gront', 'delvis', 'antallEgne'),
    egne: A.egne.map(g => ({ navn: g.navn, kilde: g.kilde, km2: r(g.km2), deler: g.deler.length, tall: rund(g.tall) })),
    vis: { ...A.vis, plan: A.planPaa, inon: A.inonPaa, graa: A.graaPaa, smale: A.visSmale },
    tema_paa: M.NATURLAG.map(t => t.paa)
  };
}
