/* Корзина Noir&Blanc.
   Гость: корзина в localStorage.
   После входа: корзина хранится в PostgreSQL (таблица cart_items). */
(function () {
  'use strict';

  const KEY = 'noirBlancCart';
  const state = { cart: [] };

  const money = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })
    .format(Number(value) || 0) + ' ₽';
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function readGuestCart() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }

  function saveGuestCart(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
  }

  function normalize(item) {
    return {
      perfumeid: Number(item.perfumeid ?? item.id) || null,
      name: item.name,
      price: Number(item.price) || 0,
      image: item.image || 'media/panda.jpg',
      type: item.type || 'Аромат',
      volume: item.volume || '',
      quantity: Number(item.quantity) || 1
    };
  }

  async function loadCart() {
    const user = await window.authReady;
    if (user) {
      try {
        state.cart = (await window.api.cart()).map(normalize);
      } catch (error) {
        console.warn('Корзина из БД недоступна:', error.message);
        state.cart = [];
      }
    } else {
      state.cart = readGuestCart().map(normalize);
    }
    return state.cart;
  }

  function toast(message) {
    let el = document.querySelector('.cart-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cart-toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.__cartToastTimer);
    window.__cartToastTimer = setTimeout(() => el.classList.remove('show'), 2300);
  }

  function ensureCartStyles() {
    if (document.getElementById('cart-runtime-styles')) return;
    const style = document.createElement('style');
    style.id = 'cart-runtime-styles';
    style.textContent = `.cart-toast{position:fixed;right:24px;bottom:24px;z-index:9999;background:#242124;color:#fff;padding:15px 22px;border:1px solid #f1c4d8;border-radius:16px;box-shadow:0 12px 35px #0002;opacity:0;transform:translateY(12px);pointer-events:none;transition:.25s;font-size:14px;max-width:340px}.cart-toast.show{opacity:1;transform:translateY(0)}.cart-item{animation:cartAppear .35s ease both}@keyframes cartAppear{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.cart-item-image{background:#fff}.cart-empty-link{display:inline-block;margin-top:10px;padding:12px 20px;border-radius:25px;background:#f7cce3;color:#222;text-decoration:none}.cart-item-info h3{overflow-wrap:anywhere}`;
    document.head.appendChild(style);
  }

  function updateCount() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll('#cart-count').forEach(el => { el.textContent = count; });
  }

  function renderCart() {
    const host = document.getElementById('cart-items');
    if (!host) return;

    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = money(total);

    const checkout = document.querySelector('.checkout-btn');
    if (checkout) {
      checkout.style.opacity = state.cart.length ? '1' : '.5';
      checkout.style.pointerEvents = state.cart.length ? 'auto' : 'none';
    }

    if (!state.cart.length) {
      host.innerHTML = `<div class="empty-cart"><div class="panda-cart"></div><h3>Ваша корзина пока пуста</h3><p>Самое время найти аромат, который станет вашим любимым ♡</p><a class="cart-empty-link" href="parfum.html">Перейти к ароматам</a></div>`;
      return;
    }

    host.innerHTML = state.cart.map((item, index) => `<article class="cart-item" data-index="${index}">
      <img class="cart-item-image" src="${safe(item.image)}" alt="${safe(item.name)}" onerror="this.style.visibility='hidden'">
      <div class="cart-item-info"><h3>${safe(item.name)}</h3><p class="cart-item-type">${safe(item.type)}${item.volume ? ' · ' + safe(item.volume) + ' мл' : ''}</p><div class="cart-item-price">${money(item.price)}</div>
      <div class="cart-item-controls"><button type="button" class="quantity-btn" data-action="minus" aria-label="Уменьшить количество">−</button><span class="quantity">${item.quantity}</span><button type="button" class="quantity-btn" data-action="plus" aria-label="Увеличить количество">+</button><button type="button" class="remove-item" data-action="remove">Удалить</button></div></div>
      <div class="cart-item-total">${money(item.price * item.quantity)}</div></article>`).join('');
  }

  function renderCheckout() {
    const host = document.getElementById('checkout-items');
    if (!host) return;

    host.innerHTML = state.cart.length
      ? state.cart.map(item => `<div class="checkout-preview-item" style="display:flex;gap:12px;align-items:center;margin:12px 0"><img src="${safe(item.image)}" alt="" style="width:58px;height:65px;object-fit:contain;border-radius:8px;background:#fff" onerror="this.style.visibility='hidden'"><div style="flex:1"><strong>${safe(item.name)}</strong><div style="color:#888;font-size:.9em">${item.quantity} × ${money(item.price)}</div></div><strong>${money(item.price * item.quantity)}</strong></div>`).join('')
      : '<p>Корзина пуста. Вернитесь в каталог и выберите аромат.</p>';

    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalEl = document.getElementById('checkout-total');
    if (totalEl) totalEl.textContent = money(total);

    const submit = document.querySelector('.checkout-submit');
    if (submit) submit.disabled = !state.cart.length;
  }

  async function refreshUI() {
    await loadCart();
    updateCount();
    renderCart();
    renderCheckout();
  }

  function currentProduct() {
    const page = document.querySelector('[data-perfume-id]');
    const info = document.querySelector('.product-info');
    if (!info) return null;

    const perfumeid = page ? Number(page.dataset.perfumeId) : null;
    const title = info.querySelector('h1');
    const priceText = info.querySelector('.current-price')?.textContent || info.querySelector('.price')?.textContent || '0';
    const image = document.querySelector('img[src*="media/"]');
    const description = info.querySelector('.description')?.innerText || '';
    const volumeMatch = description.match(/Об[ъь]ём:\s*([\d\s]+)\s*мл/i);
    const typeMatch = description.match(/Тип продукта:\s*([^\n]+)/i);

    return {
      perfumeid,
      name: title ? title.textContent.trim() : '',
      price: Number(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0,
      image: image ? image.getAttribute('src') : '',
      type: typeMatch ? typeMatch[1].trim() : (info.querySelector('.brand')?.textContent.trim() || 'Аромат'),
      volume: volumeMatch ? volumeMatch[1].replace(/\s/g, '') : '',
      quantity: 1
    };
  }

  function productFromCard(card) {
    const link = card.querySelector('a[href]');
    const priceText = card.querySelector('.price')?.textContent || '0';
    return {
      perfumeid: Number(card.dataset.perfumeId) || null,
      name: card.querySelector('h3')?.textContent.trim() || '',
      image: card.querySelector('img')?.getAttribute('src') || '',
      price: Number(priceText.replace(/[^\d,]/g, '').replace(',', '.')) || 0,
      type: card.querySelector('p')?.textContent.trim() || 'Аромат',
      volume: '',
      quantity: 1
    };
  }

  async function addProduct(product) {
    if (!product || !product.name || !product.price || !product.perfumeid) {
      toast('Не удалось определить товар. Обновите страницу.');
      return;
    }

    const user = await window.authReady;
    try {
      if (user) {
        await window.api.addToCart(product.perfumeid, 1);
        await refreshUI();
      } else {
        const cart = readGuestCart();
        const found = cart.find(item => Number(item.perfumeid ?? item.id) === product.perfumeid);
        if (found) found.quantity = Math.min(99, Number(found.quantity) + 1);
        else cart.push(product);
        saveGuestCart(cart);
        await refreshUI();
      }
      toast('♡ ' + product.name + ' добавлен в корзину');
    } catch (error) {
      toast(error.message);
    }
  }

  // Цены в каталоге берём из PostgreSQL, чтобы они не расходились с базой
  async function syncCatalogPrices() {
    try {
      const products = await window.api.products();
      const byId = new Map(products.map(product => [Number(product.id), product]));

      document.querySelectorAll('[data-perfume-id]').forEach(el => {
        const product = byId.get(Number(el.dataset.perfumeId));
        if (!product) return;

        const currentPrice = el.querySelector('.current-price');
        const price = el.querySelector('.price');
        if (currentPrice) currentPrice.textContent = 'от ' + money(product.price);
        else if (price) price.textContent = 'от ' + money(product.price);

        const name = el.querySelector('h3');
        if (name) name.textContent = product.name;

        // Каталог: обновляем характеристики для фильтров
        if (el.classList.contains('parfum')) {
          el.dataset.gender = product.gender || '';
          el.dataset.type = product.type || '';
          el.dataset.price = String(product.price ?? '');
          el.dataset.name = product.name || el.dataset.productName || '';

          const typeEl = el.querySelector('a > p');
          if (typeEl && product.type) typeEl.textContent = product.type;
        }
      });

      document.dispatchEvent(new CustomEvent('catalog-updated'));
    } catch (error) {
      console.warn('Не удалось загрузить цены из БД:', error.message);
    }
  }

  document.addEventListener('click', async event => {
    const add = event.target.closest('.btn-add-to-cart, [data-add-to-cart]');
    if (add) {
      event.preventDefault();
      let product = currentProduct();
      if (!product) {
        const card = add.closest('.parfum');
        if (card) product = productFromCard(card);
      }
      await addProduct(product);
      return;
    }

    const control = event.target.closest('[data-action]');
    if (control) {
      const card = control.closest('[data-index]');
      if (!card) return;

      const index = Number(card.dataset.index);
      const item = state.cart[index];
      if (!item) return;

      const user = await window.authReady;
      let quantity = item.quantity;
      if (control.dataset.action === 'plus') quantity = Math.min(99, quantity + 1);
      if (control.dataset.action === 'minus') quantity = quantity - 1;
      if (control.dataset.action === 'remove') quantity = 0;

      try {
        if (user && item.perfumeid) {
          if (quantity > 0) await window.api.updateCart(item.perfumeid, quantity);
          else await window.api.removeFromCart(item.perfumeid);
        } else {
          const cart = readGuestCart();
          if (quantity > 0) cart[index].quantity = quantity;
          else cart.splice(index, 1);
          saveGuestCart(cart);
        }
        await refreshUI();
      } catch (error) {
        toast(error.message);
      }
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    ensureCartStyles();
    await syncCatalogPrices();
    await refreshUI();

    const checkoutForm = document.getElementById('checkout-form');
    if (checkoutForm) {
      checkoutForm.addEventListener('submit', async event => {
        event.preventDefault();

        const user = await window.authReady;
        if (!user) {
          toast('Чтобы оформить заказ, войдите в аккаунт');
          setTimeout(() => { window.location.href = 'login.html?next=checkout.html'; }, 900);
          return;
        }

        const raw = Object.fromEntries(new FormData(checkoutForm).entries());
        const payload = {
          fullname: raw.name,
          phone: raw.phone,
          email: raw.email,
          delivery: raw.delivery,
          address: raw.address,
          payment: raw.payment,
          comment: raw.comment
        };

        const button = checkoutForm.querySelector('.checkout-submit');
        if (button) button.disabled = true;

        try {
          const order = await window.api.createOrder(payload);
          localStorage.removeItem(KEY);
          checkoutForm.hidden = true;
          document.querySelector('.order-preview')?.setAttribute('hidden', '');

          const success = document.getElementById('order-success');
          if (success) {
            success.hidden = false;
            const number = document.getElementById('order-number');
            if (number) number.textContent = 'Номер заказа: ' + order.number;
            success.scrollIntoView({ behavior: 'smooth' });
          } else {
            toast('Заказ ' + order.number + ' оформлен');
          }

          await refreshUI();
        } catch (error) {
          toast(error.message);
          if (button) button.disabled = false;
        }
      });
    }
  });

  ensureCartStyles();
})();
