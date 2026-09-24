// Shared scroll-motion engine. One passive scroll listener and one
// requestAnimationFrame per frame for the whole page, however many effects
// subscribe. Layout is measured on load/resize (measure), never while
// scrolling; per-frame work (update) is arithmetic plus style writes.

export interface Frame {
  y: number;
  vh: number;
  vw: number;
  /** Scroll delta since the previous frame. */
  dy: number;
  /** Milliseconds since the previous frame (capped). */
  dt: number;
}

export interface Motion {
  measure?: () => void;
  /** Return true to ask for another frame (an effect still easing). */
  update: (f: Frame) => boolean | void;
}

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
export const phone = matchMedia('(max-width: 760px)');

const subs = new Set<Motion>();
let scheduled = false;
let needMeasure = true;
let lastY = window.scrollY;
let lastT = performance.now();

function frame(now: number) {
  scheduled = false;
  if (needMeasure) {
    needMeasure = false;
    subs.forEach((s) => s.measure?.());
  }
  const y = window.scrollY;
  const f: Frame = {
    y,
    vh: window.innerHeight,
    vw: document.documentElement.clientWidth,
    dy: y - lastY,
    dt: Math.min(64, now - lastT),
  };
  lastY = y;
  lastT = now;
  let again = false;
  subs.forEach((s) => {
    if (s.update(f)) again = true;
  });
  if (again) schedule();
}

export function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(frame);
}

export function remeasure() {
  needMeasure = true;
  schedule();
}

export function subscribe(m: Motion) {
  subs.add(m);
  remeasure();
  return () => subs.delete(m);
}

addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', remeasure);
addEventListener('load', remeasure);
reducedMotion.addEventListener('change', remeasure);
phone.addEventListener('change', remeasure);
// Late-loading images and fonts move everything below them.
new ResizeObserver(remeasure).observe(document.body);

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/** Document-relative top, ignoring transforms (unlike getBoundingClientRect). */
export function docTop(el: HTMLElement) {
  let t = 0;
  let e: HTMLElement | null = el;
  while (e) {
    t += e.offsetTop;
    e = e.offsetParent as HTMLElement | null;
  }
  return t;
}

/**
 * Frame-rate-independent easing toward a target - touch scrolling delivers
 * uneven scroll events, and this turns them into a steady glide. `rate` is
 * the fraction of the remaining distance covered per 60Hz frame.
 */
export function follower(rate = 0.2) {
  let cur = NaN;
  return {
    step(target: number, dt: number) {
      if (Number.isNaN(cur) || reducedMotion.matches) cur = target;
      else cur += (target - cur) * (1 - Math.pow(1 - rate, dt / 16.667));
      if (Math.abs(target - cur) < 0.0004) cur = target;
      return cur;
    },
    reset() {
      cur = NaN;
    },
  };
}

/** Write a custom property only when its rounded value changes. */
export function setVar(el: HTMLElement, name: string, v: number, digits = 3) {
  const s = v.toFixed(digits);
  if ((el as any)['__' + name] === s) return;
  (el as any)['__' + name] = s;
  el.style.setProperty(name, s);
}
