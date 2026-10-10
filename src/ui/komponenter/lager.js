/* Kobler sidens komponenter til tilstanden i motoren. Komponenten som bruker kroken, tegnes på nytt hver gang motoren melder at noe
   i app er endret. Alt under den leser tilstanden direkte fra app og temaene. */
import { useSyncExternalStore } from 'react';
import { abonner, tilstandsutgave } from '../../data/motor/felles.js';

export const useApp = () => useSyncExternalStore(abonner, tilstandsutgave);
