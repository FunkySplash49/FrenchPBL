import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/tokens.css';
import '../styles/global.css';
import './lab.css';
import { LangProvider } from '../lib/lang';
import GameLab from './GameLab';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <GameLab />
    </LangProvider>
  </StrictMode>,
);
