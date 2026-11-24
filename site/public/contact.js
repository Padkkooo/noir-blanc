/* Форма «Свяжитесь с нами»: отправляет сообщение в PostgreSQL через POST /api/contact. */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const message = document.getElementById('contact-message');

    form.addEventListener('submit', async event => {
      event.preventDefault();

      const button = form.querySelector('button[type="submit"]');
      const data = Object.fromEntries(new FormData(form).entries());

      button.disabled = true;
      message.hidden = true;

      try {
        await window.api.contact(data);
        form.reset();
        message.textContent = 'Спасибо! Сообщение отправлено — мы свяжемся с вами.';
        message.classList.add('ok');
        message.classList.remove('error');
      } catch (error) {
        message.textContent = error.message;
        message.classList.add('error');
        message.classList.remove('ok');
      } finally {
        message.hidden = false;
        button.disabled = false;
      }
    });
  });
})();
