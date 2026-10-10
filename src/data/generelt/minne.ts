/* Generelt: minne med fast plass. Det eldste går ut når det blir fullt, og det som legges inn på nytt, regnes som nytt. Brukes til
   svar fra kildene og til resultater for kommuner som er valgt før. */

/* Legger verdi inn i minne under nokkel. plass er hvor mange verdier minnet holder. */
export const husk = <K, V>(minne: Map<K, V>, nokkel: K, verdi: V, plass: number) => {
  minne.delete(nokkel);
  minne.set(nokkel, verdi);
  if (minne.size > plass) minne.delete(minne.keys().next().value as K);
};
