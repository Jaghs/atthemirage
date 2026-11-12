// Light / dark theme toggle. The chosen theme lives on <html data-theme="…">
// (set before paint by the inline script in <head>, dark unless the visitor chose
// light before); this file handles clicks and remembers the visitor's choice.
(function () {
    const root = document.documentElement;
    const button = document.querySelector('.theme-toggle');
    const themeColor = document.querySelector('meta[name="theme-color"]');

    function apply(theme) {
        root.dataset.theme = theme;
        const dark = theme === 'dark';
        button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
        themeColor.setAttribute('content', dark ? '#0e0d16' : '#f1efec');
        window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
    }

    button.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('theme', next); } catch (e) {}
        apply(next);
    });

    apply(root.dataset.theme === 'dark' ? 'dark' : 'light');
})();
