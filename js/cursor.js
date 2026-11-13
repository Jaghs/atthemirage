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
    glow.setAttribute('aria-hidden', 'true');
    dot.setAttribute('aria-hidden', 'true');
    document.body.append(glow, dot);
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
        document.documentElement.classList.toggle('haze-over', !!(target && target.closest(CLICKABLE)));
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
        glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
})();
