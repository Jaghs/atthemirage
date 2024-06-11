function toggleAudio() {
    const audio = document.getElementById('background-audio');
    audio.volume = 0.2;  // Set volume to 20%
    if (audio.paused) {
        audio.play();
        console.log("Audio is playing");
    } else {
        audio.pause();
        console.log("Audio is paused");
    }
}
