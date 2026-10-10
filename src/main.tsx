/* Inngangen til siden: stilen fra designsystemet, skriften, kartets stil og sidens felles stil, så selve siden. Hver komponent
   henter sin egen stil selv. Stilene lastes før kartet, så de er på plass når det lages. */
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@miljodirektoratet/md-css/src/tokens/index.css';
import '@miljodirektoratet/md-css/src/typography.css';
import '@miljodirektoratet/md-css/src/utils.css';
import '@miljodirektoratet/md-css/src/button/button.css';
import '@miljodirektoratet/md-css/src/chips/chips.css';
import '@miljodirektoratet/md-css/src/formElements/checkbox/checkbox.css';
import '@miljodirektoratet/md-css/src/formElements/combobox/combobox.css';
import '@miljodirektoratet/md-css/src/formElements/radiobutton/radiobutton.css';
import '@miljodirektoratet/md-css/src/formElements/radiogroup/radiogroup.css';
import '@miljodirektoratet/md-css/src/formElements/select/select.css';
import '@miljodirektoratet/md-css/src/help/help.css';
import '@miljodirektoratet/md-css/src/iconButton/iconButton.css';
import '@miljodirektoratet/md-css/src/link/link.css';
import '@miljodirektoratet/md-css/src/loadingSpinner/loadingSpinner.css';
import '@miljodirektoratet/md-css/src/messages/alertMessage.css';
import '@miljodirektoratet/md-css/src/toggle/toggle.css';
import 'ol/ol.css';
import './grunnlag.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FARGER } from './ui/farger.ts';
import App from './ui/komponenter/App.tsx';

/* Kartets farger som CSS-variabler, så tegnforklaringene bruker de samme fargene som kartet. */
for (const [id, verdi] of Object.entries(FARGER)) document.documentElement.style.setProperty('--' + id, verdi);

createRoot(document.getElementById('rot')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
