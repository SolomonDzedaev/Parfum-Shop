/* ======================= КОНФИГУРАЦИЯ ======================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzqppS0xEi2hpqyB4D_BWHAmCOk84cweZireeeGxEzSf9elEDGhuCG1z_KNq8uRkpLZWA/exec',
  CACHE_KEY: 'parfum_products_cache',
  CART_KEY: 'parfum_cart',
  USER_KEY: 'parfum_user_info',
};

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <rect width="100%" height="100%" fill="#eee4d2"/>
    <text x="50%" y="48%" font-size="42" text-anchor="middle" fill="#c9a04e" font-family="sans-serif">🧴</text>
    <text x="50%" y="62%" font-size="14" text-anchor="middle" fill="#a6803a" font-family="sans-serif">Нет фото</text>
  </svg>`);

let PRODUCTS = [];
let CART = loadCart();

/* ======================= ЗАГРУЗКА ТОВАРОВ ======================= */
async function loadProducts() {
  renderSkeletons(6);
  const statusEl = document.getElementById('statusMsg');
  const cached = getCachedProducts();

  if (cached) {
    PRODUCTS = cached;
    renderProducts();
  }

  try {
    const res = await fetch(CONFIG.API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    PRODUCTS = normalizeProducts(data);
    cacheProducts(PRODUCTS);
    renderProducts();
    statusEl.textContent = '';
  } catch (err) {
    console.warn('Не удалось получить свежие данные:', err);
    statusEl.textContent = cached
      ? 'Показаны сохранённые данные (нет связи с сервером).'
      : 'Не удалось загрузить каталог. Проверьте подключение к интернету.';
    if (!cached) renderProducts(); // покажет "товары не найдены"
  }
}

/* Регистронезависимое чтение поля из объекта (защита от разного регистра заголовков) */
function ci(obj, key) {
  const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
  return found !== undefined ? obj[found] : undefined;
}

function normalizeProducts(data) {
  return data.map(p => {
    const notesRaw = ci(p, 'notes');
    return {
      id: String(ci(p, 'id') ?? ''),
      name: ci(p, 'name') || 'Без названия',
      brand: ci(p, 'brand') || '',
      price: Number(ci(p, 'price')) || 0,
      volume: ci(p, 'volume') || '',
      image: ci(p, 'image') || PLACEHOLDER_IMG,
      notes: Array.isArray(notesRaw)
        ? notesRaw
        : String(notesRaw || '').split(',').map(s => s.trim()).filter(Boolean),
    };
  });
}

/* ======================= КЭШ ======================= */
function cacheProducts(products) {
  localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ ts: Date.now(), data: products }));
}
function getCachedProducts() {
  const raw = localStorage.getItem(CONFIG.CACHE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw).data; } catch { return null; }
}

/* ======================= СКЕЛЕТОНЫ ======================= */
function renderSkeletons(count) {
  const grid = document.getElementById('productGrid');
  const tpl = document.getElementById('skeletonTpl');
  if (PRODUCTS.length) return; // если уже есть кэш — не мигаем скелетонами
  grid.innerHTML = '';
  for (let i = 0; i < count; i++) {
    grid.appendChild(tpl.content.cloneNode(true));
  }
}

/* ======================= РЕНДЕР КАТАЛОГА ======================= */
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const tpl = document.getElementById('productCardTpl');
  grid.innerHTML = '';

  if (!PRODUCTS.length) {
    grid.innerHTML = '<p style="text-align:center;color:#999;grid-column:1/-1;">Товары не найдены.</p>';
    return;
  }

  PRODUCTS.forEach(product => {
    const node = tpl.content.cloneNode(true);
    const img = node.querySelector('.product-card__img');
    img.src = product.image || PLACEHOLDER_IMG;
    img.alt = product.name;
    img.onerror = () => { img.onerror = null; img.src = PLACEHOLDER_IMG; };

    node.querySelector('.product-card__volume-badge').textContent = product.volume || '—';
    node.querySelector('.product-card__brand').textContent = product.brand;
    node.querySelector('.product-card__name').textContent = product.name;

    const notesEl = node.querySelector('.product-card__notes');
    notesEl.innerHTML = product.notes.map(n => `<span>${n}</span>`).join('');

    node.querySelector('.product-card__price').textContent =
      product.price ? product.price.toLocaleString('ru-RU') + ' ₽' : 'Цена по запросу';

    node.querySelector('.btn-add').addEventListener('click', () => addToCart(product.id));
    grid.appendChild(node);
  });
}

