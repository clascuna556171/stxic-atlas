import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import Landing from './Landing';
import { applyAppearance, readAppearance } from '../src/theme';
import './landing.css';

applyAppearance(readAppearance());
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Landing /></React.StrictMode>,
);
