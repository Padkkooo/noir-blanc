/* Личный кабинет: профиль, статистика, последние заказы, смена пароля. */
(function () {
  'use strict';

  const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
    .format(Number(value) || 0) + ' ₽';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function setMessage(element, text, ok) {
    if (!element) return;
    element.textContent = text;
    element.hidden = false;
    element.classList.toggle('ok', Boolean(ok));
    element.classList.toggle('error', !ok);
  }

  function renderUser(user) {
    const name = document.getElementById('account-name');
    const email = document.getElementById('account-email');
    const since = document.getElementById('account-since');
    const form = document.getElementById('profile-form');
    const profileEmail = document.getElementById('profile-email');

    if (name) name.textContent = user.fullname;
    if (email) email.textContent = user.email;
    if (profileEmail) profileEmail.value = user.email;
    if (form) form.elements.fullname.value = user.fullname;

    if (since) {
      const date = user.createdAt ? new Date(user.createdAt) : null;
      since.textContent = date && !Number.isNaN(date.getTime())
        ? 'На сайте с ' + date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      since.hidden = !since.textContent;
    }

    const navLink = document.querySelector('[data-auth-link]');
    if (navLink) {
      navLink.href = 'account.html';
      navLink.title = user.fullname + ' — личный кабинет';
      navLink.setAttribute('aria-label', 'Личный кабинет: ' + user.fullname);
      navLink.classList.add('is-logged-in');
    }
  }

  async function loadOrders() {
    const host = document.getElementById('account-orders');
    const countEl = document.getElementById('account-orders-count');
    const spentEl = document.getElementById('account-total-spent');
    if (!host) return;

    try {
      const orders = await window.api.orders();

      if (countEl) countEl.textContent = orders.length;
      const spent = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      if (spentEl) spentEl.textContent = money(spent);

      if (!orders.length) {
        host.innerHTML = '<p class="account-empty">У вас пока нет заказов. <a href="parfum.html">Перейти к ароматам</a></p>';
        return;
      }

      host.innerHTML = orders.slice(0, 3).map(order => {
        const date = order.date
          ? new Date(order.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Дата не указана';
        return `<div class="account-order">
          <div><strong>Заказ № NB-${String(order.id).padStart(6, '0')}</strong><br><small>${safe(date)} · ${safe(order.status || 'Новый')}</small></div>
          <b>${money(order.total)}</b>
        </div>`;
      }).join('');
    } catch (error) {
      host.innerHTML = `<p class="form-message error">Не удалось загрузить заказы: ${safe(error.message)}</p>`;
    }
  }

  async function loadCartCount() {
    const el = document.getElementById('account-cart-count');
    if (!el) return;
    try {
      const items = await window.api.cart();
      el.textContent = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    } catch (e) {
      el.textContent = '0';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    const user = await window.authReady;
    if (!user) {
      window.location.replace('login.html?next=account.html');
      return;
    }

    renderUser(user);
    loadOrders();
    loadCartCount();

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = profileForm.querySelector('button[type="submit"]');
        const message = document.getElementById('profile-message');
        const fullname = profileForm.elements.fullname.value.trim();

        button.disabled = true;
        try {
          const data = await window.api.updateProfile(fullname);
          window.currentUser = data.user;
          renderUser(data.user);
          setMessage(message, 'Имя сохранено.', true);
        } catch (error) {
          setMessage(message, error.message, false);
        } finally {
          button.disabled = false;
        }
      });
    }

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async event => {
        event.preventDefault();
        const button = passwordForm.querySelector('button[type="submit"]');
        const message = document.getElementById('password-message');
        const currentPassword = passwordForm.elements.currentPassword.value;
        const newPassword = passwordForm.elements.newPassword.value;
        const repeatPassword = passwordForm.elements.repeatPassword.value;

        if (newPassword !== repeatPassword) {
          setMessage(message, 'Новые пароли не совпадают.', false);
          return;
        }

        button.disabled = true;
        try {
          await window.api.changePassword(currentPassword, newPassword);
          passwordForm.reset();
          setMessage(message, 'Пароль изменён.', true);
        } catch (error) {
          setMessage(message, error.message, false);
        } finally {
          button.disabled = false;
        }
      });
    }

    const logout = document.getElementById('account-logout');
    if (logout) {
      logout.addEventListener('click', async () => {
        logout.disabled = true;
        try { await window.api.logout(); } catch (e) { /* всё равно выходим */ }
        window.currentUser = null;
        window.location.replace('index.html');
      });
    }
  });
})();
