// "Enter": the title and button dissolve while the ribbon blooms out to fill the
// screen, then the gallery opens with the ribbon carrying on where it left off.
(function () {
    const link = document.querySelector('.enter');
    if (!link) return;

    link.addEventListener('click', (event) => {
        // Let ctrl/cmd/shift-clicks open a new tab or window as usual.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (!window.mirage) return; // no animated background: just follow the link
        event.preventDefault();
        document.body.classList.add('is-leaving');
        window.mirage.bloomTo(1, 1200).then(() => {
            window.mirage.handoff();
            window.location.href = link.href;
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
