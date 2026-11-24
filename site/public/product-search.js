/* Фильтры каталога: поиск, бренд, категория, тип, цена и сортировка.
   Данные берутся из data-атрибутов карточек, которые синхронизируются с БД. */
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('product-search');
  const brand = document.getElementById('brand-filter');
  const gender = document.getElementById('gender-filter');
  const type = document.getElementById('type-filter');
  const priceMin = document.getElementById('price-min');
  const priceMax = document.getElementById('price-max');
  const sort = document.getElementById('sort-filter');
  const reset = document.getElementById('reset-catalog-filters');
  const count = document.getElementById('catalog-result-count');
  const empty = document.getElementById('catalog-no-results');
  const toggle = document.getElementById('toggle-catalog-filters');
  const filtersPanel = document.getElementById('catalog-filters');
  const activeBadge = document.getElementById('catalog-active-filters');
  const toggleLabel = toggle?.querySelector('.catalog-filter-label');
  const cards = [...document.querySelectorAll('.parfum[data-product-name]')];

  if (!search || !brand || !cards.length) return;

  function setFiltersOpen(open) {
    if (!toggle || !filtersPanel) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('is-open', open);
    filtersPanel.hidden = !open;
    if (toggleLabel) toggleLabel.textContent = open ? 'Свернуть фильтры' : 'Фильтры';
  }

  if (toggle && filtersPanel) {
    toggle.addEventListener('click', () => {
      setFiltersOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
  }

  document.querySelectorAll('[data-collapse-catalog-filters]').forEach(button => {
    button.addEventListener('click', () => setFiltersOpen(false));
  });

  const originalOrder = new Map();
  document.querySelectorAll('.parfums').forEach(group => {
    originalOrder.set(group, [...group.querySelectorAll('.parfum')]);
  });

  const toNumber = value => {
    const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
    const number = parseFloat(normalized);
    return Number.isFinite(number) ? number : null;
  };

  const priceOf = card => {
    const fromData = toNumber(card.dataset.price);
    if (fromData !== null) return fromData;
    return toNumber((card.querySelector('.price')?.textContent || '').replace(/[^\d,]/g, '')) || 0;
  };

  const nameOf = card => (card.dataset.productName || card.querySelector('h3')?.textContent || '').toLowerCase();
  const brandOf = card => card.dataset.brand || '';
  const genderOf = card => card.dataset.gender || '';
  const typeOf = card => card.dataset.type || '';

  const sorters = {
    'price-asc': (a, b) => priceOf(a) - priceOf(b),
    'price-desc': (a, b) => priceOf(b) - priceOf(a),
    'name': (a, b) => nameOf(a).localeCompare(nameOf(b), 'ru')
  };

  function applyFilters() {
    const query = search.value.trim().toLowerCase();
    const min = toNumber(priceMin.value);
    const max = toNumber(priceMax.value);
    let visible = 0;

    cards.forEach(card => {
      const price = priceOf(card);
      const matchesSearch = !query
        || nameOf(card).includes(query)
        || brandOf(card).toLowerCase().includes(query);
      const show = matchesSearch
        && (!brand.value || brandOf(card) === brand.value)
        && (!gender.value || genderOf(card) === gender.value)
        && (!type.value || typeOf(card) === type.value)
        && (min === null || price >= min)
        && (max === null || price <= max);

      card.hidden = !show;
      if (show) visible++;
    });

    if (sorters[sort.value]) {
      document.querySelectorAll('.parfums').forEach(group => {
        [...group.querySelectorAll('.parfum')]
          .sort(sorters[sort.value])
          .forEach(card => group.appendChild(card));
      });
    } else {
      originalOrder.forEach((items, group) => {
        items.forEach(card => group.appendChild(card));
      });
    }

    // Прячем заголовки категорий, в которых не осталось видимых товаров
    document.querySelectorAll('.container > h2').forEach(heading => {
      if (!['Унисекс', 'Женские', 'Мужские', 'Детские'].includes(heading.textContent.trim())) return;
      const group = heading.nextElementSibling;
      if (group && group.classList.contains('parfums')) {
        heading.hidden = ![...group.querySelectorAll('.parfum')].some(card => !card.hidden);
      }
    });

    const activeCount = [query, brand.value, gender.value, type.value, priceMin.value.trim(), priceMax.value.trim()]
      .filter(Boolean).length;
    if (activeBadge) {
      activeBadge.textContent = activeCount;
      activeBadge.hidden = activeCount === 0;
    }

    count.textContent = `Найдено товаров: ${visible}`;
    empty.hidden = visible !== 0;
  }

  [search, brand, gender, type, priceMin, priceMax, sort].forEach(element => {
    const eventName = element === search || element === priceMin || element === priceMax ? 'input' : 'change';
    element.addEventListener(eventName, applyFilters);
  });

  reset.addEventListener('click', () => {
    search.value = '';
    brand.value = '';
    gender.value = '';
    type.value = '';
    priceMin.value = '';
    priceMax.value = '';
    sort.value = 'default';
    applyFilters();
  });

  // Когда цены/характеристики подтянулись из API — пересчитываем фильтры
  document.addEventListener('catalog-updated', applyFilters);

  applyFilters();
});
