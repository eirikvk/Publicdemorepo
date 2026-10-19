/* Inngangen til tvillingen fra Figma: stilen fra designsystemet, skriften, kartets stil og tvillingens egen stil, så siden. Tallene og
   kartet kommer fra den samme datamotoren som hovedsiden (src/data og src/ui/kart). */
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import '@miljodirektoratet/md-css/src/tokens/index.css';
import '@miljodirektoratet/md-css/src/typography.css';
import '@miljodirektoratet/md-css/src/utils.css';
import '@miljodirektoratet/md-css/src/accordionitem/accordionitem.css';
import '@miljodirektoratet/md-css/src/button/button.css';
import '@miljodirektoratet/md-css/src/formElements/checkbox/checkbox.css';
import '@miljodirektoratet/md-css/src/formElements/radiobutton/radiobutton.css';
import '@miljodirektoratet/md-css/src/formElements/radiogroup/radiogroup.css';
import '@miljodirektoratet/md-css/src/help/help.css';
import '@miljodirektoratet/md-css/src/iconButton/iconButton.css';
import '@miljodirektoratet/md-css/src/link/link.css';
import '@miljodirektoratet/md-css/src/loadingSpinner/loadingSpinner.css';
import '@miljodirektoratet/md-css/src/messages/alertMessage.css';
import '@miljodirektoratet/md-css/src/pagination/pagination.css';
import 'ol/ol.css';
import './stil.css';
import './farger.ts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FARGER } from '../src/ui/farger.ts';
import App from './App.tsx';

/* Kartets farger som CSS-variabler, så figurene bruker de samme fargene som kartet */
for (const [id, verdi] of Object.entries(FARGER)) document.documentElement.style.setProperty('--' + id, verdi);

createRoot(document.getElementById('rot')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
