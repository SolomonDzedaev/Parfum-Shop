/* ======================= КОНФИГУРАЦИЯ ======================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzqppS0xEi2hpqyB4D_BWHAmCOk84cweZireeeGxEzSf9elEDGhuCG1z_KNq8uRkpLZWA/exec', // ← вставь URL веб-приложения
  CACHE_KEY: 'parfum_products_cache',
  CART_KEY: 'parfum_cart',
  USER_KEY: 'parfum_user_info',
};

let PRODUCTS = [];
let CART = loadCart();

/* ======================= ЗАГРУЗКА ТОВАРОВ (с кэшем в localStorage) ======================= */
async function loadProducts() {
  const statusEl = document.getElementById('statusMsg');
  const cached = getCachedProducts();

  if (cached) {
    PRODUCTS = cached;
    renderProducts();
  } else {
    statusEl.textContent = 'Загрузка каталога...';
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
      ? 'Показаны данные из кэша (нет связи с сервером).'
      : 'Не удалось загрузить каталог. Проверьте подключение к интернету.';
  }
}

function normalizeProducts(data) {
  return data.map(p => ({
    id: String(p.id),
    name: p.name,
    brand: p.brand,
    price: Number(p.price),
    volume: p.volume,
    image: p.image,
    notes: Array.isArray(p.notes)
      ? p.notes
      : String(p.notes || '').split(',').map(s => s.trim()).filter(Boolean),
  }));
}

function cacheProducts(products) {
  localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify({ ts: Date.now(), data: products }));
}

function getCachedProducts() {
  const raw = localStorage.getItem(CONFIG.CACHE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw).data; } catch { return null; }
}

/* ======================= РЕНДЕР КАТАЛОГА ======================= */
function renderProducts() {
  const grid = document.getElementById('productGrid');
  const tpl = document.getElementById('productCardTpl');
  grid.innerHTML = '';

  if (!PRODUCTS.length) {
    grid.innerHTML = '<p>Товары не найдены.</p>';
    return;
  }

  PRODUCTS.forEach(product => {
    const node = tpl.content.cloneNode(true);
    const img = node.querySelector('.product-card__img');
    img.src = product.image;
    img.alt = product.name;
    node.querySelector('.product-card__brand').textContent = product.brand;
    node.querySelector('.product-card__name').textContent = product.name;
    node.querySelector('.product-card__notes').textContent = product.notes.join(' • ');
    node.querySelector('.product-card__price').textContent = product.price.toLocaleString('ru-RU') + ' ₽';
    node.querySelector('.product-card__volume').textContent = product.volume;
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
  setTimeout(() => btn.classList.remove('cart-btn--flash'), 300);
}

/* ======================= РЕНДЕР КОРЗИНЫ ======================= */
function renderCart() {
  const container = document.getElementById('cartItems');
  const items = getCartItemsDetailed();
  container.innerHTML = '';

  if (!items.length) {
    container.innerHTML = '<p>Корзина пуста.</p>';
    document.getElementById('checkoutBtn').disabled = true;
  } else {
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${item.image}" alt="${item.name}" class="cart-item__img">
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

/* ======================= ДАННЫЕ ПОЛЬЗОВАТЕЛЯ (localStorage, автозаполнение формы) ======================= */
function loadUserInfo() {
  const raw = localStorage.getItem(CONFIG.USER_KEY);
  return raw ? JSON.parse(raw) : {};
}
function saveUserInfo(name, phone) {
  localStorage.setItem(CONFIG.USER_KEY, JSON.stringify({ name, phone }));
}

/* ======================= ОТПРАВКА ЗАЯВКИ ПОСТАВЩИКУ ======================= */
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
    alert('Заполните ФИО, телефон и убедитесь, что в корзине есть товары.');
    return;
  }

  const submitBtn = document.getElementById('orderSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Отправка...';

  try {
    const res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // избегаем CORS preflight для Apps Script
      body: JSON.stringify({ name, phone, comment, items, total, date: new Date().toISOString() }),
    });
    const result = await res.json();
    if (result.status === 'ok') {
      saveUserInfo(name, phone);
      alert('Спасибо! Заявка отправлена поставщику. С вами свяжутся в ближайшее время.');
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
    alert('Не удалось отправить заявку. Попробуйте ещё раз.');
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