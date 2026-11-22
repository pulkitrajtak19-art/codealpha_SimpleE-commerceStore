const API_BASE = '/api';
const FREE_SHIPPING_THRESHOLD = 15000;
const SHIPPING_FEE = 499;
const GST_RATE = 0.18;

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const state = {
  products: [],
  activeCategory: 'All',
  search: '',
  sort: 'featured',
  view: 'shop',
  selectedProduct: null,
  detailQty: 1,
  cart: loadLocal('ma_cart', []),
  promoCode: loadLocal('ma_promo', ''),
  token: loadLocal('ma_token', null),
  user: loadLocal('ma_user', null),
  orders: [],
  lastOrder: null,
  authMode: 'login'
};

function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_err) {
    return fallback;
  }
}

function saveLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (_err) {
    // Ignore storage errors
  }
}

function money(val) {
  return inrFormatter.format(Math.round(Number(val || 0)));
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message) {
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

async function fetchProducts() {
  const params = new URLSearchParams();
  if (state.activeCategory !== 'All') params.set('category', state.activeCategory);
  if (state.search.trim()) params.set('search', state.search.trim());
  if (state.sort) params.set('sort', state.sort);

  const data = await apiRequest(`/products?${params.toString()}`);
  state.products = data.products || [];
  renderProductGrid();
}

async function fetchOrders() {
  if (!state.token) {
    state.orders = [];
    updateHeader();
    return;
  }
  try {
    const data = await apiRequest('/orders');
    state.orders = data.orders || [];
  } catch (_err) {
    state.orders = [];
  }
  updateHeader();
}

function getCartTotals() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = state.promoCode === 'PRIVILEGE10' ? Math.round(subtotal * 0.1) : 0;
  const net = Math.max(0, subtotal - discount);
  const shipping = net === 0 || net >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const tax = Math.round(net * GST_RATE);
  const total = net + shipping + tax;
  const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  return { subtotal, discount, shipping, tax, total, count };
}

function addToCart(product, qty = 1) {
  const existing = state.cart.find((c) => c.productId === product.id);
  const nextQty = (existing ? existing.quantity : 0) + qty;
  if (nextQty > product.stock) {
    showToast(`Only ${product.stock} pieces remaining.`);
    return;
  }
  if (existing) {
    existing.quantity = nextQty;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.stock,
      quantity: qty
    });
  }
  saveLocal('ma_cart', state.cart);
  updateHeader();
  renderCartDrawer();
  showToast(`Added ${product.name} to your bag.`);
}

function updateCartQty(productId, delta) {
  const item = state.cart.find((c) => c.productId === productId);
  if (!item) return;
  const next = item.quantity + delta;
  if (next <= 0) {
    state.cart = state.cart.filter((c) => c.productId !== productId);
  } else if (next <= item.stock) {
    item.quantity = next;
  } else {
    showToast(`Maximum stock (${item.stock}) reached.`);
  }
  saveLocal('ma_cart', state.cart);
  updateHeader();
  renderCartDrawer();
  if (state.view === 'checkout') renderCheckoutView();
}

function setView(viewName) {
  state.view = viewName;
  ['shopView', 'detailView', 'checkoutView', 'confirmationView', 'ordersView'].forEach((id) => {
    document.getElementById(id).classList.toggle('hidden', id !== `${viewName}View`);
  });
  document.getElementById('navShopBtn').classList.toggle('active', viewName === 'shop' || viewName === 'detail');
  document.getElementById('navOrdersBtn').classList.toggle('active', viewName === 'orders');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateHeader() {
  const { count } = getCartTotals();
  document.getElementById('cartCountBadge').textContent = String(count);

  const authBtn = document.getElementById('navAuthBtn');
  const userPill = document.getElementById('userPill');
  const ordersBadge = document.getElementById('ordersCountBadge');

  if (state.user) {
    authBtn.classList.add('hidden');
    userPill.classList.remove('hidden');
    document.getElementById('userNameLabel').textContent = state.user.fullName.split(' ')[0];
    document.getElementById('userAvatar').textContent = state.user.fullName.charAt(0).toUpperCase();
    ordersBadge.textContent = String(state.orders.length);
    ordersBadge.classList.toggle('hidden', state.orders.length === 0);
  } else {
    authBtn.classList.remove('hidden');
    userPill.classList.add('hidden');
    ordersBadge.classList.add('hidden');
  }
}

function renderCategories() {
  const categories = ['All', 'Timepieces', 'Audio', 'Workspace', 'Carry', 'Home'];
  const container = document.getElementById('categoryPills');
  container.innerHTML = categories
    .map(
      (cat) => `
      <button type="button" class="pill ${state.activeCategory === cat ? 'active' : ''}" data-category="${cat}">
        ${cat}
      </button>`
    )
    .join('');

  container.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.category;
      renderCategories();
      fetchProducts();
    });
  });
}

