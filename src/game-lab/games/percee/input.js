/*
 * La Percée — every way to steer, in one place. One shared yaw / pitch for mouse, touch, keys and gamepad.
 *
 *  mouse     pointer lock (click the view) → move the mouse to look; falls back to drag-to-look
 *            when the lock is refused or unsupported. Right click = throw a stone.
 *  keyboard  W A S D by physical position (so Z Q S D on a French keyboard) or ↑ ↓ to ride,
 *            ← → to turn (3D) / move (2D), Shift or Space = gallop, E / F = stone, Esc / P = pause.
 *  touch     left part of the view = a joystick that appears under the thumb,
 *            the rest = drag to look. Decided per event from PointerEvent.pointerType, so a
 *            touch monitor with a mouse plugged in works with both at once.
 *  gamepad   left stick ride, right stick look, A gallop, X / B stone, Start pause.
 *
 * Esc while the pointer is locked never reaches the page: the browser just releases the lock.
 * The pause menu is therefore driven by `pointerlockchange` (see onLock).
 */

const MOUSE_SENS = 0.0022;   // rad per pixel at sensitivity 1
const PITCH_MAX = 0.62;      // a rider cannot look straight up or down
const TURN_KEYS = 2.3;       // rad / s
const JOY_R = 58;            // px
const DEAD = 0.15;
const UI = 'button, a, input, select, label, [data-ui]';

