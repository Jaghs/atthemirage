// A hazy cursor for mice and trackpads: a small bright point inside a soft glow
// that drifts a moment behind it, like heat shimmer. It swells over things you
// can click and tightens while dragging. Touch screens keep their usual behaviour.
(function () {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const glow = document.createElement('div');
    glow.className = 'haze-glow';
    const dot = document.createElement('div');
    dot.className = 'haze-dot';
    // Over the movable wall: a hand drawn in broken, drifting slits (like the
    // enter arrow's hazy tail), open to show it can be grabbed, closed while
    // dragging. Hand shapes adapted from Lucide's "hand" and "grab" icons (ISC).
    const hand = document.createElement('div');
    hand.className = 'haze-hand';
    hand.innerHTML = '<svg viewBox="0 0 24 24">'
        + '<g class="hand-open"><path d="M18 11V6a2 2 0 0 0-4 0" /><path d="M14 10V4a2 2 0 0 0-4 0v2" />'
        + '<path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" /></g>'
        + '<g class="hand-closed"><path d="M18 11.5V9a2 2 0 0 0-4 0v1.4" /><path d="M14 10V8a2 2 0 0 0-4 0v2" />'
        + '<path d="M10 9.9V9a2 2 0 0 0-4 0v5" /><path d="M6 14a2 2 0 0 0-4 0" /><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0" /></g>'
        + '</svg>';
    [glow, dot, hand].forEach((el) => el.setAttribute('aria-hidden', 'true'));
    document.body.append(glow, dot, hand);
    document.documentElement.classList.add('has-haze-cursor');

    const CLICKABLE = 'a, button, [role="button"], .tile-photo, .viewer-img, .places-menu button';
    let x = -100, y = -100, gx = -100, gy = -100;
    let shown = false;

    function show(on) {
        if (on === shown) return;
        shown = on;
        document.documentElement.classList.toggle('haze-visible', on);
    }

    document.addEventListener('pointermove', (event) => {
        if (event.pointerType !== 'mouse') return;
        x = event.clientX;
        y = event.clientY;
        if (!shown) {
            gx = x;
            gy = y;
        }
        show(true);
        const target = event.target instanceof Element ? event.target : null;
        const over = !!(target && target.closest(CLICKABLE));
        const body = document.body.classList;
        const onWall = !over && !!(target && target.closest('.wall')) && !body.contains('is-viewing');
        document.documentElement.classList.toggle('haze-over', over);
        document.documentElement.classList.toggle('haze-grab', onWall);
    }, { passive: true });

    document.addEventListener('pointerdown', () => document.documentElement.classList.add('haze-press'));
    document.addEventListener('pointerup', () => document.documentElement.classList.remove('haze-press'));
    document.addEventListener('mouseleave', () => show(false));
    window.addEventListener('blur', () => show(false));

    function frame() {
        // The glow trails behind the point, easing towards it
        const follow = still ? 1 : 0.18;
        gx += (x - gx) * follow;
        gy += (y - gy) * follow;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        hand.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
