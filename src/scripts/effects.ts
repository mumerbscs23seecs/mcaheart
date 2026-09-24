// Site-wide scroll effects, all driven by the shared engine in motion.ts.
// Every effect is progressive enhancement: with no JS, or with reduced
// motion, content renders in its final, fully visible state.
import { subscribe, reducedMotion, phone, clamp, docTop, setVar } from './motion';

const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

/* --------------------------------------------------------------- Reveal
   Enter: [data-reveal] fades/lifts in when it reaches the viewport, and
   re-arms when it drops back out below - so scrolling back up and down
   again replays it. Exit: as an element leaves through the top of the
   screen it recedes (--xp 0..1), and returns when scrolled back to. */
const reveals = $$('[data-reveal]');

if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  reveals.forEach((el) => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (e.isIntersecting) el.classList.add('is-visible');
        else if (e.boundingClientRect.top >= (e.rootBounds?.bottom ?? innerHeight)) el.classList.remove('is-visible');
        // Already above the fold on load (restored scroll / anchor jump).
        else if (e.boundingClientRect.bottom <= 0) el.classList.add('is-visible');
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 },
  );
  reveals.forEach((el) => io.observe(el));
}

// Stacked cards and rail items have their own motion; long-form text stays put.
const exiters = reveals
  .filter((el) => !el.closest('[data-stack], [data-rail], [data-noexit]'))
  .map((el) => ({ el, top: 0, h: 0 }));

subscribe({
  measure() {
    for (const x of exiters) {
      x.top = docTop(x.el);
      x.h = x.el.offsetHeight;
    }
  },
  update({ y, vh }) {
    const off = reducedMotion.matches;
    // Only the last fifth of the screen - anything still being read (a
    // heading just below the top bar) stays at full strength.
    const band = vh * 0.2;
    for (const x of exiters) {
      const bottom = x.top + x.h - y;
      if (bottom > band + 40 && (x.el as any).__xpZero) continue;
      const xp = off ? 0 : clamp(1 - bottom / band);
      setVar(x.el, '--xp', xp);
      (x.el as any).__xpZero = xp === 0;
    }
  },
});

/* ------------------------------------------------------------- Parallax
   [data-parallax="0.08"] on an image inside a clipping box: the image
   drifts against the scroll, relative to its box's distance from centre. */
const parallax = $$('[data-parallax]').map((el) => ({
  el,
  box: el.parentElement as HTMLElement,
  f: parseFloat(el.dataset.parallax || '0.08'),
  top: 0,
  h: 0,
}));

subscribe({
  measure() {
    for (const p of parallax) {
      p.top = docTop(p.box);
      p.h = p.box.offsetHeight;
    }
  },
  update({ y, vh }) {
    for (const p of parallax) {
      const rel = p.top - y;
      if (rel > vh + 100 || rel + p.h < -100) continue;
      const shift = reducedMotion.matches ? 0 : -(rel + p.h / 2 - vh / 2) * p.f;
      const s = `0 ${shift.toFixed(1)}px`;
      if ((p.el as any).__t !== s) {
        (p.el as any).__t = s;
        p.el.style.translate = s;
      }
    }
  },
});

/* ---------------------------------------------------------- Word scrub
   [data-scrub]: the text lights up word by word as it moves up the screen
   (--sp 0..1 on the block, each word's opacity from its own index). */
function splitWords(root: HTMLElement) {
  let i = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parts = (node.textContent ?? '').split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(part);
      } else {
        const w = document.createElement('span');
        w.className = 'w';
        w.style.setProperty('--i', String(i++));
        w.textContent = part;
        frag.append(w);
      }
    }
    node.replaceWith(frag);
  }
  root.style.setProperty('--n', String(i));
}

const scrubs = $$('[data-scrub]').map((el) => ({ el, top: 0, h: 0 }));
if (!reducedMotion.matches) {
  scrubs.forEach((s) => {
    splitWords(s.el);
    s.el.classList.add('is-scrub');
  });
  subscribe({
    measure() {
      for (const s of scrubs) {
        s.top = docTop(s.el);
        s.h = s.el.offsetHeight;
      }
    },
    update({ y, vh }) {
      for (const s of scrubs) {
        const topV = s.top - y;
        if (topV > vh * 1.2 || topV + s.h < -vh * 0.2) continue;
        const sp = reducedMotion.matches ? 1 : clamp((vh * 0.88 - topV) / (vh * 0.36 + s.h));
        setVar(s.el, '--sp', sp);
      }
    },
  });
}

/* ------------------------------------------------------ Stacking cards
   Phones: [data-stack] children stick one over another; the card being
   covered sinks back (--cover 0..1). Desktop keeps its grid. */