function renderProductGrid() {
  const grid = document.getElementById('productGrid');
  if (!state.products.length) {
    grid.innerHTML = '<div class="empty-state">No pieces match your search or category filter.</div>';
    return;
  }

  grid.innerHTML = state.products
    .map(
      (p) => `
      <article class="product-card">
        <div class="product-thumb" data-open-product="${p.id}">
          <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" />
          <span class="category-tag">${escapeHtml(p.category)}</span>
        </div>
        <div class="product-body">
          <div class="product-meta">
            <span>&#9733; ${p.rating.toFixed(1)} (${p.reviewsCount})</span>
            <span>${p.stock > 0 ? `${p.stock} remaining` : 'Sold out'}</span>
          </div>
          <h3 class="product-title" data-open-product="${p.id}">${escapeHtml(p.name)}</h3>
          <p class="product-desc">${escapeHtml(p.shortDescription)}</p>
          <div class="product-footer">
            <span class="price">${money(p.price)}</span>
            <div class="card-actions">
              <button type="button" class="btn btn-outline" data-open-product="${p.id}">View</button>
              <button type="button" class="btn btn-dark" data-add-cart="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>Add</button>
            </div>
          </div>
        </div>
      </article>`
    )
    .join('');

  grid.querySelectorAll('[data-open-product]').forEach((el) => {
    el.addEventListener('click', () => openProductDetail(Number(el.dataset.openProduct)));
  });

  grid.querySelectorAll('[data-add-cart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = state.products.find((p) => p.id === Number(btn.dataset.addCart));
      if (product) addToCart(product, 1);
    });
  });
}

async function openProductDetail(productId) {
  try {
    const data = await apiRequest(`/products/${productId}`);
    state.selectedProduct = data.product;
    state.detailQty = 1;
    renderProductDetail();
    setView('detail');
  } catch (err) {
    showToast(err.message);
  }
}

function renderProductDetail() {
  const p = state.selectedProduct;
  if (!p) return;
  const el = document.getElementById('detailView');
  el.innerHTML = `
    <button type="button" class="back-btn" id="backToShopBtn">&larr; Return to Collection</button>
    <div class="detail-grid">
      <div class="detail-img-wrap">
        <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" />
      </div>
      <div class="detail-info">
        <span class="stock-pill">${p.stock > 0 ? `In Stock (${p.stock} pieces)` : 'Sold Out'}</span>
        <h1>${escapeHtml(p.name)}</h1>
        <p style="color:var(--muted); margin-bottom:14px;">${escapeHtml(p.category)} &middot; &#9733; ${p.rating.toFixed(1)} (${p.reviewsCount} reviews)</p>
        <div class="price" style="font-size:1.75rem; margin-bottom:14px;">${money(p.price)}</div>
        <p style="color:var(--muted);">${escapeHtml(p.description)}</p>
        <ul class="specs-list">
          ${p.specs.map((s) => `<li>&#10003; ${escapeHtml(s)}</li>`).join('')}
        </ul>
        <div class="qty-row">
          <div class="stepper">
            <button type="button" id="detailQtyMinus">&minus;</button>
            <span id="detailQtyVal">${state.detailQty}</span>
            <button type="button" id="detailQtyPlus">+</button>
          </div>
          <button type="button" class="btn btn-dark" id="detailAddBtn" ${p.stock <= 0 ? 'disabled' : ''}>Add to Bag</button>
          <button type="button" class="btn btn-primary" id="detailBuyBtn" ${p.stock <= 0 ? 'disabled' : ''}>Acquire Now</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('backToShopBtn').addEventListener('click', () => setView('shop'));
  document.getElementById('detailQtyMinus').addEventListener('click', () => {
    if (state.detailQty > 1) {
      state.detailQty -= 1;
      document.getElementById('detailQtyVal').textContent = String(state.detailQty);
    }
  });
  document.getElementById('detailQtyPlus').addEventListener('click', () => {
    if (state.detailQty < p.stock) {
      state.detailQty += 1;
      document.getElementById('detailQtyVal').textContent = String(state.detailQty);
    }
  });
  document.getElementById('detailAddBtn').addEventListener('click', () => addToCart(p, state.detailQty));
  document.getElementById('detailBuyBtn').addEventListener('click', () => {
    addToCart(p, state.detailQty);
    openCheckout();
  });
}

