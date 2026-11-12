// Light / dark theme toggle. The chosen theme lives on <html data-theme="…">
// (set before paint by the inline script in <head>); this file handles clicks,
// remembers the visitor's choice, and follows the device setting until they make one.
(function () {
    const root = document.documentElement;
    const button = document.querySelector('.theme-toggle');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    const deviceDark = window.matchMedia('(prefers-color-scheme: dark)');

    function apply(theme) {
        root.dataset.theme = theme;
        const dark = theme === 'dark';
        button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        themeColor.setAttribute('content', dark ? '#0e0d16' : '#f1efec');
        window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
    }

    function savedTheme() {
        try { return localStorage.getItem('theme'); } catch (e) { return null; }
    }

    button.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('theme', next); } catch (e) {}
        apply(next);
    });

    deviceDark.addEventListener('change', (event) => {
        if (!savedTheme()) apply(event.matches ? 'dark' : 'light');
    });

    apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
})();