export function createInput(o) {
  const { surface, canvas } = o;
  const s = {
    yaw: 0, pitch: -0.06, moveX: 0, moveY: 0, gallop: false,
    kind: o.kind || 'mouse', locked: false, lockFailed: false,
  };
  const keys = Object.create(null);
  let joyId = -1; let joyX = 0; let joyY = 0; let jx = 0; let jy = 0;
  let lookId = -1; let lookX = 0; let lookY = 0;
  let dragId = -1; let dragX = 0; let dragY = 0;
  let galBtn = false; let padGallop = false; let padThrow = false; let padPause = false; let hasPad = false;
  let expectUnlock = false;
  const lockable = 'requestPointerLock' in Element.prototype;

  const cfg = () => o.settings();
  const zoom = () => { const r = surface.getBoundingClientRect(); return { r, z: surface.offsetWidth ? r.width / surface.offsetWidth : 1 }; };
  const setKind = (k) => { if (s.kind !== k) { s.kind = k; o.onKind?.(k); } };
  const look = (dx, dy, k) => {
    const c = cfg();
    s.yaw += dx * k * c.sens;
    s.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, s.pitch - dy * k * c.sens * (c.invertY ? -1 : 1)));
  };

  /* ── pointer lock ── */
  const lockFail = () => { if (document.pointerLockElement === canvas) return; s.lockFailed = true; o.onLockError?.(); };
  function requestLock() {
    if (!lockable || o.mode() !== '3d') return false;
    try {
      const p = canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch((err) => {
          if (err && (err.name === 'NotSupportedError' || err.name === 'InvalidStateError')) {
            try { const p2 = canvas.requestPointerLock(); if (p2 && p2.catch) p2.catch(lockFail); } catch { lockFail(); }
          } else lockFail();
        });
      }
      return true;
    } catch { lockFail(); return false; }
  }
  function exitLock() {
    if (document.pointerLockElement === canvas) { expectUnlock = true; try { document.exitPointerLock(); } catch { /* ignore */ } }
  }
  const onLockChange = () => {
    const now = document.pointerLockElement === canvas;
    if (now === s.locked) return;
    s.locked = now;
    if (now) { s.lockFailed = false; dragId = -1; }
    const expected = expectUnlock; expectUnlock = false;
    o.onLock?.(now, expected);
  };
  const onLockErr = () => lockFail();
  const onMouseMove = (e) => {
    if (!s.locked || !o.active()) return;
    const mx = e.movementX || 0; const my = e.movementY || 0;
    if (Math.abs(mx) > 400 || Math.abs(my) > 400) return; // a known browser glitch: one huge jump
    look(mx, my, MOUSE_SENS);
  };

  /* ── pointer events on the play surface ── */
  const onAnyDown = (e) => setKind(e.pointerType === 'mouse' ? 'mouse' : 'touch');
  const onDown = (e) => {
    if (e.target.closest && e.target.closest(UI)) return;
    if (!o.active()) return;
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { o.onThrow?.(); return; }
      if (e.button !== 0) return;
      if (o.mode() !== '3d') return;
      if (!s.locked) {
        requestLock();
        dragId = e.pointerId; dragX = e.clientX; dragY = e.clientY; // drag-to-look until (or instead of) the lock
        try { surface.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
      }
      return;
    }
    const { r } = zoom();
    const left = o.mode() !== '3d' || e.clientX - r.left < r.width * 0.45;
    if (left && joyId === -1) {
      joyId = e.pointerId; joyX = e.clientX; joyY = e.clientY; jx = 0; jy = 0;
      moveJoy(e);
    } else if (lookId === -1 && o.mode() === '3d') {
      lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY;
    } else return;
    try { surface.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    e.preventDefault();
  };
  function moveJoy(e) {
    const { r, z } = zoom();
    const R = JOY_R * z;
    const dx = e.clientX - joyX; const dy = e.clientY - joyY; const d = Math.hypot(dx, dy);
    const ux = d ? dx / d : 0; const uy = d ? dy / d : 0; const cl = Math.min(d, R);
    const m = cl / R; const mm = m < DEAD ? 0 : (m - DEAD) / (1 - DEAD);
    jx = ux * mm; jy = uy * mm;
    o.onJoy?.(true, (joyX - r.left) / z, (joyY - r.top) / z, (ux * cl) / z, (uy * cl) / z);
  }
  const onMove = (e) => {
    if (e.pointerType === 'mouse') {
      if (s.kind !== 'mouse' && (e.movementX || e.movementY)) setKind('mouse');
      if (e.pointerId === dragId && !s.locked && o.active()) {
        look(e.clientX - dragX, e.clientY - dragY, MOUSE_SENS * 1.6); dragX = e.clientX; dragY = e.clientY;
      }
      return;
    }
    if (e.pointerId === joyId) moveJoy(e);
    else if (e.pointerId === lookId) {
      if (o.active()) { const { r } = zoom(); look(e.clientX - lookX, e.clientY - lookY, 2.6 / Math.min(r.width, r.height)); }
      lookX = e.clientX; lookY = e.clientY;
    }
  };
  const onUp = (e) => {
    if (e.pointerId === joyId) { joyId = -1; jx = 0; jy = 0; o.onJoy?.(false, 0, 0, 0, 0); }
    if (e.pointerId === lookId) lookId = -1;
    if (e.pointerId === dragId) dragId = -1;
  };

  /* ── keyboard (window-level while the game is on screen; ignored while typing in a field) ── */
  const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyF']);
  const typing = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
  const onKeyDown = (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (e.repeat) return;
      if (o.onEscape?.(e.code) !== false) { e.preventDefault(); e.stopPropagation(); }
      return;
    }
    if (!o.active() || !GAME_KEYS.has(e.code)) return;
    e.preventDefault(); e.stopPropagation();
    if (!e.repeat && (e.code === 'KeyE' || e.code === 'KeyF')) o.onThrow?.();
    keys[e.code] = true;
  };
  const onKeyUp = (e) => { keys[e.code] = false; };
  const clearKeys = () => { for (const k in keys) keys[k] = false; };

  /* ── iOS / touch hygiene on the play surface ── */
  const stop = (e) => { if (!(e.target.closest && e.target.closest(UI))) e.preventDefault(); };
  const stopAll = (e) => e.preventDefault();
  const onPad = () => { hasPad = true; };

  window.addEventListener('pointerdown', onAnyDown, true);
  surface.addEventListener('pointerdown', onDown);
  surface.addEventListener('pointermove', onMove);
  surface.addEventListener('pointerup', onUp);
  surface.addEventListener('pointercancel', onUp);
  surface.addEventListener('lostpointercapture', onUp);
  surface.addEventListener('touchstart', stop, { passive: false });
  surface.addEventListener('touchmove', stop, { passive: false });
  surface.addEventListener('contextmenu', stopAll);
  surface.addEventListener('dblclick', stop);
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) surface.addEventListener(g, stopAll, { passive: false });
  document.addEventListener('pointerlockchange', onLockChange);
  document.addEventListener('pointerlockerror', onLockErr);
  document.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  window.addEventListener('blur', clearKeys);
  window.addEventListener('gamepadconnected', onPad);

  const axis = (v) => { const a = Math.abs(v); return a < DEAD ? 0 : Math.sign(v) * (a - DEAD) / (1 - DEAD); };

  return {
    state: s,
    lockable,
    requestLock,
    exitLock,
    setGallop(v) { galBtn = v; },
    /** touch look from a HUD button the thumb is resting on (px) */
    lookBy(dx, dy) { if (o.active()) { const { r } = zoom(); look(dx, dy, 2.6 / Math.min(r.width, r.height)); } },
    reset(yaw) { s.yaw = yaw; s.pitch = -0.06; clearKeys(); joyId = lookId = dragId = -1; jx = jy = 0; galBtn = false; o.onJoy?.(false, 0, 0, 0, 0); },
    release() { clearKeys(); if (joyId !== -1) { joyId = -1; jx = jy = 0; o.onJoy?.(false, 0, 0, 0, 0); } lookId = dragId = -1; galBtn = false; s.moveX = s.moveY = 0; s.gallop = false; },
    /** once per frame: fold keys, joystick and gamepad into moveX (right) / moveY (forward) / gallop */
    frame(dt) {
      const k = keys; const is3d = o.mode() === '3d';
      let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
      let my = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      const lr = (k.ArrowRight ? 1 : 0) - (k.ArrowLeft ? 1 : 0);
      if (is3d) s.yaw += lr * TURN_KEYS * dt; else mx += lr;
      let gal = !!(k.ShiftLeft || k.ShiftRight || k.Space) || galBtn;
      mx += jx; my -= jy;
      if (hasPad && navigator.getGamepads) {
        const pads = navigator.getGamepads(); let pad = null;
        for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { pad = pads[i]; break; }
        if (pad) {
          const ax = axis(pad.axes[0] || 0); const ay = axis(pad.axes[1] || 0); const rx = axis(pad.axes[2] || 0); const ry = axis(pad.axes[3] || 0);
          if (ax || ay || rx || ry) setKind('pad');
          mx += ax; my -= ay;
          if (is3d) { const c = cfg(); s.yaw += rx * 2.4 * c.sens * dt; s.pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, s.pitch - ry * 1.5 * c.sens * dt * (c.invertY ? -1 : 1))); }
          const b = pad.buttons; const pressed = (i) => !!(b[i] && b[i].pressed);
          padGallop = pressed(0) || pressed(7) || pressed(10); gal = gal || padGallop;
          const th = pressed(2) || pressed(1); if (th && !padThrow) o.onThrow?.(); padThrow = th;
          const pz = pressed(9); if (pz && !padPause) o.onEscape?.('Pad'); padPause = pz;
        }
      }
      s.moveX = Math.max(-1, Math.min(1, mx)); s.moveY = Math.max(-1, Math.min(1, my)); s.gallop = gal;
    },
    dispose() {
      exitLock();
      window.removeEventListener('pointerdown', onAnyDown, true);
      surface.removeEventListener('pointerdown', onDown);
      surface.removeEventListener('pointermove', onMove);
      surface.removeEventListener('pointerup', onUp);
      surface.removeEventListener('pointercancel', onUp);
      surface.removeEventListener('lostpointercapture', onUp);
      surface.removeEventListener('touchstart', stop);
      surface.removeEventListener('touchmove', stop);
      surface.removeEventListener('contextmenu', stopAll);
      surface.removeEventListener('dblclick', stop);
      for (const g of ['gesturestart', 'gesturechange', 'gestureend']) surface.removeEventListener(g, stopAll);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockErr);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', clearKeys);
      window.removeEventListener('gamepadconnected', onPad);
    },
  };
}
