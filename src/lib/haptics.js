/*
 * Light haptic feedback on phones.
 * - Android (and other browsers with the Vibration API): navigator.vibrate.
 * - iPhone/iPad: Safari has no vibration API; toggling a hidden
 *   <input type="checkbox" switch> gives a system haptic on Safari 17.4+. Best effort.
 * - Desktop / mouse: does nothing.
 * Must be called from a user gesture (tap, click, touchend).
 */
const PATTERNS = {
  light: 8,          // open a card, a word, full screen
  tick: 14,          // change step
  success: [12, 50, 22],
  miss: [28, 40, 28],
};

let iosSwitch = null;
const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  iosSwitch.click();
}

export function haptic(kind = 'light') {
  try {
    if (!isTouch()) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light);
    } else if (isIOS()) {
      iosTick();
      if (Array.isArray(PATTERNS[kind])) setTimeout(iosTick, 90);
    }
  } catch {
    /* haptics are a nicety — never break the page */
  }
}
