(function () {
    const button = document.querySelector('.sound');
    const audio = document.querySelector('.music');
    const label = button.querySelector('.sound-label');
    audio.volume = 0.2;

    function render(playing) {
        button.setAttribute('aria-pressed', String(playing));
        button.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
        label.textContent = playing ? 'sound on' : 'sound off';
    }

    button.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().catch(() => render(false));
        } else {
            audio.pause();
        }
    });

    audio.addEventListener('play', () => render(true));
    audio.addEventListener('pause', () => render(false));
})();
