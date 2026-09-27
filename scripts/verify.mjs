import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

const require = createRequire(import.meta.url);
const THREE = require('three');
const root = fileURLToPath(new URL('..', import.meta.url));
const configPath = resolve(root, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram(config.fileNames, config.options);
const diagnostics = [...config.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (file) => file,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  }));
  process.exitCode = 1;
  throw new Error('TypeScript verification failed.');
}
console.log('PASS: strict TypeScript.');

function loadIsolatedModule(path) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(require, module, module.exports);
  return module.exports;
}

const { initialSnapshot } = loadIsolatedModule('src/engine/types.ts');
const source = readFileSync(resolve(root, 'src/ui/GameHUD.vue'), 'utf8');
const { descriptor, errors } = parse(source, { filename: 'GameHUD.vue' });
assert.equal(errors.length, 0, 'Vue SFC must parse.');
const script = compileScript(descriptor, { id: 'breach-verify', genDefaultAs: '__hud', inlineTemplate: true, isProd: true });
const code = script.content.replace(/import\s*\{([^}]+)\}\s*from\s*['"]vue['"];?/g, (_, imports) =>
  `const { ${imports.replace(/\s+as\s+/g, ': ')} } = Vue;`,
);
assert.doesNotMatch(code, /^\s*import\s/m, 'All trusted SFC imports must be resolved.');
const HUD = new Function('Vue', `${code}\nreturn __hud;`)(Vue);
const previousWindow = globalThis.window;
globalThis.window = { matchMedia: () => ({ matches: false }) };
try {
  for (const phase of ['briefing', 'active', 'paused', 'won', 'lost']) {
    const state = { ...initialSnapshot(), phase };
    const html = await renderToString(Vue.createSSRApp(HUD, { state, dispatch: () => {} }));
    assert.match(html, /BREACH/, `${phase}: brand must render.`);
    assert.match(html, /MARGEN/, `${phase}: mission must render.`);
    if (phase === 'briefing') assert.match(html, /INICIAR OPERACI\u00d3N/);
    if (phase === 'paused') assert.match(html, /PAUSA T/);
    if (phase === 'won') assert.match(html, /ASEGURADO/);
    if (phase === 'lost') assert.match(html, /CA\u00cdDO/);
    console.log(`PASS: Vue HUD / ${phase}.`);
  }
} finally {
  if (previousWindow === undefined) delete globalThis.window;
  else globalThis.window = previousWindow;
}

const { VisionSystem } = loadIsolatedModule('src/engine/VisionSystem.ts');
const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.2), new THREE.MeshBasicMaterial());
wall.position.set(0, 1.2, 3);
wall.updateMatrixWorld(true);
const scene = new THREE.Scene();
const vision = new VisionSystem(scene, [wall]);
vision.update(new THREE.Vector3(0, 0.09, 0), 0);
assert.equal(vision.canSee(new THREE.Vector3(0, 0.09, 1.6)), true, 'Unoccluded enemy in the cone is visible.');
assert.equal(vision.canSee(new THREE.Vector3(0, 0.09, 5)), false, 'Wall must occlude an enemy.');
assert.equal(vision.canSee(new THREE.Vector3(4, 0.09, 1)), false, 'Enemy outside cone must remain hidden.');
assert.equal(vision.canSee(new THREE.Vector3(0, 0.09, 20)), false, 'Enemy outside range must remain hidden.');
vision.enabled = false;
assert.equal(vision.canSee(new THREE.Vector3(0, 0.09, 1.6)), false, 'Flashlight-off state must hide enemies.');
vision.dispose(); wall.geometry.dispose(); wall.material.dispose();
console.log('PASS: vision range, cone, wall occlusion and flashlight state.');
console.log('Verification complete. GPU rendering and input still require a browser test.');