$$('[data-stack]').forEach((stack) => {
  const cards = Array.from(stack.children) as HTMLElement[];
  cards.forEach((c, i) => c.style.setProperty('--si', String(i)));
  let top = 0;
  let h = 0;
  subscribe({
    measure() {
      top = docTop(stack);
      h = stack.offsetHeight;
    },
    update({ y, vh }) {
      if (!phone.matches || reducedMotion.matches) {
        cards.forEach((c) => setVar(c, '--cover', 0));
        return;
      }
      if (top - y > vh || top + h - y < -vh) return;
      for (let i = 0; i < cards.length; i++) {
        const next = cards[i + 1];
        if (!next) {
          setVar(cards[i], '--cover', 0);
          continue;
        }
        const a = cards[i].getBoundingClientRect();
        const b = next.getBoundingClientRect();
        setVar(cards[i], '--cover', clamp((a.bottom - b.top) / Math.max(1, a.height - 20)));
      }
    },
  });
});

/* ---------------------------------------------------------------- Rails
   Phones: [data-rail] lists become swipeable rows. Adds a counter, a
   progress line and prev/next buttons (for people who don't swipe). */
$$('[data-rail]').forEach((rail) => {
  const items = Array.from(rail.children) as HTMLElement[];
  if (items.length < 2) return;
  const label = rail.dataset.rail || 'items';
  const meta = document.createElement('div');
  meta.className = 'rail-meta';
  meta.innerHTML =
    `<span class="rail-meta__count" aria-live="polite"><b>01</b> / ${String(items.length).padStart(2, '0')}</span>` +
    '<span class="rail-meta__bar" aria-hidden="true"><i></i></span>' +
    `<button type="button" class="rail-meta__btn" data-dir="-1" aria-label="Previous ${label}">` +
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>' +
    `<button type="button" class="rail-meta__btn" data-dir="1" aria-label="Next ${label}">` +
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>';
  rail.after(meta);
  const count = meta.querySelector('b')!;
  const bar = meta.querySelector<HTMLElement>('.rail-meta__bar i')!;
  const [prev, next] = Array.from(meta.querySelectorAll<HTMLButtonElement>('button'));

  const step = () => (items[1].offsetLeft - items[0].offsetLeft) || rail.clientWidth;
  const sync = () => {
    const max = rail.scrollWidth - rail.clientWidth;
    const idx = Math.round(rail.scrollLeft / step());
    count.textContent = String(Math.min(items.length, idx + 1)).padStart(2, '0');
    bar.style.transform = `scaleX(${max > 0 ? (rail.scrollLeft + rail.clientWidth) / rail.scrollWidth : 1})`;
    prev.disabled = rail.scrollLeft <= 2;
    next.disabled = rail.scrollLeft >= max - 2;
  };
  let raf = 0;
  rail.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(sync);
  }, { passive: true });
  meta.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-dir]');
    if (!b) return;
    rail.scrollBy({ left: step() * Number(b.dataset.dir), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  });
  phone.addEventListener('change', sync);
  sync();
});

/* ------------------------------------------------------- Scroll marquee
   [data-velocity] tracks already loop on a CSS animation; scrolling pushes
   them along too, so the strip reacts to the reader's hand. The offset
   wraps at half the track (the content repeats), so it never runs out. */
const velocity = $$('[data-velocity]').map((el) => ({
  el,
  half: 0,
  top: 0,
  on: false,
  f: parseFloat(el.dataset.velocity || '0.4'),
}));
subscribe({
  measure() {
    for (const v of velocity) {
      // Only strips that are actually looping (the logo row loops on
      // phones only; on desktop it's a static, wrapped row).
      v.on = getComputedStyle(v.el).animationName !== 'none';
      if (!v.on) v.el.style.translate = '';
      v.half = v.el.scrollWidth / 2;
      v.top = docTop(v.el);
    }
  },
  update({ y, vh }) {
    if (reducedMotion.matches) return;
    for (const v of velocity) {
      if (!v.on || !v.half || Math.abs(v.top - y - vh / 2) > vh * 1.5) continue;
      const off = (y * v.f) % v.half;
      v.el.style.translate = `${(-off).toFixed(1)}px 0`;
    }
  },
});

/* ---------------------------------------------------------- Exit scenes
   [data-exit-scene]: --xs runs 0..1 as the block scrolls off the top; its
   children use it to break apart (the home hero). */
const scenes = $$('[data-exit-scene]').map((el) => ({ el, top: 0, h: 0 }));
subscribe({
  measure() {
    for (const s of scenes) {
      s.top = docTop(s.el);
      s.h = s.el.offsetHeight;
    }
  },
  update({ y }) {
    for (const s of scenes) {
      const xs = reducedMotion.matches ? 0 : clamp((y - s.top) / (s.h * 0.8));
      if (xs === 1 && (s.el as any).__xsDone) continue;
      (s.el as any).__xsDone = xs === 1;
      setVar(s.el, '--xs', xs);
    }
  },
});
