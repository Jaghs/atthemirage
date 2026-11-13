// "Enter": the title dissolves into the sky while the ribbon blooms out to fill
// the screen, then the gallery opens with the ribbon carrying on where it left off.
(function () {
    const link = document.querySelector('.enter');
    if (!link) return;

    const DURATION = 1400; // matches the dissolve animation in styles.css

    link.addEventListener('click', (event) => {
        // Let ctrl/cmd/shift-clicks open a new tab or window as usual.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (!window.mirage) return; // no animated background: just follow the link
        event.preventDefault();
        document.body.classList.add('is-leaving');
        window.mirage.bloomTo(1, DURATION).then(() => {
            window.mirage.handoff();
            window.location.href = link.href;
        });
    });

    // Once the splash page has settled, quietly fetch the gallery's photos so
    // they're ready the moment the gallery opens.
    window.addEventListener('load', () => {
        const prefetch = () => (window.PHOTOS || []).forEach((photo) => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'image';
            link.href = photo.src;
            document.head.append(link);
        });
        if ('requestIdleCallback' in window) requestIdleCallback(prefetch, { timeout: 2000 });
        else setTimeout(prefetch, 1000);
    });

    // Coming back with the browser's back button can restore this page exactly as
    // it was left (faded out, fully bloomed), so put it back to its resting state.
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;
        document.body.classList.remove('is-leaving');
        if (window.mirage) window.mirage.reset();
    });
})();
