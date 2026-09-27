import { useEffect, useRef, useState } from 'react';
import { reactive, type App as VueApp } from 'vue';
import { Game } from './engine/Game';
import { initialSnapshot } from './engine/types';
import { mountHUD } from './ui/mountHUD';

export default function App() {
  const worldElement = useRef<HTMLDivElement>(null);
  const hudElement = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!worldElement.current || !hudElement.current) return;
    let game: Game | undefined;
    let hud: VueApp | undefined;
    const state = reactive(initialSnapshot());
    try {
      hud = mountHUD(hudElement.current, state, (command) => game?.command(command));
      game = new Game(worldElement.current, (snapshot) => Object.assign(state, snapshot));
      setReady(true);
    } catch (cause) {
      console.error('BREACH initialization failed:', cause);
      hud?.unmount(); game?.dispose();
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar el motor 3D.');
    }
    return () => { hud?.unmount(); game?.dispose(); };
  }, []);

  return (
    <main className={`breach-app ${ready ? 'is-ready' : ''}`}>
      <div ref={worldElement} className="world-viewport" />
      <div className="scene-vignette" aria-hidden="true" />
      <div ref={hudElement} className="vue-hud-root" />
      {!ready && !error && (
        <div className="boot-screen" role="status">
          <span className="boot-wordmark">BREACH<span>.</span></span>
          <span className="boot-label">PREPARANDO EL TERRENO</span>
          <span className="boot-progress" />
        </div>
      )}
      {error && (
        <div className="boot-screen error-screen" role="alert">
          <span className="boot-wordmark">BREACH<span>.</span></span>
          <h1>No se pudo iniciar la escena.</h1>
          <p>Activa WebGL 2 y la aceleraci&oacute;n gr&aacute;fica en tu navegador y vuelve a intentarlo.</p>
          <details><summary>Detalles t&eacute;cnicos</summary><p>{error}</p></details>
          <button className="primary-button" onClick={() => window.location.reload()}>REINTENTAR</button>
        </div>
      )}
    </main>
  );
}