/* ======================= КОРЗИНА (localStorage) ======================= */
function loadCart() {
  const raw = localStorage.getItem(CONFIG.CART_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
function saveCart() {
  localStorage.setItem(CONFIG.CART_KEY, JSON.stringify(CART));
  updateCartCount();
}
function addToCart(id) {
  CART[id] = (CART[id] || 0) + 1;
  saveCart();
  renderCart();
  flashCartBtn();
  showToast('Добавлено в корзину');
}
function removeFromCart(id) {
  delete CART[id];
  saveCart();
  renderCart();
}
function changeQty(id, delta) {
  if (!CART[id]) return;
  CART[id] += delta;
  if (CART[id] <= 0) delete CART[id];
  saveCart();
  renderCart();
}
function getCartItemsDetailed() {
  return Object.entries(CART)
    .map(([id, qty]) => {
      const product = PRODUCTS.find(p => p.id === id);
      return product ? { ...product, qty } : null;
    })
    .filter(Boolean);
}
function getCartTotal() {
  return getCartItemsDetailed().reduce((sum, i) => sum + i.price * i.qty, 0);
}
function updateCartCount() {
  const count = Object.values(CART).reduce((a, b) => a + b, 0);
  document.getElementById('cartCount').textContent = count;
}
function flashCartBtn() {
  const btn = document.getElementById('cartBtn');
  btn.classList.add('cart-btn--flash');
  setTimeout(() => btn.classList.remove('cart-btn--flash'), 250);
}

/* ======================= РЕНДЕР КОРЗИНЫ ======================= */
function renderCart() {
  const container = document.getElementById('cartItems');
  const items = getCartItemsDetailed();
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = '<p style="color:#999;">Корзина пуста.</p>';
    document.getElementById('checkoutBtn').disabled = true;
  } else {
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="cart-item__img" onerror="this.src='${PLACEHOLDER_IMG}'">
        <div class="cart-item__info">
          <div>${item.brand} — ${item.name}</div>
          <div>${item.volume} · ${item.price.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div class="cart-item__qty">
          <button data-action="dec">−</button>
          <span>${item.qty}</span>
          <button data-action="inc">+</button>
        </div>
        <button class="cart-item__remove" title="Удалить">🗑</button>`;
      row.querySelector('[data-action="dec"]').onclick = () => changeQty(item.id, -1);
      row.querySelector('[data-action="inc"]').onclick = () => changeQty(item.id, 1);
      row.querySelector('.cart-item__remove').onclick = () => removeFromCart(item.id);
      container.appendChild(row);
    });
    document.getElementById('checkoutBtn').disabled = false;
  }

  document.getElementById('cartTotal').textContent = getCartTotal().toLocaleString('ru-RU');
  updateCartCount();
}

/* ======================= ТОСТ-УВЕДОМЛЕНИЯ ======================= */
let toastTimer;
function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.toggle('toast--error', isError);
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2800);
}

/* ======================= МОДАЛКИ ======================= */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close]').forEach(btn =>
  btn.addEventListener('click', () => closeModal(btn.dataset.close))
);

document.getElementById('cartBtn').addEventListener('click', () => {
  renderCart();
  openModal('cartModal');
});

document.getElementById('checkoutBtn').addEventListener('click', () => {
  const info = loadUserInfo();
  document.getElementById('orderName').value = info.name || '';
  document.getElementById('orderPhone').value = info.phone || '';
  renderOrderSummary();
  closeModal('cartModal');
  openModal('orderModal');
});

function renderOrderSummary() {
  const items = getCartItemsDetailed();
  const summary = document.getElementById('orderSummary');
  summary.innerHTML = '<h4>Ваш заказ:</h4>' +
    items.map(i => `<div>${i.brand} ${i.name} (${i.volume}) × ${i.qty} = ${(i.price * i.qty).toLocaleString('ru-RU')} ₽</div>`).join('') +
    `<div class="order-summary__total">Итого: ${getCartTotal().toLocaleString('ru-RU')} ₽</div>`;
}

/* ======================= ДАННЫЕ ПОЛЬЗОВАТЕЛЯ ======================= */
function loadUserInfo() {
  const raw = localStorage.getItem(CONFIG.USER_KEY);
  return raw ? JSON.parse(raw) : {};
}
function saveUserInfo(name, phone) {
  localStorage.setItem(CONFIG.USER_KEY, JSON.stringify({ name, phone }));
}

/* ======================= ОТПРАВКА ЗАЯВКИ ======================= */
document.getElementById('orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('orderName').value.trim();
  const phone = document.getElementById('orderPhone').value.trim();
  const comment = document.getElementById('orderComment').value.trim();
  const items = getCartItemsDetailed().map(i => ({
    id: i.id, name: i.name, brand: i.brand, volume: i.volume, price: i.price, qty: i.qty
  }));
  const total = getCartTotal();

  if (!name || !phone || !items.length) {
    showToast('Заполните ФИО, телефон — корзина не должна быть пустой', true);
    return;
  }

  const submitBtn = document.getElementById('orderSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправка...';

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ name, phone, comment, items, total, date: new Date().toISOString() }),
    });
    const result = await res.json();
    if (result.status === 'ok') {
      saveUserInfo(name, phone);
      showToast('Заявка отправлена! Мы свяжемся с вами в ближайшее время.');
      CART = {};
      saveCart();
      renderCart();
      document.getElementById('orderForm').reset();
      closeModal('orderModal');
    } else {
      throw new Error(result.message || 'Неизвестная ошибка');
    }
  } catch (err) {
    console.error(err);
    showToast('Не удалось отправить заявку. Попробуйте ещё раз.', true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Отправить заявку';
  }
});

/* ======================= ИНИЦИАЛИЗАЦИЯ ======================= */
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  renderCart();
});