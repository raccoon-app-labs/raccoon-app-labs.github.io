const root = document.documentElement;
const switcher = document.querySelector('.language-switch');
const carousels = [...document.querySelectorAll('[data-carousel]')];

function carouselSlides(carousel) {
  return [...carousel.querySelectorAll('.shot:not([hidden])')];
}

function updateCarousel(carousel) {
  const track = carousel.querySelector('[data-carousel-track]');
  const slides = carouselSlides(carousel);
  const counter = carousel.querySelector('[data-carousel-count]');
  const previous = carousel.querySelector('[data-carousel-prev]');
  const next = carousel.querySelector('[data-carousel-next]');
  if (!slides.length) return;

  const firstLeft = slides[0].offsetLeft;
  let active = 0;
  let distance = Number.POSITIVE_INFINITY;
  slides.forEach((slide, index) => {
    const currentDistance = Math.abs(slide.offsetLeft - firstLeft - track.scrollLeft);
    if (currentDistance < distance) {
      distance = currentDistance;
      active = index;
    }
  });

  const trackRect = track.getBoundingClientRect();
  const visible = slides
    .map((slide, index) => ({ index, rect: slide.getBoundingClientRect() }))
    .filter(item => {
      const visibleWidth = Math.min(item.rect.right, trackRect.right) - Math.max(item.rect.left, trackRect.left);
      return visibleWidth >= item.rect.width * .55;
    });
  const visibleStart = (visible[0]?.index ?? active) + 1;
  const visibleEnd = (visible.at(-1)?.index ?? active) + 1;
  counter.textContent = visibleStart === visibleEnd
    ? `${visibleStart} / ${slides.length}`
    : `${visibleStart}–${visibleEnd} / ${slides.length}`;
  previous.disabled = track.scrollLeft <= 4;
  next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
  carousel.dataset.active = String(active);
}

function moveCarousel(carousel, direction) {
  const slides = carouselSlides(carousel);
  const current = Number(carousel.dataset.active || 0);
  const target = Math.max(0, Math.min(slides.length - 1, current + direction));
  const firstLeft = slides[0]?.offsetLeft || 0;
  carousel.querySelector('[data-carousel-track]').scrollTo({
    left: (slides[target]?.offsetLeft || firstLeft) - firstLeft,
    behavior: 'smooth'
  });
}

function refreshCarousels(lang) {
  carousels.forEach(carousel => {
    carousel.querySelectorAll('.shot[data-locale]').forEach(slide => {
      slide.hidden = !['both', lang].includes(slide.dataset.locale);
    });
    const previous = carousel.querySelector('[data-carousel-prev]');
    const next = carousel.querySelector('[data-carousel-next]');
    previous.setAttribute('aria-label', lang === 'ru' ? 'Предыдущий скриншот' : 'Previous screenshot');
    next.setAttribute('aria-label', lang === 'ru' ? 'Следующий скриншот' : 'Next screenshot');
    carousel.querySelector('[data-carousel-track]').scrollTo({ left: 0, behavior: 'auto' });
    requestAnimationFrame(() => updateCarousel(carousel));
  });
}

function setLanguage(lang) {
  root.lang = lang;
  document.querySelectorAll('[data-ru][data-en]').forEach(element => {
    element.textContent = element.dataset[lang];
  });
  document.querySelectorAll('[data-alt-ru][data-alt-en]').forEach(element => {
    element.alt = element.dataset[lang === 'ru' ? 'altRu' : 'altEn'];
  });
  switcher.style.setProperty('--side', lang === 'ru' ? 0 : 1);
  switcher.querySelectorAll('button').forEach(button => {
    button.setAttribute('aria-pressed', button.dataset.lang === lang ? 'true' : 'false');
  });
  refreshCarousels(lang);
  localStorage.setItem('ral-language', lang);
}

carousels.forEach(carousel => {
  const track = carousel.querySelector('[data-carousel-track]');
  let frame;
  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => moveCarousel(carousel, -1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => moveCarousel(carousel, 1));
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => updateCarousel(carousel));
  }, { passive: true });
});

switcher.addEventListener('click', event => {
  const button = event.target.closest('[data-lang]');
  if (button) setLanguage(button.dataset.lang);
});

window.addEventListener('resize', () => carousels.forEach(updateCarousel));
setLanguage(localStorage.getItem('ral-language') || 'ru');
