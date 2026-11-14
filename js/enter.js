// "Enter": the title dissolves into the sky while the ribbon blooms out to fill
// the screen, then the gallery opens with the ribbon carrying on where it left off.
(function () {
    const link = document.querySelector('.enter');
    if (!link) return;
    // On your own computer there's no web server to find "gallery", so link
    // straight to the file there. The real site keeps the clean address.
    const live = location.hostname.endsWith('atthemirage.com');
    if (!live) link.setAttribute('href', 'gallery.html');

    const DURATION = 1400; // matches the dissolve animation in styles.css
    // The version tag added when the site is published (see site.yml), so the
    // gallery's files are fetched ahead of time under the same name the gallery uses
    const script = document.currentScript;
    const version = ((script && script.src.match(/\?v=[a-z0-9]+/)) || [''])[0];

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

    // As soon as the splash page has loaded, fetch everything the gallery needs
    // (its page, styles, code and every wall photo) so it opens from the cache.
    window.addEventListener('load', () => {
        const files = [link.getAttribute('href'), 'css/gallery.css' + version, 'js/gallery.js' + version]
            .concat((window.PHOTOS || []).map((photo) => photo.src));
        files.forEach((href) => {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.href = href;
            document.head.append(link);
        });
        // Also decode the photos now, which warms the browser's image cache further.
        (window.PHOTOS || []).forEach((photo) => {
            const img = new Image();
            img.src = photo.src;
        });
    });

    // Coming back with the browser's back button can restore this page exactly as
    // it was left (faded out, fully bloomed), so put it back to its resting state.
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;
        document.body.classList.remove('is-leaving');
        if (window.mirage) window.mirage.reset();
    });
})();
