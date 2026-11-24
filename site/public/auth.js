/* Регистрация, вход, выход и состояние пользователя.
   window.authReady — промис, который дождётся ответа /api/auth/me.
   Остальные скрипты (cart.js, order-history.js) используют его. */
(function () {
  'use strict';

  window.authReady = window.api.me()
    .then(data => data.user)
    .catch(() => null)
    .then(user => {
      window.currentUser = user;
      updateNav(user);
      return user;
    });

  function showMessage(message, isError) {
    const box = document.getElementById('auth-message');
    if (!box) { alert(message); return; }
    box.textContent = message;
    box.hidden = false;
    box.style.color = isError ? '#b00020' : '#2e7d32';
    box.style.margin = '10px 0';
  }

  // Куда вернуться после входа (например, login.html?next=checkout.html)
  function nextPage() {
    const next = new URLSearchParams(window.location.search).get('next');
    return next && /^[a-z0-9_.-]+\.html$/i.test(next) ? next : 'index.html';
  }

  // Гостевая корзина из localStorage переезжает в базу после входа
  async function mergeGuestCart() {
    let items = [];
    try { items = JSON.parse(localStorage.getItem('noirBlancCart') || '[]'); } catch (e) { items = []; }

    const payload = items
      .map(item => ({ perfumeid: Number(item.perfumeid ?? item.id), quantity: Number(item.quantity) || 1 }))
      .filter(item => Number.isInteger(item.perfumeid) && item.perfumeid > 0);

    if (payload.length) {
      try { await window.api.mergeCart(payload); } catch (e) { console.warn('Не удалось объединить корзину:', e.message); }
    }
    localStorage.removeItem('noirBlancCart');
  }

  function updateNav(user) {
    const link = document.querySelector('[data-auth-link]');
    if (!link) return;

    if (user) {
      link.href = 'account.html';
      link.title = user.fullname + ' — личный кабинет';
      link.setAttribute('aria-label', 'Личный кабинет: ' + user.fullname);
      link.classList.add('is-logged-in');
      link.classList.remove('is-guest');
    } else {
      link.href = 'login.html';
      link.title = 'Авторизация';
      link.setAttribute('aria-label', 'Авторизация');
      link.classList.remove('is-logged-in');
      link.classList.add('is-guest');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.querySelector('form[data-register]');
    if (registerForm) {
      registerForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = registerForm.querySelector('button[type="submit"]');
        const data = {
          fullname: registerForm.querySelector('[name="fullname"]').value.trim(),
          email: registerForm.querySelector('[name="email"]').value.trim(),
          password: registerForm.querySelector('[name="password"]').value
        };

        button.disabled = true;
        try {
          await window.api.register(data);
          await mergeGuestCart();
          window.location.href = nextPage();
        } catch (error) {
          showMessage(error.message, true);
          button.disabled = false;
        }
      });
    }

    const loginForm = document.querySelector('form[data-login]');
    if (loginForm) {
      loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = loginForm.querySelector('button[type="submit"]');
        const data = {
          email: loginForm.querySelector('[name="email"]').value.trim(),
          password: loginForm.querySelector('[name="password"]').value
        };

        button.disabled = true;
        try {
          await window.api.login(data);
          await mergeGuestCart();
          window.location.href = nextPage();
        } catch (error) {
          showMessage(error.message, true);
          button.disabled = false;
        }
      });
    }
  });
})();
