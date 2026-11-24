/* История заказов: данные берутся из PostgreSQL через GET /api/orders. */
(function () {
  'use strict';

  const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 })
    .format(Number(value) || 0) + ' ₽';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  async function loadOrderHistory() {
    const message = document.getElementById('history-message');
    const list = document.getElementById('order-history-list');
    if (!message || !list) return;

    const user = await window.authReady;
    if (!user) {
      message.innerHTML = 'Чтобы увидеть историю заказов, <a href="login.html">войдите в аккаунт</a>.';
      return;
    }

    try {
      const orders = await window.api.orders();

      if (!orders.length) {
        message.innerHTML = 'У вас пока нет заказов.<br><br><a href="parfum.html">Перейти к парфюмерии</a>';
        return;
      }

      message.hidden = true;
      list.innerHTML = orders.map(order => {
        const date = order.date ? new Date(order.date).toLocaleString('ru-RU') : 'Дата не указана';
        const rows = (order.items || []).map(item => `<div class="history-item">
          <img src="${safe(item.image || 'media/panda.jpg')}" alt="">
          <div><strong>${safe(item.name)}</strong><small>${item.quantity} шт. × ${money(item.price)}</small></div>
          <b>${money(Number(item.price) * Number(item.quantity))}</b>
        </div>`).join('');

        return `<article class="history-order">
          <div class="history-order-head">
            <div><h3>Заказ № NB-${String(order.id).padStart(6, '0')}</h3><small>${safe(date)}</small></div>
            <span class="history-status">${safe(order.status || 'Новый')}</span>
          </div>
          <div>${rows || '<p>Состав заказа не найден.</p>'}</div>
          <div class="history-details">
            Получатель: ${safe(order.customername)}<br>
            Доставка: ${safe(order.delivery)} — ${safe(order.address)}<br>
            Оплата: ${safe(order.payment)}${order.phone ? '<br>Телефон: ' + safe(order.phone) : ''}
          </div>
          <div class="history-total">Итого: ${money(order.total)}</div>
        </article>`;
      }).join('');
    } catch (error) {
      message.hidden = false;
      message.textContent = 'Не удалось загрузить заказы: ' + error.message;
    }
  }

  document.addEventListener('DOMContentLoaded', loadOrderHistory);
})();
