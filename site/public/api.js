/* Небольшая обёртка над fetch для работы с нашим API.
   Все запросы идут на тот же сервер, поэтому cookie сессии
   отправляется автоматически (credentials: 'same-origin'). */
(function () {
  async function request(path, options = {}) {
    const config = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: {}
    };

    if (options.body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(options.body);
    }

    const response = await fetch('/api' + path, config);

    let data = null;
    try { data = await response.json(); } catch (e) { /* пустой ответ */ }

    if (!response.ok) {
      const error = new Error((data && data.error) || 'Ошибка запроса (' + response.status + ')');
      error.status = response.status;
      throw error;
    }

    return data;
  }

  window.api = {
    request,
    me: () => request('/auth/me'),
    register: data => request('/auth/register', { method: 'POST', body: data }),
    login: data => request('/auth/login', { method: 'POST', body: data }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    updateProfile: fullname => request('/account', { method: 'PATCH', body: { fullname } }),
    changePassword: (currentPassword, newPassword) =>
      request('/account/password', { method: 'POST', body: { currentPassword, newPassword } }),
    contact: data => request('/contact', { method: 'POST', body: data }),

    products: params => {
      const query = new URLSearchParams(params || {}).toString();
      return request('/products' + (query ? '?' + query : ''));
    },
    brands: () => request('/brands'),

    cart: () => request('/cart'),
    addToCart: (perfumeid, quantity) => request('/cart', { method: 'POST', body: { perfumeid, quantity: quantity || 1 } }),
    updateCart: (perfumeid, quantity) => request('/cart/' + perfumeid, { method: 'PATCH', body: { quantity } }),
    removeFromCart: perfumeid => request('/cart/' + perfumeid, { method: 'DELETE' }),
    mergeCart: items => request('/cart/merge', { method: 'POST', body: { items } }),

    orders: () => request('/orders'),
    createOrder: data => request('/orders', { method: 'POST', body: data })
  };
})();
