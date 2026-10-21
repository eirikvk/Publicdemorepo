/* Inngangen til testsiden for spørring i GeoParquet: stilen fra designsystemet, skriften og grunnlaget fra hovedsiden (grunnlag.css),
   så siden */
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import '@miljodirektoratet/md-css/src/tokens/index.css';
import '@miljodirektoratet/md-css/src/typography.css';
import '@miljodirektoratet/md-css/src/utils.css';
import '@miljodirektoratet/md-css/src/formElements/combobox/combobox.css';
import '@miljodirektoratet/md-css/src/link/link.css';
import '@miljodirektoratet/md-css/src/loadingSpinner/loadingSpinner.css';
import '@miljodirektoratet/md-css/src/messages/alertMessage.css';
import '../src/grunnlag.css';
import './stil.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('rot')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
