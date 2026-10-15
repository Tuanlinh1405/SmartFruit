import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppProviders } from './app/providers';
import './styles.css';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/plus-jakarta-sans';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders><App /></AppProviders>
  </React.StrictMode>,
);
