/* Кнопка «Наверх»: появляется после прокрутки вниз.
   На страницах, где кнопка уже есть в HTML, скрипт ничего не дублирует. */
(function () {
  'use strict';

  function init() {
    if (document.getElementById('back-to-top-noir')) return;

    const button = document.createElement('button');
    button.id = 'back-to-top-noir';
    button.type = 'button';
    button.setAttribute('aria-label', 'Вернуться наверх');
    button.title = 'Наверх';
    button.textContent = '↑';
    document.body.appendChild(button);

    const update = () => button.classList.toggle('visible', window.scrollY > 300);
    window.addEventListener('scroll', update, { passive: true });
    update();

    button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
