import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { tuning } from './config/tuning';
import { doorPuzzle } from './game/door/doorPuzzle';
import { endingPuzzle } from './game/ending/endingPuzzle';
import { keyPuzzle } from './game/key/keyPuzzle';
import { maskDirector } from './game/mask/maskDirector';
import { headInput } from './tracking/headInput';
import './styles.css';

if (import.meta.env.DEV) {
  Object.assign(window, {
    maskmaker: {
      headInput,
      tuning,
      mask: maskDirector,
      key: keyPuzzle,
      door: doorPuzzle,
      ending: endingPuzzle,
    },
  });
}

// Block page scroll / pinch-zoom during play, but keep the debug panel usable.
const insideUi = (e: Event) => e.target instanceof Element && e.target.closest('[data-ui]') !== null;
document.addEventListener('touchmove', (e) => !insideUi(e) && e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
