import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import './styles.css';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/plus-jakarta-sans';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders><AppRouter /></AppProviders>
  </StrictMode>,
);
