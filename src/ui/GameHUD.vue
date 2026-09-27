<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

const props = defineProps({ state: { type: Object, required: true }, dispatch: { type: Function, required: true } });
const panel = ref(null);
const modal = ref(null);
const fileInput = ref(null);
const reducedMotion = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const stick = ref({ x: 0, y: 0 });
let stickOrigin = null;
let previousFocus = null;
const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const clock = computed(() => formatTime(props.state.elapsed));
const compassLabels = computed(() => {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(props.state.heading / 45) % 8;
  return [directions[(index + 7) % 8], directions[index], directions[(index + 1) % 8]];
});
const phaseName = computed(() => ({ briefing: 'EN ESPERA', active: 'EN OPERACI\u00d3N', paused: 'EN PAUSA', won: 'SECTOR ASEGURADO', lost: 'OPERADOR CA\u00cdDO' })[props.state.phase]);
const accuracy = computed(() => props.state.shots ? Math.round(props.state.hits / props.state.shots * 100) : 0);
const activeDialog = computed(() => panel.value || (['paused', 'won', 'lost'].includes(props.state.phase) ? props.state.phase : null));
const titles = { settings: 'Ajustes de campo.', controls: 'Cada movimiento cuenta.', loadout: 'Tu equipo. Tu ventaja.', briefing: 'Conoce el terreno.', archive: 'Registro de operaciones.', map: 'Lectura del terreno.' };
const send = (type, extra = {}) => props.dispatch({ type, ...extra });
function openPanel(name) { if (!panel.value) previousFocus = document.activeElement; panel.value = name; send('overlay', { open: true }); }
function closePanel() { panel.value = null; send('overlay', { open: false }); }
function begin() { if (panel.value) closePanel(); send('start'); }
function exit() { panel.value = null; send('exit'); }
function upload(event) { const file = event.target.files?.[0]; if (file) send('model', { file }); event.target.value = ''; }
function toggleMotion() { reducedMotion.value = !reducedMotion.value; document.documentElement.classList.toggle('reduce-motion', reducedMotion.value); }
function startStick(event) {
  event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
  const rect = event.currentTarget.getBoundingClientRect();
  stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; moveStick(event);
}
function moveStick(event) {
  if (!stickOrigin) return;
  let x = (event.clientX - stickOrigin.x) / 29; let y = (event.clientY - stickOrigin.y) / 29;
  const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
  stick.value = { x, y }; send('move', { x, y });
}
function endStick() { stickOrigin = null; stick.value = { x: 0, y: 0 }; send('move', { x: 0, y: 0 }); }
function handleKey(event) {
  if (!activeDialog.value) return;
  if (event.code === 'Escape' && panel.value) { event.preventDefault(); event.stopImmediatePropagation(); closePanel(); }
  if (event.key === 'Tab' && modal.value) {
    const items = [...modal.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
    if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
}
watch(activeDialog, async (value, previous) => {
  if (value && !previous) previousFocus = document.activeElement;
  await nextTick();
  if (value) modal.value?.querySelector('button:not(:disabled)')?.focus();
  else if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
});
onMounted(() => window.addEventListener('keydown', handleKey, true));
onUnmounted(() => window.removeEventListener('keydown', handleKey, true));
</script>

<template>
  <div class="game-ui" :class="{ 'mission-active': state.phase !== 'briefing', 'has-dialog': activeDialog }">
    <svg class="svg-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
      <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></symbol>
      <symbol id="i-expand" viewBox="0 0 24 24"><path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/></symbol>
      <symbol id="i-sound" viewBox="0 0 24 24"><path d="m11 4-5 4H3v8h3l5 4V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></symbol>
      <symbol id="i-muted" viewBox="0 0 24 24"><path d="m11 4-5 4H3v8h3l5 4V4Zm5 5 5 6m0-6-5 6"/></symbol>
      <symbol id="i-settings" viewBox="0 0 24 24"><path d="m9 3-.6 2.2-2 .9L4.3 5.5 2 9.5l1.6 1.6v2L2 14.5l2.3 4 2.1-.6 2 .9L9 21h6l.6-2.2 2-.9 2.1.6 2.3-4-1.6-1.4v-2L22 9.5l-2.3-4-2.1.6-2-.9L15 3H9Z"/><circle cx="12" cy="12" r="3"/></symbol>
      <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 2v5m0 10v5M2 12h5m10 0h5"/><circle cx="12" cy="12" r="1"/></symbol>
      <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
      <symbol id="i-minus" viewBox="0 0 24 24"><path d="M5 12h14"/></symbol>
      <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M6 18 18 6"/></symbol>
      <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
      <symbol id="i-location" viewBox="0 0 24 24"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></symbol>
      <symbol id="i-pulse" viewBox="0 0 32 24"><path d="M1 13h7l4-9 5 17 4-12 3 4h7"/></symbol>
      <symbol id="i-mouse" viewBox="0 0 24 28"><rect x="5" y="2" width="14" height="23" rx="7"/><path d="M12 2v9M5 11h14"/></symbol>
      <symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14" stroke-width="3"/></symbol>
      <symbol id="i-play" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></symbol>
      <symbol id="i-reload" viewBox="0 0 24 24"><path d="M20 9a8 8 0 1 0 .1 6M20 3v6h-6"/></symbol>
      <symbol id="i-exit" viewBox="0 0 24 24"><path d="M9 4H4v16h5m6-12 4 4-4 4M8 12h12"/></symbol>
      <symbol id="i-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1.5.8-1.5 1.2-1.5 2M12 16v1"/></symbol>
      <symbol id="i-upload" viewBox="0 0 24 24"><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></symbol>
      <symbol id="rifle-silhouette" viewBox="0 0 300 90"><g fill="currentColor" stroke="none"><path d="M12 30h35l13 8h30l9-5h64v-5h16v5h47v5h26v3h26v-4h16v12h-16v-4h-26v4h-26v5h-65l-8 7h-12l7 19-15 5-11-30h-15l-4 20H89l7-24H62L39 61H12z"/><path d="M113 25h24v-8h15v16h-39zm7-13h27v5h-27zM165 26h55v5h-55zM180 20h7v8h-7zM204 20h7v8h-7z"/></g><g stroke="var(--bg, #171b18)" fill="none" stroke-width="3"><path d="M19 37h21l11 8-17 8H20zm80 2h40m28 0h51m-50 7h51m-65 12 6 17m-16-18 6 18"/><path d="M177 34v16m9-16v16m9-16v16m9-16v16m9-16v16" stroke-width="2"/></g></symbol>
      <symbol id="pistol-silhouette" viewBox="0 0 300 90"><g fill="currentColor"><path d="M70 21h114v5h38v18h-42v8h-64l-10 33H76l13-42H70z"/><rect x="78" y="16" width="7" height="6"/><rect x="167" y="16" width="5" height="6"/><path d="M116 49h27v16h-32v-5h26v-6h-22z"/></g><path d="M78 30h95M88 60l-5 18m5-5h13m-11-8h13" stroke="var(--bg, #171b18)" stroke-width="3" fill="none"/></symbol>
      <symbol id="level-map" viewBox="0 0 220 150">
        <rect x="8" y="8" width="204" height="134" fill="#20261f"/><path d="M13 12h74v53H13zm129 0h65v53h-65z" fill="#31372d" opacity=".45"/>
        <g fill="#4d5548" opacity=".52"><rect x="26" y="28" width="46" height="17"/><rect x="17" y="80" width="13" height="35"/><rect x="39" y="90" width="25" height="12"/><rect x="161" y="16" width="32" height="36"/><rect x="164" y="88" width="15" height="34"/><rect x="199" y="78" width="9" height="50"/></g>
        <g fill="#929b85"><rect v-for="(wall, i) in state.walls" :key="i" :x="110 + (wall.x - wall.w / 2) * 10" :y="75 + (wall.z - wall.d / 2) * 10" :width="Math.max(1.8, wall.w * 10)" :height="Math.max(1.8, wall.d * 10)"/></g>
        <rect x="106" y="118" width="17" height="17" fill="none" stroke="#bea779" stroke-width="1" stroke-dasharray="2 2" :opacity="state.kills === state.totalEnemies ? 1 : .35"/>
        <g :transform="`translate(${110 + state.playerX * 10}, ${75 + state.playerZ * 10}) rotate(${state.heading - 180})`"><path d="M0 0-19 31Q0 40 19 31Z" fill="#d8bc86" opacity=".14"/><path d="m0 5-3-7h6Z" fill="#edcf95"/><circle r="5" fill="none" stroke="#edcf95" stroke-width=".7" opacity=".55"/></g>
        <circle v-for="enemy in state.visibleEnemies" :key="enemy.id" :cx="110 + enemy.x * 10" :cy="75 + enemy.z * 10" r="2.3" fill="#bd8269"/>
      </symbol>
    </defs></svg>

    <header class="topbar ui-interactive">
      <button class="brand" aria-label="BREACH, informe de la operaci&oacute;n" @click="openPanel('briefing')"><svg class="brand-mark" viewBox="0 0 32 34" aria-hidden="true"><path d="M2 2h11v6H8v18h5v6H2V2Zm15 0h13v6H17V2Zm0 12h10v6H17v-6Zm0 12h13v6H17v-6Z" fill="currentColor"/></svg><span class="wordmark">BREACH<span class="brand-period">.</span></span><span class="brand-descriptor">TACTICAL<br/>OPERATIONS</span></button>
      <nav class="main-nav" aria-label="Navegaci&oacute;n principal"><button :class="{ selected: !panel || ['briefing', 'map', 'settings', 'controls'].includes(panel) }" @click="panel ? closePanel() : undefined">OPERACI&Oacute;N <span>01</span></button><button :class="{ selected: panel === 'loadout' }" @click="openPanel('loadout')">EQUIPAMIENTO</button><button :class="{ selected: panel === 'archive' }" @click="openPanel('archive')">REGISTRO</button></nav>
      <div class="header-tools"><span class="build-label"><i></i> PROTOTIPO JUGABLE</span><button class="icon-button" :title="state.sound ? 'Silenciar audio (M)' : 'Activar audio (M)'" :aria-label="state.sound ? 'Silenciar audio' : 'Activar audio'" :aria-pressed="!state.sound" @click="send('sound')"><svg><use :href="state.sound ? '#i-sound' : '#i-muted'"/></svg></button><button class="icon-button fullscreen-button" title="Pantalla completa" aria-label="Pantalla completa" @click="send('fullscreen')"><svg><use href="#i-expand"/></svg></button><button class="icon-button" title="Ajustes" aria-label="Abrir ajustes" @click="openPanel('settings')"><svg><use href="#i-settings"/></svg></button></div>
    </header>

    <aside class="mission-panel">
      <div class="mission-intro"><div class="eyebrow"><span class="tiny-rule"></span> OPERACI&Oacute;N <span class="muted">/</span> 001</div><h1>CERO<br/>MARGEN<span>.</span></h1><p class="mission-description">Entra en silencio.<br/>Sal con el control.</p><div class="location-line"><svg class="icon"><use href="#i-location"/></svg><div>RESIDENCIA HAWTHORNE<span>23:48 H &nbsp; / &nbsp; SECTOR NORTE</span></div></div></div>
      <div class="objectives"><div class="section-label">OBJETIVOS <span>{{ state.kills === state.totalEnemies ? '01' : '00' }} <i>/</i> 02</span></div><div class="objective" :class="{ complete: state.kills === state.totalEnemies }"><span class="objective-marker"><svg v-if="state.kills === state.totalEnemies"><use href="#i-check"/></svg><i v-else></i></span><div><strong>Neutraliza las amenazas</strong><span>{{ state.kills.toString().padStart(2, '0') }} / {{ state.totalEnemies.toString().padStart(2, '0') }} objetivos confirmados</span></div></div><div class="objective" :class="{ 'objective-locked': state.kills < state.totalEnemies, complete: state.phase === 'won' }"><span class="objective-marker"><svg v-if="state.phase === 'won'"><use href="#i-check"/></svg><i v-else></i></span><div><strong>Asegura la extracci&oacute;n</strong><span>{{ state.kills === state.totalEnemies ? 'Alcanza el punto marcado' : 'Despeja el interior primero' }}</span></div></div></div>
      <div class="mission-actions ui-interactive"><button v-if="state.phase === 'briefing'" class="primary-button deploy-button" @click="begin"><span>INICIAR OPERACI&Oacute;N</span><svg class="icon"><use href="#i-arrow"/></svg></button><button v-else class="secondary-button deploy-button" @click="send('pause')" :disabled="state.phase === 'won' || state.phase === 'lost'"><svg class="icon"><use :href="state.phase === 'paused' ? '#i-play' : '#i-pause'"/></svg><span>{{ state.phase === 'paused' ? 'CONTINUAR' : state.phase === 'won' ? 'MISI\u00d3N COMPLETADA' : state.phase === 'lost' ? 'FIN DE OPERACI\u00d3N' : 'PAUSAR OPERACI\u00d3N' }}</span></button><div class="deploy-hint" v-if="state.phase === 'briefing'"><span class="mini-key">ENTER</span> para desplegar</div><div class="deploy-hint mission-clock" v-else><span class="live-dot" :class="{ paused: state.phase !== 'active' }"></span>{{ phaseName }}<span>{{ clock }}</span></div><button class="text-button briefing-link" @click="openPanel('briefing')">INFORME DE MISI&Oacute;N <svg class="icon"><use href="#i-arrow"/></svg></button></div>
    </aside>

    <div class="viewport-heading"><span class="live-dot"></span> VISTA T&Aacute;CTICA <span class="viewport-heading-rule"></span><span class="viewport-subtitle">TIEMPO REAL</span></div>
    <div class="compass" aria-label="Br&uacute;jula"><div class="compass-labels"><span v-for="label in compassLabels" :key="label">{{ label }}</span></div><div class="compass-ruler"></div><span class="compass-needle"></span><span class="compass-bearing">{{ Math.round(state.heading).toString().padStart(3, '0') }}&deg;</span></div>
    <button class="minimap ui-interactive" title="Ampliar plano t&aacute;ctico" aria-label="Ampliar plano t&aacute;ctico" @click="openPanel('map')"><span class="minimap-header">PLANTA 01 <svg class="icon"><use href="#i-expand"/></svg></span><svg class="minimap-plan" viewBox="0 0 220 150" aria-hidden="true"><use href="#level-map"/></svg><span class="minimap-footer"><span><i></i> ALFA 01</span><span>N &uarr;</span></span></button>
    <div class="scene-caption"><span class="corner-mark"></span><span>INTERIOR RESIDENCIAL<span>UNA ENTRADA. NING&Uacute;N MARGEN.</span></span></div>
    <div class="view-controls ui-interactive"><span>{{ Math.round(state.zoom * 100) }}%</span><button title="Alejar" aria-label="Alejar c&aacute;mara" @click="send('zoom', { value: -.12 })"><svg class="icon"><use href="#i-minus"/></svg></button><button title="Acercar" aria-label="Acercar c&aacute;mara" @click="send('zoom', { value: .12 })"><svg class="icon"><use href="#i-plus"/></svg></button><button title="Restablecer vista" aria-label="Restablecer vista" @click="send('recenter')"><svg class="icon"><use href="#i-target"/></svg></button></div>
    <Transition name="notification"><div v-if="state.notification" class="field-notification" role="status"><span class="notification-line"></span><span class="mono">CONTROL</span><span>{{ state.notification }}</span></div></Transition>
    <div class="damage-vignette" :style="{ opacity: state.damage > 0 ? state.damage * 1.5 : 0 }"></div>

    <section class="bottom-hud" aria-label="Estado del operador">
      <div class="operator-status"><span class="hud-label">OPERADOR <span>01 / ALFA</span></span><div class="vitals"><svg class="pulse-icon"><use href="#i-pulse"/></svg><strong>{{ state.health }}<span>%</span></strong><span class="vitals-label">{{ state.health > 35 ? 'ESTABLE' : state.health > 0 ? 'CR\u00cdTICO' : 'SIN SE\u00d1AL' }}</span></div><div class="health-line"><span :style="{ width: `${state.health}%` }" :class="{ critical: state.health <= 35 }"></span></div></div>
      <button class="weapon-status ui-interactive" title="Ver equipamiento" @click="openPanel('loadout')"><span class="hud-label">{{ state.weapon === 'mk18' ? 'MK18 MOD 1' : 'P9 SUPPRESSED' }} <span>SUPR.</span></span><svg class="hud-rifle" viewBox="0 0 300 90"><use :href="state.weapon === 'mk18' ? '#rifle-silhouette' : '#pistol-silhouette'"/></svg><span class="weapon-caliber">{{ state.weapon === 'mk18' ? '5.56 \u00d7 45 MM' : '9 \u00d7 19 MM' }}<span class="weapon-mode">{{ state.weapon === 'mk18' ? 'AUTO' : 'SEMI' }}</span></span></button>
      <div class="keyboard-guide"><div class="control-item"><div class="wasd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div><span>Mover</span></div><div class="control-item"><svg class="mouse-icon"><use href="#i-mouse"/></svg><span>Apuntar<br/><span class="sub-control">Disparar</span></span></div><button class="control-item ui-interactive" @click="send('reload')" title="Recargar"><kbd>R</kbd><span>Recargar</span></button><button class="control-item ui-interactive" @click="send('pause')" title="Pausa t&aacute;ctica"><kbd class="wide-key">ESP</kbd><span>Pausa</span></button></div>
      <button class="ammo-status ui-interactive" title="Recargar arma (R)" aria-label="Recargar arma" @click="send('reload')" :class="{ 'low-ammo': state.ammo <= 5 }"><span class="hud-label">{{ state.reloading ? 'RECARGANDO' : 'MUNICI\u00d3N' }} <svg class="ammo-reload-icon" :class="{ spinning: state.reloading }"><use href="#i-reload"/></svg></span><span class="ammo-numbers"><strong>{{ state.ammo.toString().padStart(2, '0') }}</strong><span>/ {{ state.capacity }}</span></span><span class="reserve-count"><span class="magazine-icon"></span>{{ state.reserve }} EN RESERVA</span><span v-if="state.reloading" class="reload-line" :style="{ width: `${state.reloadProgress * 100}%` }"></span></button>
    </section>
    <footer class="system-footer"><span class="version"><span class="footer-square"></span> BREACH <span>/</span> BUILD 0.1.0</span><button class="ui-interactive help-button" @click="openPanel('controls')"><svg class="icon"><use href="#i-help"/></svg> GU&Iacute;A DE CONTROLES</button><span class="render-status"><span class="live-dot"></span> WEBGL 2 <span>/</span> {{ state.fps }} FPS</span></footer>
    <div v-if="state.phase === 'active' && !panel" class="touch-controls ui-interactive"><div class="touch-stick" aria-label="Joystick de movimiento" @pointerdown="startStick" @pointermove="moveStick" @pointerup="endStick" @pointercancel="endStick"><span :style="{ transform: `translate(${stick.x * 25}px, ${stick.y * 25}px)` }"></span></div><div class="touch-actions"><button @click="send('reload')" aria-label="Recargar"><svg class="icon"><use href="#i-reload"/></svg></button><button class="touch-fire" aria-label="Disparar" @pointerdown.prevent="send('fire', { active: true })" @pointerup="send('fire', { active: false })" @pointercancel="send('fire', { active: false })" @pointerleave="send('fire', { active: false })"><svg class="icon"><use href="#i-target"/></svg></button></div></div>

    <Transition name="dialog"><div v-if="activeDialog" class="dialog-backdrop ui-interactive" @pointerdown.self="panel ? closePanel() : undefined"><section ref="modal" class="tactical-dialog" :class="{ 'wide-dialog': ['loadout', 'briefing', 'map', 'archive'].includes(panel), 'mission-dialog': !panel }" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <template v-if="panel">
        <div class="dialog-topline"><span class="eyebrow">BREACH <span class="muted">/</span> {{ panel === 'settings' ? 'CONFIGURACI\u00d3N' : panel === 'controls' ? 'MANUAL DE CAMPO' : panel === 'loadout' ? 'ARSENAL' : panel === 'archive' ? 'ARCHIVO LOCAL' : 'INTELIGENCIA' }}</span><button class="icon-button close-button" @click="closePanel" aria-label="Cerrar ventana"><svg><use href="#i-close"/></svg></button></div><h2 id="dialog-title">{{ titles[panel] }}</h2>
        <template v-if="panel === 'settings'">
          <p class="dialog-description">Ajusta la experiencia. Mant&eacute;n el control.</p>
          <div class="setting-row"><div><strong>Audio t&aacute;ctico</strong><span>Disparos, pasos y comunicaciones</span></div><button class="toggle" :class="{ enabled: state.sound }" role="switch" :aria-checked="state.sound" aria-label="Audio t&aacute;ctico" @click="send('sound')"><span></span></button></div>
          <div class="setting-row volume-row"><label for="volume">Volumen de efectos <span>{{ state.volume }}%</span></label><input id="volume" type="range" min="0" max="100" :value="state.volume" @input="send('volume', { value: Number($event.target.value) })"/></div>
          <div class="setting-row"><div><strong>Linterna del operador</strong><span>La luz revela amenazas. Tecla F.</span></div><button class="toggle" :class="{ enabled: state.flashlight }" role="switch" :aria-checked="state.flashlight" aria-label="Linterna del operador" @click="send('flashlight')"><span></span></button></div>
          <div class="setting-row"><label for="quality"><strong>Calidad de renderizado</strong><span>Resoluci&oacute;n y part&iacute;culas ambientales</span></label><select id="quality" :value="state.quality" @change="send('quality', { value: $event.target.value })"><option value="high">Alta</option><option value="balanced">Equilibrada</option></select></div>
          <div class="setting-row"><div><strong>Reducir movimiento de interfaz</strong><span>Transiciones visuales m&aacute;s suaves</span></div><button class="toggle" :class="{ enabled: reducedMotion }" role="switch" :aria-checked="reducedMotion" aria-label="Reducir movimiento" @click="toggleMotion"><span></span></button></div>
          <button class="primary-button dialog-bottom-button" @click="closePanel">VOLVER A LA OPERACI&Oacute;N <svg class="icon"><use href="#i-arrow"/></svg></button>
        </template>
        <template v-else-if="panel === 'controls'">
          <p class="dialog-description">Movimiento libre. Punter&iacute;a independiente. Piensa antes de entrar.</p>
          <div class="controls-list"><div><span>Desplazarte</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></div><div><span>Apuntar / disparar</span><span>RAT&Oacute;N / CLIC IZQ.</span></div><div><span>Apuntar con precisi&oacute;n</span><span>CLIC DERECHO</span></div><div><span>Desplazamiento r&aacute;pido</span><kbd class="wide-key">SHIFT</kbd></div><div><span>Cambiar cargador</span><kbd>R</kbd></div><div><span>Encender / apagar linterna</span><kbd>F</kbd></div><div><span>Pausa t&aacute;ctica</span><kbd class="wide-key">ESPACIO</kbd></div><div><span>Acercar / alejar</span><span>RUEDA DEL RAT&Oacute;N</span></div></div><p class="field-note">En pantalla t&aacute;ctil, utiliza el joystick para moverte. Toca el escenario para apuntar y disparar.</p><button class="primary-button dialog-bottom-button" @click="closePanel">ENTENDIDO <svg class="icon"><use href="#i-check"/></svg></button>
        </template>
        <template v-else-if="panel === 'loadout'">
          <p class="dialog-description">Equipo ligero. Perfil bajo. Todo lo que necesitas, nada m&aacute;s.</p>
          <div class="weapon-options"><button class="weapon-option" :class="{ equipped: state.weapon === 'mk18' }" @click="send('weapon', { value: 'mk18' })" :disabled="state.phase !== 'briefing'" :aria-pressed="state.weapon === 'mk18'"><span class="weapon-option-top">01 / CARABINA<span>{{ state.weapon === 'mk18' ? 'EQUIPADA' : 'SELECCIONAR' }}</span></span><svg viewBox="0 0 300 90"><use href="#rifle-silhouette"/></svg><strong>MK18 MOD 1</strong><span class="weapon-detail">5.56 &times; 45 MM &nbsp; / &nbsp; SUPRESOR</span><span class="weapon-specs"><span>30 <small>PROYECTILES</small></span><span>1.8 s <small>RECARGA</small></span></span></button><button class="weapon-option" :class="{ equipped: state.weapon === 'p9' }" @click="send('weapon', { value: 'p9' })" :disabled="state.phase !== 'briefing'" :aria-pressed="state.weapon === 'p9'"><span class="weapon-option-top">02 / PISTOLA<span>{{ state.weapon === 'p9' ? 'EQUIPADA' : 'SELECCIONAR' }}</span></span><svg viewBox="0 0 300 90"><use href="#pistol-silhouette"/></svg><strong>P9 SUPPRESSED</strong><span class="weapon-detail">9 &times; 19 MM &nbsp; / &nbsp; SUPRESOR</span><span class="weapon-specs"><span>15 <small>PROYECTILES</small></span><span>1.3 s <small>RECARGA</small></span></span></button></div>
          <p v-if="state.phase !== 'briefing'" class="field-note">El equipo solo puede cambiarse antes del despliegue.</p><div class="operator-import"><div><span class="hud-label">MODELO DEL OPERADOR</span><strong>{{ state.modelLoading ? 'Importando modelo...' : state.modelName }}</strong><span>GLB aut&oacute;nomo &middot; Hasta 30 MB &middot; Animaciones compatibles</span></div><input ref="fileInput" type="file" accept=".glb" hidden @change="upload"/><button class="secondary-button" :disabled="state.phase !== 'briefing' || state.modelLoading" @click="fileInput.click()"><svg class="icon"><use href="#i-upload"/></svg> IMPORTAR .GLB</button></div><button class="primary-button dialog-bottom-button" @click="closePanel">CONFIRMAR EQUIPO <svg class="icon"><use href="#i-arrow"/></svg></button>
        </template>
        <template v-else-if="panel === 'briefing'">
          <p class="dialog-description">Operaci&oacute;n 001. Residencia Hawthorne. Un operador, cinco amenazas.</p><div class="briefing-content"><div class="briefing-map"><svg viewBox="0 0 220 150"><use href="#level-map"/></svg><span>PLANTA BAJA / ACCESO SUR</span></div><div class="briefing-copy"><span class="section-label">SITUACI&Oacute;N</span><p>Cinco individuos armados ocupan la residencia. Entra por el acceso sur y despeja cada estancia.</p><span class="section-label">REGLAS DE ENFRENTAMIENTO</span><p>Solo ver&aacute;s las amenazas dentro del haz de tu linterna y sin muros de por medio. Usa las esquinas a tu favor.</p></div></div><div class="briefing-extraction"><svg class="icon"><use href="#i-exit"/></svg><p>Cuando el interior est&eacute; despejado, alcanza el punto de extracci&oacute;n marcado en el pasillo sur.</p></div><button class="primary-button dialog-bottom-button" @click="state.phase === 'briefing' ? begin() : closePanel()">{{ state.phase === 'briefing' ? 'INICIAR OPERACI\u00d3N' : 'VOLVER AL TERRENO' }} <svg class="icon"><use href="#i-arrow"/></svg></button>
        </template>
        <template v-else-if="panel === 'map'">
          <p class="dialog-description">La informaci&oacute;n cambia. Observa antes de moverte.</p><div class="expanded-map"><svg viewBox="0 0 220 150"><use href="#level-map"/></svg><span class="map-north">N &uarr;</span></div><div class="map-legend"><span><i class="legend-player"></i> ALFA 01</span><span><i class="legend-hostile"></i> AMENAZA VISIBLE</span><span><i class="legend-exit"></i> EXTRACCI&Oacute;N</span></div><button class="primary-button dialog-bottom-button" @click="closePanel">VOLVER A LA OPERACI&Oacute;N <svg class="icon"><use href="#i-arrow"/></svg></button>
        </template>
        <template v-else-if="panel === 'archive'">
          <p class="dialog-description">Cada entrada deja una lecci&oacute;n. Historial guardado en este dispositivo.</p><div v-if="state.records.length" class="mission-records"><div class="records-header"><span>OPERACI&Oacute;N</span><span>TIEMPO</span><span>PRECISI&Oacute;N</span><span>ESTADO</span></div><div v-for="(record, index) in state.records" :key="record.date + index" class="record-row"><span>HAWTHORNE <small>{{ new Date(record.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) }}</small></span><span>{{ formatTime(record.time) }}</span><span>{{ record.accuracy }}%</span><span :class="{ 'record-success': record.success }">{{ record.success ? 'ASEGURADO' : 'FALLIDA' }}</span></div></div><div v-else class="empty-records"><svg class="icon"><use href="#i-shield"/></svg><strong>Tu primera operaci&oacute;n te espera.</strong><p>Completa una misi&oacute;n para consultar tu tiempo, precisi&oacute;n y resultado.</p></div><button class="primary-button dialog-bottom-button" @click="closePanel">VOLVER A LA OPERACI&Oacute;N <svg class="icon"><use href="#i-arrow"/></svg></button>
        </template>
      </template>
      <template v-else-if="state.phase === 'paused'">
        <div class="dialog-topline"><span class="eyebrow"><span class="live-dot paused"></span> PAUSA T&Aacute;CTICA</span><span class="mono muted">{{ clock }}</span></div><h2 id="dialog-title" class="big-dialog-title">TOMA<br/>EL CONTROL<span>.</span></h2><p class="dialog-description">El tiempo se detiene.<br/>Tu siguiente movimiento importa.</p><button class="primary-button dialog-bottom-button" @click="send('pause')">CONTINUAR OPERACI&Oacute;N <svg class="icon"><use href="#i-play"/></svg></button><button class="secondary-button dialog-bottom-button" @click="send('restart')">REINICIAR MISI&Oacute;N <svg class="icon"><use href="#i-reload"/></svg></button><button class="text-button leave-button" @click="exit">VOLVER AL DESPLIEGUE</button>
      </template>
      <template v-else>
        <div class="dialog-topline"><span class="eyebrow">INFORME DE CAMPO <span class="muted">/</span> 001</span><svg class="result-icon icon"><use :href="state.phase === 'won' ? '#i-shield' : '#i-target'"/></svg></div><h2 id="dialog-title" class="big-dialog-title">{{ state.phase === 'won' ? 'SECTOR' : 'OPERADOR' }}<br/>{{ state.phase === 'won' ? 'ASEGURADO' : 'CA\u00cdDO' }}<span>.</span></h2><p class="dialog-description">{{ state.phase === 'won' ? 'Entrada limpia. Trabajo terminado. Vuelve a casa.' : 'Una esquina puede cambiarlo todo. Vuelve a intentarlo.' }}</p><div class="debrief-stats"><div><span>TIEMPO</span><strong>{{ clock }}</strong></div><div><span>PRECISI&Oacute;N</span><strong>{{ accuracy }}<small>%</small></strong></div><div><span>AMENAZAS</span><strong>{{ state.kills }}<small> / 5</small></strong></div></div><button class="primary-button dialog-bottom-button" @click="send('restart')">VOLVER A ENTRAR <svg class="icon"><use href="#i-reload"/></svg></button><button class="text-button leave-button" @click="exit">VOLVER AL DESPLIEGUE</button>
      </template>
    </section></div></Transition>
  </div>
</template>