function toggleCart(open) {
  document.getElementById('cartBackdrop').classList.toggle('hidden', !open);
  document.getElementById('cartDrawer').classList.toggle('hidden', !open);
  if (open) renderCartDrawer();
}

function renderCartDrawer() {
  const { subtotal, discount, shipping, tax, total } = getCartTotals();
  const net = Math.max(0, subtotal - discount);
  const bar = document.getElementById('shippingBar');
  if (net === 0) {
    bar.textContent = `Complimentary insured delivery above ${money(FREE_SHIPPING_THRESHOLD)}.`;
  } else if (net >= FREE_SHIPPING_THRESHOLD) {
    bar.textContent = 'Complimentary insured white-glove delivery unlocked!';
  } else {
    bar.textContent = `Add ${money(FREE_SHIPPING_THRESHOLD - net)} more for complimentary delivery.`;
  }

  const container = document.getElementById('cartItemsContainer');
  const footer = document.getElementById('cartFooter');

  if (!state.cart.length) {
    container.innerHTML = '<div class="empty-state">Your shopping bag is empty.</div>';
    footer.innerHTML = '<button type="button" class="btn btn-outline btn-full" id="continueShoppingBtn">Explore Collection</button>';
    document.getElementById('continueShoppingBtn').addEventListener('click', () => toggleCart(false));
    return;
  }

  container.innerHTML = state.cart
    .map(
      (item) => `
      <div class="cart-item">
        <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" />
        <div class="cart-item-info">
          <div class="cart-item-title">${escapeHtml(item.name)}</div>
          <div style="font-size:0.82rem; color:var(--muted);">${money(item.price)} each</div>
          <div class="cart-item-controls">
            <div class="stepper">
              <button type="button" data-cart-dec="${item.productId}">&minus;</button>
              <span>${item.quantity}</span>
              <button type="button" data-cart-inc="${item.productId}">+</button>
            </div>
            <strong>${money(item.price * item.quantity)}</strong>
          </div>
        </div>
      </div>`
    )
    .join('');

  container.querySelectorAll('[data-cart-dec]').forEach((b) =>
    b.addEventListener('click', () => updateCartQty(Number(b.dataset.cartDec), -1))
  );
  container.querySelectorAll('[data-cart-inc]').forEach((b) =>
    b.addEventListener('click', () => updateCartQty(Number(b.dataset.cartInc), 1))
  );

  footer.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <input type="text" id="promoInput" class="input" style="flex:1;" value="${escapeHtml(state.promoCode)}" placeholder="Code: PRIVILEGE10" />
      <button type="button" class="btn btn-dark" id="applyPromoBtn">Apply</button>
    </div>
    <div class="summary-line"><span>Subtotal</span><span>${money(subtotal)}</span></div>
    ${discount > 0 ? `<div class="summary-line" style="color:var(--success);"><span>Privilege (10%)</span><span>&minus;${money(discount)}</span></div>` : ''}
    <div class="summary-line"><span>Insured Delivery</span><span>${shipping === 0 ? 'Complimentary' : money(shipping)}</span></div>
    <div class="summary-line"><span>Estimated GST (18%)</span><span>${money(tax)}</span></div>
    <div class="summary-total"><span>Total (INR)</span><span>${money(total)}</span></div>
    <button type="button" class="btn btn-dark btn-full" id="goCheckoutBtn">Proceed to Checkout</button>
  `;

  document.getElementById('applyPromoBtn').addEventListener('click', () => {
    const code = document.getElementById('promoInput').value.trim().toUpperCase();
    if (code === 'PRIVILEGE10') {
      state.promoCode = code;
      saveLocal('ma_promo', code);
      showToast('Code PRIVILEGE10 applied (10% off).');
      renderCartDrawer();
    } else if (!code) {
      state.promoCode = '';
      saveLocal('ma_promo', '');
      renderCartDrawer();
    } else {
      showToast('Invalid code. Try PRIVILEGE10.');
    }
  });

  document.getElementById('goCheckoutBtn').addEventListener('click', () => {
    toggleCart(false);
    openCheckout();
  });
}

function openCheckout() {
  if (!state.cart.length) {
    showToast('Add a piece to your bag first.');
    return;
  }
  renderCheckoutView();
  setView('checkout');
}

function renderCheckoutView() {
  const { subtotal, discount, shipping, tax, total } = getCartTotals();
  const el = document.getElementById('checkoutView');

  if (!state.user) {
    el.innerHTML = `
      <div class="panel" style="max-width:520px; margin:0 auto; text-align:center;">
        <h2>Sign in to complete your acquisition</h2>
        <p style="color:var(--muted); margin-bottom:20px;">Create an account or sign in so your receipt and warranty are saved to your profile.</p>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button type="button" class="btn btn-dark" id="checkoutLoginBtn">Sign In / Register</button>
          <button type="button" class="btn btn-outline" id="checkoutBackBtn">Collection</button>
        </div>
      </div>
    `;
    document.getElementById('checkoutLoginBtn').addEventListener('click', () => openAuthModal('login'));
    document.getElementById('checkoutBackBtn').addEventListener('click', () => setView('shop'));
    return;
  }

  el.innerHTML = `
    <button type="button" class="back-btn" id="checkoutBackShop">&larr; Return to Collection</button>
    <div class="checkout-grid">
      <form class="panel" id="checkoutForm">
        <h2>Delivery &amp; Payment</h2>
        <div class="form-grid">
          <div class="field full">
            <label for="shipName">Recipient Name</label>
            <input type="text" id="shipName" class="input" value="${escapeHtml(state.user.fullName)}" required />
          </div>
          <div class="field full">
            <label for="shipEmail">Email</label>
            <input type="email" id="shipEmail" class="input" value="${escapeHtml(state.user.email)}" required />
          </div>
          <div class="field full">
            <label for="shipAddress">Street Address</label>
            <input type="text" id="shipAddress" class="input" placeholder="14 Altamount Road" required />
          </div>
          <div class="field">
            <label for="shipCity">City</label>
            <input type="text" id="shipCity" class="input" placeholder="Mumbai" required />
          </div>
          <div class="field">
            <label for="shipPostal">PIN Code</label>
            <input type="text" id="shipPostal" class="input" placeholder="400026" required />
          </div>
          <div class="field full">
            <label for="payMethod">Payment Method</label>
            <select id="payMethod" class="select">
              <option value="UPI (GPay / PhonePe / Paytm)">UPI (GPay / PhonePe / Paytm)</option>
              <option value="Credit / Debit Card">Credit / Debit Card</option>
              <option value="Net Banking">Net Banking</option>
              <option value="Cash on Delivery">Cash on Delivery</option>
            </select>
          </div>
        </div>
        <p class="form-error hidden" id="checkoutError"></p>
        <button type="submit" class="btn btn-dark btn-full">Complete Order &middot; ${money(total)}</button>
      </form>

      <div class="panel">
        <h2>Acquisition Summary</h2>
        ${state.cart
          .map(
            (i) => `
          <div class="summary-line" style="margin-bottom:10px;">
            <span>${escapeHtml(i.name)} &times; ${i.quantity}</span>
            <strong>${money(i.price * i.quantity)}</strong>
          </div>`
          )
          .join('')}
        <div class="summary-line" style="margin-top:14px;"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        ${discount > 0 ? `<div class="summary-line" style="color:var(--success);"><span>Privilege (10%)</span><span>&minus;${money(discount)}</span></div>` : ''}
        <div class="summary-line"><span>Insured Delivery</span><span>${shipping === 0 ? 'Complimentary' : money(shipping)}</span></div>
        <div class="summary-line"><span>GST (18%)</span><span>${money(tax)}</span></div>
        <div class="summary-total"><span>Total (INR)</span><span>${money(total)}</span></div>
      </div>
    </div>
  `;

  document.getElementById('checkoutBackShop').addEventListener('click', () => setView('shop'));
  document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('checkoutError');
    errEl.classList.add('hidden');
    try {
      const payload = {
        items: state.cart.map((c) => ({ productId: c.productId, quantity: c.quantity })),
        promoCode: state.promoCode,
        shipping: {
          name: document.getElementById('shipName').value.trim(),
          email: document.getElementById('shipEmail').value.trim(),
          address: document.getElementById('shipAddress').value.trim(),
          city: document.getElementById('shipCity').value.trim(),
          postal: document.getElementById('shipPostal').value.trim()
        },
        paymentMethod: document.getElementById('payMethod').value
      };

      const data = await apiRequest('/orders', { method: 'POST', body: JSON.stringify(payload) });
      state.lastOrder = data.order;
      state.cart = [];
      state.promoCode = '';
      saveLocal('ma_cart', []);
      saveLocal('ma_promo', '');
      await Promise.all([fetchProducts(), fetchOrders()]);
      updateHeader();
      renderConfirmationView();
      setView('confirmation');
      showToast(`Order ${data.order.orderNumber} confirmed.`);
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

function renderConfirmationView() {
  const o = state.lastOrder;
  if (!o) return;
  const el = document.getElementById('confirmationView');
  el.innerHTML = `
    <div class="panel" style="max-width:620px; margin:0 auto;">
      <span class="stock-pill">Acquisition Confirmed</span>
      <h1 style="font-family:'Cormorant Garamond',Georgia,serif; font-size:2.2rem; margin:12px 0 6px;">Thank you, ${escapeHtml(o.shipping.name)}.</h1>
      <p style="color:var(--muted); margin-bottom:20px;">Order <strong>${escapeHtml(o.orderNumber)}</strong> has been recorded and inventory updated.</p>
      ${o.items
        .map(
          (i) => `
        <div class="summary-line">
          <span>${escapeHtml(i.productName)} &times; ${i.quantity}</span>
          <span>${money(i.lineTotal)}</span>
        </div>`
        )
        .join('')}
      <div class="summary-total"><span>Total Paid (${escapeHtml(o.paymentMethod)})</span><span>${money(o.total)}</span></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
        <button type="button" class="btn btn-dark" id="confOrdersBtn">Order History</button>
        <button type="button" class="btn btn-outline" id="confShopBtn">Continue Browsing</button>
      </div>
    </div>
  `;
  document.getElementById('confOrdersBtn').addEventListener('click', openOrdersView);
  document.getElementById('confShopBtn').addEventListener('click', () => setView('shop'));
}

async function openOrdersView() {
  await fetchOrders();
  const el = document.getElementById('ordersView');
  if (!state.user) {
    el.innerHTML = `
      <div class="panel empty-state">
        <h2>Sign in to view your orders</h2>
        <p style="margin:8px 0 18px;">Your saved order history appears here once you sign in.</p>
        <button type="button" class="btn btn-dark" id="ordersSignInBtn">Sign In</button>
      </div>
    `;
    document.getElementById('ordersSignInBtn').addEventListener('click', () => openAuthModal('login'));
  } else if (!state.orders.length) {
    el.innerHTML = `
      <div class="panel empty-state">
        <h2>No acquisitions yet</h2>
        <p style="margin:8px 0 18px;">Once you place an order, you can review invoices and status here.</p>
        <button type="button" class="btn btn-dark" id="ordersShopBtn">Explore Collection</button>
      </div>
    `;
    document.getElementById('ordersShopBtn').addEventListener('click', () => setView('shop'));
  } else {
    el.innerHTML = `
      <h1 style="font-family:'Cormorant Garamond',Georgia,serif; font-size:2.4rem; margin-bottom:18px;">Order History</h1>
      ${state.orders
        .map(
          (o) => `
        <div class="order-card">
          <div class="order-head">
            <div>
              <strong>${escapeHtml(o.orderNumber)}</strong>
              <div style="font-size:0.82rem; color:var(--muted);">${new Date(o.createdAt).toLocaleString('en-IN')}</div>
            </div>
            <div style="text-align:right;">
              <span class="stock-pill">${escapeHtml(o.status)}</span>
              <div style="font-weight:700; margin-top:6px;">${money(o.total)}</div>
            </div>
          </div>
          ${o.items
            .map(
              (i) => `
            <div class="summary-line">
              <span>${escapeHtml(i.productName)} &times; ${i.quantity}</span>
              <span>${money(i.lineTotal)}</span>
            </div>`
            )
            .join('')}
          <div style="font-size:0.82rem; color:var(--muted); margin-top:10px;">
            Dispatch to: ${escapeHtml(o.shipping.name)}, ${escapeHtml(o.shipping.address)}, ${escapeHtml(o.shipping.city)} &ndash; ${escapeHtml(o.shipping.postal)}
          </div>
        </div>`
        )
        .join('')}
    `;
  }
  setView('orders');
}

function openAuthModal(mode = 'login') {
  state.authMode = mode;
  document.getElementById('authBackdrop').classList.remove('hidden');
  updateAuthModalMode();
}

function closeAuthModal() {
  document.getElementById('authBackdrop').classList.add('hidden');
  document.getElementById('authError').classList.add('hidden');
}

function updateAuthModalMode() {
  const isReg = state.authMode === 'register';
  document.getElementById('authModalTitle').textContent = isReg ? 'Join Maison Aether' : 'Private Client Access';
  document.getElementById('tabLogin').classList.toggle('active', !isReg);
  document.getElementById('tabRegister').classList.toggle('active', isReg);
  document.getElementById('fullNameField').classList.toggle('hidden', !isReg);
  document.getElementById('authFullName').required = isReg;
  document.getElementById('authSubmitBtn').textContent = isReg ? 'Create Account' : 'Sign In';
  document.getElementById('authError').classList.add('hidden');
}

function bindGlobalEvents() {
  document.getElementById('brandBtn').addEventListener('click', () => setView('shop'));
  document.getElementById('navShopBtn').addEventListener('click', () => setView('shop'));
  document.getElementById('navOrdersBtn').addEventListener('click', openOrdersView);
  document.getElementById('navAuthBtn').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('openCartBtn').addEventListener('click', () => toggleCart(true));
  document.getElementById('closeCartBtn').addEventListener('click', () => toggleCart(false));
  document.getElementById('cartBackdrop').addEventListener('click', () => toggleCart(false));
  document.getElementById('closeAuthBtn').addEventListener('click', closeAuthModal);
  document.getElementById('tabLogin').addEventListener('click', () => {
    state.authMode = 'login';
    updateAuthModalMode();
  });
  document.getElementById('tabRegister').addEventListener('click', () => {
    state.authMode = 'register';
    updateAuthModalMode();
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    state.user = null;
    state.token = null;
    state.orders = [];
    saveLocal('ma_user', null);
    saveLocal('ma_token', null);
    updateHeader();
    showToast('Signed out.');
    if (state.view === 'orders' || state.view === 'checkout') setView('shop');
  });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    fetchProducts();
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    fetchProducts();
  });

  document.getElementById('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('authError');
    errEl.classList.add('hidden');

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const fullName = document.getElementById('authFullName').value.trim();

    try {
      const endpoint = state.authMode === 'register' ? '/auth/register' : '/auth/login';
      const body = state.authMode === 'register' ? { fullName, email, password } : { email, password };
      const data = await apiRequest(endpoint, { method: 'POST', body: JSON.stringify(body) });

      state.token = data.token;
      state.user = data.user;
      saveLocal('ma_token', data.token);
      saveLocal('ma_user', data.user);
      closeAuthModal();
      await fetchOrders();
      updateHeader();
      showToast(`Welcome, ${data.user.fullName}.`);
      if (state.view === 'checkout') renderCheckoutView();
      if (state.view === 'orders') openOrdersView();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
    }
  });
}

async function init() {
  bindGlobalEvents();
  renderCategories();
  updateHeader();
  await fetchProducts();
  if (state.token) {
    await fetchOrders();
  }
}

init();
