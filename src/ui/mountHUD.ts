import * as Vue from 'vue';
import { compileScript, parse } from '@vue/compiler-sfc';
import hudSource from './GameHUD.vue?raw';
import type { GameCommand, GameSnapshot } from '../engine/types';

let component: Vue.Component | null = null;

function compileHUD(): Vue.Component {
  if (component) return component;
  const { descriptor, errors } = parse(hudSource, { filename: 'GameHUD.vue' });
  if (errors.length) throw new Error(`HUD: ${String(errors[0])}`);
  const script = compileScript(descriptor, {
    id: 'breach-hud', genDefaultAs: '__hud', inlineTemplate: true, isProd: true,
  });
  // Keep the host's React Vite configuration; compile only this trusted, bundled SFC.
  const code = script.content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]vue['"];?/g, (_, imports: string) =>
    `const { ${imports.replace(/\s+as\s+/g, ': ')} } = Vue;`,
  );
  component = new Function('Vue', `${code}\nreturn __hud;`)(Vue) as Vue.Component;
  return component;
}

export function mountHUD(element: HTMLElement, state: GameSnapshot, dispatch: (command: GameCommand) => void): Vue.App {
  const app = Vue.createApp(compileHUD(), { state, dispatch });
  app.mount(element);
  return app;
}