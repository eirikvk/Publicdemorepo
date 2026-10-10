/* Typer for proj4 2.11, som ikke har egne. Bare det siden bruker: definisjoner av projeksjoner, og omregning av punkter. */
declare module 'proj4' {
  interface Omregner {
    forward(p: number[]): number[];
    inverse(p: number[]): number[];
  }
  interface Proj4 {
    (fra: string, til: string): Omregner;
    defs(navn: string): unknown;
    defs(navn: string, definisjon: unknown): void;
  }
  const proj4: Proj4;
  export = proj4;
}
