let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const totalSlides = slides.length;

function showSlides() {
    slides.forEach((slide, index) => {
        slide.style.transform = `translateX(${(index - slideIndex) * 100}%)`;
    });
    slideIndex = (slideIndex + 1) % totalSlides;
}

// Initialize the slideshow
document.addEventListener('DOMContentLoaded', showSlides);

// Set an interval to change the slide every 5 seconds
setInterval(showSlides, 3000);
