// About: the portrait is a mirage. At a distance it shimmers, hazy and colourless;
// as the cursor comes closer the haze settles and the colour comes through. On
// touch screens it settles by itself a moment after the page opens, and a tap
// stirs it up again. The field notes are counted from the photos themselves.
(function () {
    const about = document.querySelector('.about');
    const portrait = document.querySelector('.mirage-portrait');
    if (!about || !portrait) return;
    const photos = window.PHOTOS || [];

    // ------------------------------------------------------------ field notes

    const note = (name) => about.querySelector(`[data-note="${name}"]`);
    const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const unique = (list) => [...new Set(list.filter(Boolean))];

    note('photos').textContent = photos.length;

    // Places, most photographed first; each opens the gallery on that place
    const count = (g) => photos.filter((p) => p.group === g).length;
    const places = unique(photos.map((p) => p.group)).sort((a, b) => count(b) - count(a) || a.localeCompare(b));
    places.forEach((place, i) => {
        const link = document.createElement('a');
        link.href = '#' + slug(place);
        link.textContent = place;
        note('places').append(link);
        if (i < places.length - 1) note('places').append(', ');
    });

    note('cities').textContent = unique(photos.map((p) => (p.place || '').includes(',') && p.place.split(',')[0].trim())).length;

    const years = photos.map((p) => parseInt((p.date || '').slice(-4), 10)).filter(Boolean);
    if (years.length) {
        const low = Math.min(...years), high = Math.max(...years);
        note('years').textContent = low === high ? String(low) : `${low} – ${high}`;
    }

    note('cameras').textContent = unique(photos.map((p) => p.camera)).join(', ');

    // ----------------------------------------------------------------- mirage

    const turbulence = about.querySelectorAll('.mirage-defs feTurbulence');
    const displace = about.querySelectorAll('.mirage-defs feDisplacementMap');
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touch = window.matchMedia('(hover: none)').matches;

    let haze = 1;        // 1 = full mirage, 0 = clear and real
    let target = 1;
    let running = false;
    let settleTimer = null;

    const visible = () => document.body.classList.contains('is-about');

    function draw(now) {
        haze += (target - haze) * (still ? 1 : 0.06);
        if (Math.abs(target - haze) < 0.002) haze = target;
        portrait.style.setProperty('--haze', haze.toFixed(3));
        const t = now / 1000;
        displace[0].setAttribute('scale', (26 * haze).toFixed(2));
        displace[1].setAttribute('scale', (14 + 22 * haze).toFixed(2));
        if (!still) {
            // The heat moves: the ripples drift slowly
            turbulence[0].setAttribute('baseFrequency', `0.008 ${(0.06 + 0.012 * Math.sin(t * 0.9)).toFixed(4)}`);
            turbulence[1].setAttribute('baseFrequency', `0.006 ${(0.09 + 0.02 * Math.sin(t * 1.3 + 1)).toFixed(4)}`);
        }
    }

    function loop(now) {
        if (!visible()) {
            running = false;
            return;
        }
        draw(now);
        requestAnimationFrame(loop);
    }

    function start() {
        if (running || !visible()) return;
        running = true;
        requestAnimationFrame(loop);
    }

    // Closer cursor, clearer portrait
    document.addEventListener('pointermove', (event) => {
        if (!visible() || event.pointerType !== 'mouse') return;
        const r = portrait.getBoundingClientRect();
        const dx = Math.max(r.left - event.clientX, 0, event.clientX - r.right);
        const dy = Math.max(r.top - event.clientY, 0, event.clientY - r.bottom);
        const distance = Math.hypot(dx, dy);
        target = Math.min(1, distance / Math.max(260, r.width));
        start();
    }, { passive: true });

    // Phones: it settles by itself, and a tap stirs the haze up again
    function settleSoon() {
        clearTimeout(settleTimer);
        target = 1;
        settleTimer = setTimeout(() => (target = 0), still ? 0 : 1100);
        start();
    }

    portrait.addEventListener('click', () => {
        if (touch) settleSoon();
    });

    // Each time the About page opens (only when it changes from hidden to shown)
    let wasVisible = visible();
    new MutationObserver(() => {
        const now = visible();
        if (now && !wasVisible) {
            haze = target = 1;
            if (touch || still) settleSoon();
            start();
        }
        wasVisible = now;
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (visible()) {
        if (touch || still) settleSoon();
        start();
    }
})();
