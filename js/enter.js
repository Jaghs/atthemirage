// "Enter": the camera flies through the gap between THE and MIRAGE while the
// ribbon blooms out to fill the screen, then the gallery opens with the ribbon
// carrying on where it left off.
(function () {
    const link = document.querySelector('.enter');
    const title = document.querySelector('.title');
    if (!link) return;

    const DURATION = 1500; // matches the fly-through animation in styles.css

    // Aim the zoom at the space between "THE" and "MIRAGE".
    function aimAtGap() {
        if (!title) return;
        const text = title.firstChild;
        const gap = text && text.nodeType === Node.TEXT_NODE ? text.textContent.lastIndexOf(' ') : -1;
        if (gap < 0) return;
        const range = document.createRange();
        range.setStart(text, gap);
        range.setEnd(text, gap + 1);
        const space = range.getBoundingClientRect();
        const box = title.getBoundingClientRect();
        const x = space.left + space.width / 2 - box.left;
        const y = box.height * 0.55; // a touch below centre, where the letters are widest
        title.style.transformOrigin = `${x}px ${y}px`;
    }

    link.addEventListener('click', (event) => {
        // Let ctrl/cmd/shift-clicks open a new tab or window as usual.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        if (!window.mirage) return; // no animated background: just follow the link
        event.preventDefault();
        aimAtGap();
        document.body.classList.add('is-leaving');
        window.mirage.bloomTo(1, DURATION).then(() => {
            window.mirage.handoff();
            window.location.href = link.href;
        });
    });

    // Coming back with the browser's back button can restore this page exactly as
    // it was left (faded out, fully bloomed), so put it back to its resting state.
    window.addEventListener('pageshow', (event) => {
        if (!event.persisted) return;
        document.body.classList.remove('is-leaving');
        if (title) title.style.transformOrigin = '';
        if (window.mirage) window.mirage.reset();
    });
})();
