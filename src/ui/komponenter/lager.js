/* Kobler sidens komponenter til tilstanden. Komponenten som bruker kroken, tegnes på nytt hver gang noe i app (datamotoren) eller ui
   (visningen) er endret. Alt under den leser tilstanden direkte derfra og fra temaene. */
import { useSyncExternalStore } from 'react';
import { abonner, tilstandsutgave } from '../../data/motor/tilstand.ts';

export const useApp = () => useSyncExternalStore(abonner, tilstandsutgave);
