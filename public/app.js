const $ = (s, r = document) => r.querySelector(s),
  $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $("#app"),
  toastRoot = $("#toast-root");
const CATEGORIES = [
  "Горячее",
  "Гарниры",
  "Салаты",
  "Супы",
  "Обеды",
  "Дополнительно",
  "Завтраки",
  "Энергетики, вода",
];
const state = {
  products: [],
  collections: {},
  user: null,
  cart: JSON.parse(localStorage.getItem("magday-cart") || "[]"),
  favorites: JSON.parse(localStorage.getItem("magday-favorites") || "[]"),
  query: "",
  menu: false,
};
const esc = (s = "") =>
  String(s).replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        m
      ],
  );
async function api(url, opt = {}) {
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opt,
    body:
      opt.body && typeof opt.body !== "string"
        ? JSON.stringify(opt.body)
        : opt.body,
  });
  const j = await r.json();
  if (!r.ok) throw Error(j.error?.message || "Ошибка");
  return j.data;
}
function toast(t, s = "") {
  const e = document.createElement("div");
  e.className = "toast";
  e.innerHTML = `<b>${esc(t)}</b><span>${esc(s)}</span>`;
  toastRoot.append(e);
  setTimeout(() => e.remove(), 3500);
}
function saveCart() {
  localStorage.setItem("magday-cart", JSON.stringify(state.cart));
}
function qty() {
  return state.cart.reduce((a, x) => a + x.qty, 0);
}
function total() {
  return state.cart.reduce(
    (a, x) =>
      a + (state.products.find((p) => p.id === x.id)?.price || 0) * x.qty,
    0,
  );
}
const money = (n) => new Intl.NumberFormat("ru-RU").format(n) + " ₽";
let scrollAnimationFrame = 0;
function smoothScrollToElement(element, duration = 950) {
  if (!element) return;
  cancelAnimationFrame(scrollAnimationFrame);
  const start = window.scrollY;
  const stickyOffset = window.innerWidth <= 560 ? 126 : 162;
  const target = Math.max(
    0,
    element.getBoundingClientRect().top + start - stickyOffset,
  );
  const distance = target - start;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, target);
    return;
  }
  const startedAt = performance.now();
  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, start + distance * eased);
    if (progress < 1) scrollAnimationFrame = requestAnimationFrame(tick);
  };
  scrollAnimationFrame = requestAnimationFrame(tick);
}
function navigate(path) {
  history.pushState({}, "", path);
  render();
  scrollTo({ top: 0, behavior: "smooth" });
}
function header() {
  return `<div class="topline">Ежедневно 8:00–20:00 · Королёв · Мытищи · Ивантеевка</div><header class="header"><a href="/" data-link class="logo">MAG<span>DAY</span></a><button class="catalogButton" data-catalog>▦ Каталог</button><label class="headerSearch"><input placeholder="Поиск блюд" value="${esc(state.query)}" data-search><span>⌕</span></label><div class="headActions">${state.user?.role === "root" ? '<a href="/root" data-link>⚙<small>Root</small></a>' : ""}<a href="${state.user ? "/account" : "/login"}" data-link>♙<small>${state.user ? esc(state.user.name) : "Вход"}</small></a><a href="/favorites" data-link>♡<small>Избранное</small><b>${state.favorites.length}</b></a><a href="/basket" data-link>🛒<small>Корзина</small><b>${qty()}</b></a></div><button class="mobileToggle" data-menu>☰</button></header><nav class="subnav ${state.menu ? "open" : ""}"><a href="/collection/office" data-link>Обеды на дом и в офис</a><a href="/collection/catering" data-link>Обслуживание банкетов</a><a href="/collection/enterprises" data-link>Комплексные обеды на предприятия</a></nav>`;
}
const footerLinks = [
  [
    "Доставка еды:",
    [
      "Домашние обеды|/page/домашние-обеды",
      "Доставка на дом|/page/доставка-еды-на-дом",
      "Условия доставки|/page/условия-доставки",
      "Карта доставки|/page/карта-доставки-с-800-до-2000",
      "Пользовательское соглашение|/page/пользовательское-соглашение",
    ],
  ],
  [
    "Спец. предложения:",
    [
      "Комплексные обеды|/page/комплексные-обеды-на-предприятия",
      "Еда на Дни Рождения|/page/еда-на-дни-рождения",
      "Обслуживание банкетов|/page/обслуживание-банкетов",
      "Кейтеринг|/page/кейтеринг",
      "Коммерческое предложение|/page/коммерческое-предложение",
    ],
  ],
  [
    "Контакты:",
    [
      "Наши клиенты|/page/наши-клиенты",
      "О компании|/page/о-компании",
      "Контакты|/page/контакты",
      "Обратная связь|/page/обратная-связь",
      "Реклама и партнёрство|/page/реклама-и-партнерство",
    ],
  ],
];
function footer() {
  return `<section class="appPromo reveal"><div><b>10%</b><h2>СКИДКА ПРИ ЗАКАЗЕ<br>С МОБИЛЬНОГО ПРИЛОЖЕНИЯ</h2><div class="storeButtons"><button data-app="App Store"> App Store</button><button data-app="Google Play">▶ Google Play</button></div></div><div class="phone"><div class="phoneScreen"><i>MAGDAY</i><span>🥗</span><b>Ваш обед<br>уже в пути</b></div></div></section><footer><div class="hunger"><div><h3>Проголодались?</h3><p>Соберём свежий обед и привезём за час — по Королёву, Мытищам и Ивантеевке.</p></div><a href="/#catalog" data-link class="limeButton">Перейти в каталог →</a></div><div class="footerGrid"><div><a href="/" data-link class="footerLogo">MAG<span>DAY</span></a><p>Доставка обедов</p><small>◷ Ежедневно 8:00–20:00<br>Королёв · Мытищи · Ивантеевка</small></div>${footerLinks
    .map(
      (g) =>
        `<div><b>${g[0]}</b>${g[1]
          .map((x) => {
            const [n, h] = x.split("|");
            return `<a href="${h}" data-link>— ${n}</a>`;
          })
          .join("")}</div>`,
    )
    .join(
      "",
    )}</div><div class="copyright">© 2026 Magday — доставка обедов <span>version 2.0</span></div></footer><button class="chat" data-chat>•••</button>`;
}
function productCard(p) {
  const fav = state.favorites.includes(p.id);
  return `<article class="product reveal"><button class="favoriteButton ${fav ? "active" : ""}" data-favorite="${p.id}" aria-label="Избранное">${fav ? "♥" : "♡"}</button><a href="/product/${p.id}" data-link class="productVisual"><img src="${p.image}" alt="${esc(p.name)}" loading="lazy"></a><div class="productBody"><small>${p.category} · ${p.rating} ★</small><a href="/product/${p.id}" data-link><h3>${esc(p.name)}</h3></a><p>${p.availabilityLabel} · За ${p.deliveryMinutes} минут</p><div><b>${money(p.price)}</b><em>${p.weight} г</em><button data-add="${p.id}">+</button></div></div></article>`;
}
function categoryNav() {
  return `<div class="categoryNav">${CATEGORIES.map((c) => `<button data-scrollcat="${c}">${c}</button>`).join("")}</div>`;
}
function home() {
  return `<main><section class="homeHero"><div class="heroCopy reveal"><span class="eyebrow">Готовим сегодня · доставка за час</span><h1>Домашние обеды<br><i>на каждый день</i></h1><p>Свежая еда для дома, офиса и команды. Привозим горячей по Королёву, Мытищам и Ивантеевке.</p><div><button class="mainButton" data-scrollcat="Обеды">Выбрать обед →</button><a href="/collection/office" data-link class="softButton">Питание для команды</a></div><dl><div><dt>4,9</dt><dd>средняя оценка</dd></div><div><dt>60 мин</dt><dd>средняя доставка</dd></div><div><dt>3 800</dt><dd>порций в день</dd></div></dl></div><div class="heroPlate reveal"><div>🍱</div><span class="tag t1"><b>Свежо</b>готовим утром</span><span class="tag t2"><b>Горячо</b>термоупаковка</span></div></section>${categoryNav()}<section class="catalog" id="catalog"><div class="catalogTitle"><div><span>МЕНЮ НА СЕГОДНЯ</span><h2>Каталог блюд</h2></div><p>Посуда включена в стоимость. Выберите блюда — мы аккуратно соберём и быстро доставим.</p></div>${CATEGORIES.map(
    (c) => {
      const list = state.products.filter(
        (p) =>
          p.category === c &&
          (!state.query ||
            (p.name + " " + p.description)
              .toLowerCase()
              .includes(state.query.toLowerCase())),
      );
      return `<section class="categorySection" data-category="${c}" id="cat-${encodeURIComponent(c)}"><div class="categoryTitle"><h2>${c}</h2><span>${list.length} позиций</span></div><div class="productGrid">${list.map(productCard).join("")}</div></section>`;
    },
  ).join(
    "",
  )}</section><section class="howOrder reveal"><span class="eyebrow">КАК ЗАКАЗАТЬ</span><h2>Пять простых шагов</h2><div>${["Выберите блюда", "Оформите заказ", "Оператор перезвонит", "Отслеживайте статус", "Оплатите удобным способом"].map((x, i) => `<article><b>0${i + 1}</b><h3>${x}</h3></article>`).join("")}</div></section><section class="deliveryTerms reveal"><div><b>от 235 ₽</b><span>минимальный самовывоз</span></div><div><b>Бесплатно</b><span>доставка от 1 500 ₽</span></div><div><b>8:00–20:00</b><span>ежедневно</span></div></section><section class="statsBand reveal"><b>2500+<small>клиентов</small></b><b>4.8★<small>оценка</small></b><b>от 60 минут<small>доставка</small></b><b>3 города<small>Королёв · Мытищи · Ивантеевка</small></b></section><section class="qualityGrid"><article class="reveal"><span>100%</span><h2>Гарантия свежести</h2><p>Готовим в день доставки из проверенных продуктов.</p></article><article class="reveal"><span>₽</span><h2>Любые способы оплаты</h2><p>Онлайн, картой курьеру, наличными или безналом.</p></article></section><section class="menuDownload reveal"><div><span class="eyebrow">МЕНЮ НА СЕГОДНЯ</span><h2>Скачайте меню в PDF</h2></div><a class="mainButton" href="/assets/menu-magday.pdf" download>Скачать меню</a></section><section class="contactBand reveal"><div><h2>Поможем собрать заказ</h2><p>Оператор на связи ежедневно с 8:00 до 20:00</p></div><a href="tel:+79996341612">+7 (999) 634-16-12</a></section><section class="businessGrid">${Object.entries(
    state.collections,
  )
    .map(
      ([slug, c]) =>
        `<a href="/collection/${slug}" data-link class="businessCard reveal" style="--c:${c.color}"><span>${c.icon}</span><small>ДЛЯ КОМАНДЫ</small><h3>${c.title}</h3><p>${c.description}</p><b>Подробнее →</b></a>`,
    )
    .join("")}</section></main>`;
}
function collection(slug) {
  const c = state.collections[slug];
  if (!c) return notFound();
  return `<main class="collection"><section class="collectionHero" style="--c:${c.color}"><div class="reveal"><span class="eyebrow">MAGDAY ДЛЯ БИЗНЕСА</span><h1>${c.title}</h1><p>${c.description}</p><div><button class="mainButton" data-lead="${esc(c.title)}">Получить расчёт →</button><button class="softButton" data-jump="sets">Смотреть наборы</button></div><dl><div><dt>от ${c.minPrice} ₽</dt><dd>за человека</dd></div><div><dt>от ${c.minPeople}</dt><dd>человек</dd></div><div><dt>−${c.discount}%</dt><dd>за объём</dd></div></dl></div><div class="collectionIcon reveal">${c.icon}</div></section><section class="calculator reveal"><div><small>РАСЧЁТ СТОИМОСТИ</small><h2>Узнайте цену за минуту</h2><p>Укажите количество человек и срок — итог пересчитается автоматически.</p></div><form data-calc data-price="${c.minPrice}"><label>Количество человек<input type="number" name="people" min="${c.minPeople}" value="${c.minPeople}"></label><label>Период<select name="days"><option value="1">1 день</option><option value="5">Неделя, 5 дней</option><option value="22">Месяц, 22 дня</option></select></label><div class="calcTotal"><small>Итого</small><b>${money(c.minPrice * c.minPeople)}</b></div><button class="mainButton">Оставить заявку</button></form></section><section class="contentSection" id="sets"><span class="eyebrow">ГОТОВЫЕ НАБОРЫ</span><h2>Выберите подходящий формат</h2><div class="setGrid">${c.sets.map((s, i) => `<article class="setCard reveal"><span>0${i + 1}</span><h3>${s[0]}</h3><p>${s[1]}</p><b>от ${s[2]} ₽ / чел.</b><button data-lead="${esc(c.title + " — " + s[0])}">Заказать</button></article>`).join("")}</div></section><section class="benefits"><h2>Удобно и выгодно</h2><div>${["Доставка точно по графику", "Безналичная оплата по договору", "Меню обновляется каждую неделю", "Скидки за постоянный объём"].map((x, i) => `<article class="reveal"><b>0${i + 1}</b><h3>${x}</h3><p>Согласуем детали заранее и закрепим условия в договоре.</p></article>`).join("")}</div></section><section class="request reveal"><div><span class="eyebrow">ИНДИВИДУАЛЬНЫЙ РАСЧЁТ</span><h2>Подготовим предложение</h2><p>Перезвоним, уточним детали и посчитаем стоимость.</p></div><form data-lead-form><input name="name" placeholder="Ваше имя"><input name="phone" required placeholder="+7 (___) ___-__-__"><input type="hidden" name="type" value="${esc(c.title)}"><button>Отправить заявку</button></form></section></main>`;
}
function productPage(id) {
  const p = state.products.find((x) => x.id === id || x.slug === id);
  if (!p) return notFound();
  const related = state.products
    .filter((x) => x.category === p.category && x.id !== p.id)
    .slice(0, 4);
  return `<main class="productPage"><nav class="crumb"><a href="/" data-link>Главная</a> / <button data-scrollcat="${p.category}">${p.category}</button> / ${esc(p.name)}</nav><section class="productDetail"><div class="productGallery" style="--a:${p.accent}"><div><img src="${p.image}" alt="${esc(p.name)}"></div><button data-favorite="${p.id}">${state.favorites.includes(p.id) ? "♥" : "♡"}</button><span>Изображение блюда · фактическая сервировка может отличаться</span></div><div class="productInfo"><small>${p.category} · ${p.rating} ★</small><h1>${esc(p.name)}</h1><p>${esc(p.longDescription)}</p><div class="productMeta"><span><b>${p.weight} г</b>вес</span><span><b>${p.kcal}</b>ккал</span><span><b>Сегодня</b>готовим</span></div><div class="priceRow"><b>${money(p.price)}</b>${p.oldPrice ? `<del>${money(p.oldPrice)}</del>` : ""}</div><div class="buyRow"><button data-minusbuy>−</button><input value="1" data-buyqty readonly><button data-plusbuy>+</button><button class="mainButton" data-add="${p.id}" data-from-detail>Добавить в корзину</button></div><p class="deliveryHint">✓ ${p.availabilityLabel} · Доставим от ${p.deliveryMinutes} минут · Готовим сегодня</p></div></section><section class="productTabs"><div class="tabs"><button class="active" data-tab="description">Описание</button><button data-tab="composition">Состав</button><button data-tab="nutrition">Пищевая ценность</button><button data-tab="delivery">Доставка</button></div><div data-tabpanel><h2>О блюде</h2><p>${esc(p.longDescription)}</p></div></section><section class="productPromises"><article><b>60 минут</b><span>доставка горячим</span></article><article><b>Сегодня</b><span>готовим в день заказа</span></article><article><b>100%</b><span>контроль качества</span></article><article><b>Онлайн</b><span>или при получении</span></article></section><section class="reviews"><h2>Отзывы</h2><div><b>${p.reviewsCount ? `${p.reviewsCount} отзывов` : "Нет отзывов"}</b><p>Будьте первым, кто поделится впечатлением о блюде.</p></div></section><section class="related"><h2>Попробуйте также</h2><div class="productGrid">${related.map(productCard).join("")}</div></section></main>`;
}
function favorites() {
  const x = state.products.filter((p) => state.favorites.includes(p.id));
  return `<main class="favoritesPage"><span class="eyebrow">ВАШ ВЫБОР</span><h1>Избранное</h1>${x.length ? `<div class="productGrid">${x.map(productCard).join("")}</div>` : '<div class="empty"><span>♡</span><h2>Здесь пока пусто</h2><p>Нажимайте на сердечко у понравившихся блюд.</p><a href="/#catalog" data-link class="mainButton">Перейти в каталог</a></div>'}</main>`;
}
function basket() {
  const items = state.cart
    .map((i) => ({ ...i, p: state.products.find((p) => p.id === i.id) }))
    .filter((x) => x.p);
  return `<main class="basketPage"><h1>Корзина</h1>${items.length ? `<div class="basketLayout"><section class="basketItems">${items.map((x) => `<article><a href="/product/${x.p.id}" data-link style="--a:${x.p.accent}"><img src="${x.p.image}" alt="${esc(x.p.name)}"></a><div><small>${x.p.category}</small><h3>${esc(x.p.name)}</h3><p>${x.p.weight} г</p></div><div class="counter"><button data-cartminus="${x.p.id}">−</button><b>${x.qty}</b><button data-cartplus="${x.p.id}">+</button></div><b>${money(x.p.price * x.qty)}</b><button class="remove" data-remove="${x.p.id}">×</button></article>`).join("")}</section><aside class="checkout"><h2>Ваш заказ</h2><div><span>Товары (${qty()})</span><b>${money(total())}</b></div><div><span>Доставка</span><b>${total() >= 1500 ? "Бесплатно" : "250 ₽"}</b></div><hr><div class="grand"><span>Итого</span><b>${money(total() + (total() >= 1500 ? 0 : 250))}</b></div><button class="mainButton" data-checkout>Оформить заказ</button><small>Нажимая кнопку, вы соглашаетесь с условиями доставки.</small></aside></div>` : `<section class="empty"><span>🛒</span><h2>Корзина пока пуста</h2><p>Добавьте блюда из каталога — всё сохранится здесь.</p><a href="/#catalog" data-link class="mainButton">Перейти в каталог</a></section>`}</main>`;
}
function checkout() {
  return `<main class="formPage"><section><span class="eyebrow">ОФОРМЛЕНИЕ</span><h1>Куда доставить заказ?</h1><p>Оператор подтвердит заказ и точное время доставки.</p></section><form data-order><label>Имя<input name="name" required value="${esc(state.user?.name || "")}"></label><label>Телефон<input name="phone" required value="${esc(state.user?.phone || "")}"></label><label>Email<input type="email" name="email" value="${esc(state.user?.email || "")}"></label><label class="wide">Адрес доставки<input name="address" required></label><label>Время<select name="delivery"><option>Как можно скорее</option><option>К 12:00</option><option>К 13:00</option><option>К 14:00</option></select></label><label>Оплата<select name="payment"><option>Картой курьеру</option><option>Наличными</option><option>Онлайн</option></select></label><label class="wide">Комментарий<textarea name="comment"></textarea></label><div class="wide orderTotal"><span>К оплате</span><b>${money(total() + (total() >= 1500 ? 0 : 250))}</b></div><button class="mainButton wide">Подтвердить заказ</button></form></main>`;
}
function auth(type) {
  const reg = type === "register";
  return `<main class="authPage"><section><a href="/" data-link class="logo">MAG<span>DAY</span></a><span>${reg ? "Создайте аккаунт" : "С возвращением"}</span><h1>${reg ? "Регистрация" : "Вход"}</h1><p>${reg ? "Сохраняйте адреса и смотрите историю заказов." : "Войдите, чтобы увидеть историю и повторить заказ."}</p><form data-auth="${type}">${reg ? '<label>Имя<input name="name" required></label><label>Телефон<input name="phone"></label>' : ""}<label>Email<input type="email" name="email" required></label><label>Пароль<input type="password" name="password" minlength="10" required></label><button class="mainButton">${reg ? "Зарегистрироваться" : "Войти"}</button></form><p>${reg ? 'Уже есть аккаунт? <a href="/login" data-link>Войти</a>' : 'Нет аккаунта? <a href="/register" data-link>Зарегистрироваться</a>'}</p></section><div><span>🍱</span><h2>Любимые блюда<br>в одном аккаунте</h2></div></main>`;
}
function orders() {
  if (!state.user)
    return `<main class="ordersPage"><div class="empty"><span>🔐</span><h1>Войдите, чтобы увидеть заказы</h1><p>История заказов привязывается к аккаунту.</p><a href="/login" data-link class="mainButton">Войти</a></div></main>`;
  return `<main class="ordersPage"><h1>Мои заказы</h1><div data-orders><div class="loader"></div></div></main>`;
}
function rootPage() {
  if (!state.user)
    return `<main class="rootDenied"><h1>Root-панель</h1><p>Войдите под root-аккаунтом.</p><a href="/login" data-link class="mainButton">Войти</a></main>`;
  if (state.user.role !== "root")
    return `<main class="rootDenied"><h1>403</h1><p>У аккаунта нет root-доступа.</p><a href="/" data-link class="mainButton">На главную</a></main>`;
  return `<main class="rootPage"><header class="rootTitle"><div><span class="eyebrow">ТОЛЬКО ROOT</span><h1>Управление MAGDAY</h1><p>Заказы появляются здесь сразу после оформления.</p></div><button class="softButton" data-root-refresh>Обновить</button></header><section class="rootStats" data-root-stats><div class="loader"></div></section><nav class="rootTabs"><button class="active" data-root-tab="orders">Заказы</button><button data-root-tab="users">Пользователи</button><button data-root-tab="leads">Заявки</button></nav><section data-root-content><div class="loader"></div></section></main>`;
}
function infoPage(slug) {
  return `<main class="infoPage"><nav class="crumb"><a href="/" data-link>Главная</a> / Информация</nav><article data-info><div class="loader"></div></article>${slug.includes("карта") ? '<div class="map"><i class="zone z1"></i><i class="zone z2"></i><i class="zone z3"></i><span class="pin p1">Королёв</span><span class="pin p2">Мытищи</span><span class="pin p3">Ивантеевка</span></div>' : ""}</main>`;
}
function notFound() {
  return `<main class="empty"><span>404</span><h1>Страница не найдена</h1><a href="/" data-link class="mainButton">На главную</a></main>`;
}
function shell(content) {
  return header() + content + footer();
}
async function render() {
  const path = decodeURIComponent(location.pathname);
  let content;
  if (path === "/") content = home();
  else if (path.startsWith("/collection/"))
    content = collection(path.split("/")[2]);
  else if (path.startsWith("/product/"))
    content = productPage(path.split("/")[2]);
  else if (path === "/favorites") content = favorites();
  else if (path === "/basket") content = basket();
  else if (path === "/checkout") content = checkout();
  else if (path === "/login") content = auth("login");
  else if (path === "/register") content = auth("register");
  else if (path === "/root") content = rootPage();
  else if (path === "/OrderHistory" || path === "/account") content = orders();
  else if (path.startsWith("/page/")) content = infoPage(path.slice(6));
  else content = notFound();
  app.innerHTML =
    path === "/login" || path === "/register" ? content : shell(content);
  bind();
  requestAnimationFrame(observe);
  if (path.startsWith("/page/")) loadInfo(path.slice(6));
  if (path === "/OrderHistory" || path === "/account") loadOrders();
  if (path === "/root" && state.user?.role === "root") loadRoot();
}
function bind() {
  $$("[data-link]").forEach(
    (a) =>
      (a.onclick = (e) => {
        e.preventDefault();
        navigate(a.getAttribute("href"));
      }),
  );
  $("[data-catalog]")?.addEventListener("click", () => {
    if (location.pathname !== "/") {
      sessionStorage.setItem("scrollcat", "Горячее");
      navigate("/");
    } else smoothScrollToElement($("#catalog"));
  });
  $("[data-menu]")?.addEventListener("click", () => {
    state.menu = !state.menu;
    render();
  });
  $("[data-search]")?.addEventListener("input", (e) => {
    state.query = e.target.value;
    clearTimeout(window.sq);
    window.sq = setTimeout(() => {
      if (location.pathname !== "/") navigate("/");
      else render();
    }, 220);
  });
  $$("[data-scrollcat]").forEach(
    (b) =>
      (b.onclick = () => {
        const cat = b.dataset.scrollcat;
        if (location.pathname !== "/") {
          sessionStorage.setItem("scrollcat", cat);
          navigate("/");
          return;
        }
        const el = $(`[data-category="${CSS.escape(cat)}"]`);
        smoothScrollToElement(el);
        el?.classList.add("pulse");
        setTimeout(() => el?.classList.remove("pulse"), 1000);
      }),
  );
  $$("[data-favorite]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        const id = b.dataset.favorite;
        state.favorites = state.favorites.includes(id)
          ? state.favorites.filter((x) => x !== id)
          : [...state.favorites, id];
        localStorage.setItem(
          "magday-favorites",
          JSON.stringify(state.favorites),
        );
        toast(
          state.favorites.includes(id)
            ? "Добавлено в избранное"
            : "Удалено из избранного",
        );
        render();
      }),
  );
  $$("[data-add]").forEach(
    (b) =>
      (b.onclick = (e) => {
        e.preventDefault();
        const id = b.dataset.add,
          n = Number($("[data-buyqty]")?.value || 1),
          x = state.cart.find((i) => i.id === id);
        x ? (x.qty += n) : state.cart.push({ id, qty: n });
        saveCart();
        toast("Добавлено в корзину");
        if (!b.dataset.fromDetail) render();
        else {
          b.textContent = "Добавлено ✓";
          setTimeout(render, 700);
        }
      }),
  );
  $$("[data-cartplus]").forEach(
    (b) =>
      (b.onclick = () => {
        state.cart.find((x) => x.id === b.dataset.cartplus).qty++;
        saveCart();
        render();
      }),
  );
  $$("[data-cartminus]").forEach(
    (b) =>
      (b.onclick = () => {
        const x = state.cart.find((x) => x.id === b.dataset.cartminus);
        x.qty--;
        if (x.qty <= 0) state.cart = state.cart.filter((v) => v !== x);
        saveCart();
        render();
      }),
  );
  $$("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        state.cart = state.cart.filter((x) => x.id !== b.dataset.remove);
        saveCart();
        render();
      }),
  );
  $("[data-checkout]")?.addEventListener("click", () => navigate("/checkout"));
  $("[data-plusbuy]")?.addEventListener("click", () => {
    $("[data-buyqty]").value = Number($("[data-buyqty]").value) + 1;
  });
  $("[data-minusbuy]")?.addEventListener("click", () => {
    $("[data-buyqty]").value = Math.max(
      1,
      Number($("[data-buyqty]").value) - 1,
    );
  });
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = state.products.find(
            (x) =>
              location.pathname.endsWith(x.id) ||
              location.pathname.endsWith(x.slug),
          ),
          t = b.dataset.tab;
        $$("[data-tab]").forEach((x) => x.classList.toggle("active", x === b));
        $("[data-tabpanel]").innerHTML =
          t === "composition"
            ? `<h2>Состав</h2><p>${p.composition}</p>`
            : t === "nutrition"
              ? `<h2>Пищевая ценность</h2><p>Белки: ${p.protein} г · Жиры: ${p.fat} г · Углеводы: ${p.carbs} г · ${p.kcal} ккал.</p>`
              : t === "delivery"
                ? "<h2>Доставка</h2><p>Доставляем ежедневно с 8:00 до 20:00. Среднее время — 60–90 минут.</p>"
                : `<h2>О блюде</h2><p>${p.longDescription}</p>`;
      }),
  );
  $$("[data-jump]").forEach(
    (b) =>
      (b.onclick = () =>
        $("#" + b.dataset.jump)?.scrollIntoView({ behavior: "smooth" })),
  );
  $$("[data-lead]").forEach(
    (b) => (b.onclick = () => openLead(b.dataset.lead)),
  );
  $$("[data-lead-form]").forEach((f) => (f.onsubmit = submitLead));
  $("[data-order]")?.addEventListener("submit", submitOrder);
  $("[data-auth]")?.addEventListener("submit", submitAuth);
  $("[data-calc]")?.addEventListener("input", (e) => {
    const f = e.currentTarget,
      v =
        Number(f.people.value) * Number(f.days.value) * Number(f.dataset.price);
    $(".calcTotal b", f).textContent = money(v);
  });
  $("[data-calc]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    openLead("Расчёт корпоративного питания");
  });
  $("[data-chat]")?.addEventListener("click", () => openLead("Обратная связь"));
  const cat = sessionStorage.getItem("scrollcat");
  if (cat && location.pathname === "/") {
    sessionStorage.removeItem("scrollcat");
    setTimeout(
      () =>
        document.querySelector(`[data-category="${CSS.escape(cat)}"]`) &&
        smoothScrollToElement(
          document.querySelector(`[data-category="${CSS.escape(cat)}"]`),
        ),
      250,
    );
  }
}
function modal(html) {
  const o = document.createElement("div");
  o.className = "modal";
  o.innerHTML = `<div class="modalShade" data-close></div><section>${html}<button class="modalClose" data-close>×</button></section>`;
  document.body.append(o);
  document.body.classList.add("locked");
  $$("[data-close]", o).forEach(
    (b) =>
      (b.onclick = () => {
        o.remove();
        document.body.classList.remove("locked");
      }),
  );
  return o;
}
function openLead(type = "Заявка") {
  const o = modal(
    `<span class="eyebrow">${esc(type || "ЗАЯВКА")}</span><h2>Получить расчёт</h2><p>Оставьте контакты — перезвоним и уточним детали.</p><form data-lead-form><input name="name" placeholder="Ваше имя"><input name="phone" required placeholder="+7 (___) ___-__-__"><input name="people" type="number" placeholder="Количество человек"><input type="hidden" name="type" value="${esc(type || "Заявка")}"><button>Отправить</button></form>`,
  );
  $("[data-lead-form]", o).onsubmit = submitLead;
}
async function submitLead(e) {
  e.preventDefault();
  const f = e.currentTarget;
  try {
    await api("/api/leads", {
      method: "POST",
      body: Object.fromEntries(new FormData(f)),
    });
    f.innerHTML =
      '<div class="success">✓<h3>Заявка отправлена</h3><p>Скоро мы вам позвоним.</p></div>';
  } catch (x) {
    toast("Не удалось отправить", x.message);
  }
}
async function submitAuth(e) {
  e.preventDefault();
  const f = e.currentTarget;
  try {
    state.user = await api("/api/auth/" + f.dataset.auth, {
      method: "POST",
      body: Object.fromEntries(new FormData(f)),
    });
    toast("Готово", state.user.name);
    navigate(state.user.role === "root" ? "/root" : "/account");
  } catch (x) {
    toast("Ошибка", x.message);
  }
}
async function submitOrder(e) {
  e.preventDefault();
  const b = Object.fromEntries(new FormData(e.currentTarget));
  b.items = state.cart;
  try {
    const order = await api("/api/orders", { method: "POST", body: b });
    state.cart = [];
    saveCart();
    app.innerHTML = shell(
      `<main class="successPage"><span>✓</span><h1>Заказ принят</h1><p>Номер ${order.id}. Мы позвоним для подтверждения.</p><a href="/" data-link class="mainButton">На главную</a></main>`,
    );
    bind();
  } catch (x) {
    toast("Не удалось оформить", x.message);
  }
}
async function loadInfo(slug) {
  try {
    const p = await api("/api/pages/" + slug);
    $("[data-info]").innerHTML =
      `<span class="eyebrow">MAGDAY</span><h1>${esc(p.title)}</h1><p>${esc(p.body)}</p>${slug === "обратная-связь" ? '<button class="mainButton" data-chat>Написать нам</button>' : ""}`;
    bind();
  } catch (x) {
    $("[data-info]").innerHTML = `<h1>Страница не найдена</h1>`;
  }
}
async function loadOrders() {
  if (!state.user) return;
  try {
    const x = await api("/api/orders/mine");
    $("[data-orders]").innerHTML = x.length
      ? x
          .map(
            (o) =>
              `<article class="order"><div><small>${new Date(o.createdAt).toLocaleString("ru-RU")}</small><h3>${o.id}</h3><p>${o.items.map((i) => i.name + " × " + i.qty).join(", ")}</p></div><span>${o.status}</span><b>${money(o.total)}</b></article>`,
          )
          .join("")
      : '<div class="empty"><h2>Заказов пока нет</h2></div>';
  } catch (x) {
    $("[data-orders]").innerHTML =
      `<div class="empty"><p>${esc(x.message)}</p></div>`;
  }
}

let rootData = null;
function rootOrderRows(rows) {
  const statuses = [
    "Принят",
    "Подтверждён",
    "Готовится",
    "Готов",
    "В доставке",
    "Доставлен",
    "Отменён",
  ];
  return rows.length
    ? `<div class="rootTable">${rows.map((order) => `<article class="rootOrder"><div><small>${new Date(order.createdAt).toLocaleString("ru-RU")}</small><h3>${esc(order.id)}</h3><p>${esc(order.name)} · ${esc(order.phone)} · ${esc(order.address)}</p><p>${order.items.map((item) => `${esc(item.name)} × ${item.qty}`).join(", ")}</p></div><b>${money(order.total)}</b><select data-root-status="${esc(order.id)}">${statuses.map((status) => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}</select></article>`).join("")}</div>`
    : '<div class="empty"><h2>Заказов пока нет</h2></div>';
}
function renderRootTab(tab) {
  if (!rootData) return;
  const target = $("[data-root-content]");
  if (tab === "orders") target.innerHTML = rootOrderRows(rootData.orders);
  if (tab === "users")
    target.innerHTML = `<div class="rootTable">${rootData.users.map((user) => `<article><div><small>${esc(user.role)}</small><h3>${esc(user.name)}</h3><p>${esc(user.email)} · ${esc(user.phone || "—")}</p></div><span>${new Date(user.createdAt).toLocaleDateString("ru-RU")}</span></article>`).join("")}</div>`;
  if (tab === "leads")
    target.innerHTML = `<div class="rootTable">${rootData.leads.map((lead) => `<article><div><small>${new Date(lead.createdAt).toLocaleString("ru-RU")}</small><h3>${esc(lead.name || "Заявка")}</h3><p>${esc(lead.phone)} · ${esc(lead.message || "")}</p></div></article>`).join("")}</div>`;
  $$("[data-root-status]").forEach(
    (select) =>
      (select.onchange = async () => {
        await api(`/api/root/orders/${select.dataset.rootStatus}/status`, {
          method: "PATCH",
          body: { status: select.value },
        });
        toast("Статус обновлён", select.value);
        await loadRoot();
      }),
  );
}
async function loadRoot() {
  try {
    rootData = await api("/api/root/dashboard");
    $("[data-root-stats]").innerHTML =
      `<article><span>Заказы</span><b>${rootData.stats.orders}</b></article><article><span>Клиенты</span><b>${rootData.stats.customers}</b></article><article><span>Заявки</span><b>${rootData.stats.leads}</b></article><article><span>Выручка</span><b>${money(Number(rootData.stats.revenue))}</b></article>`;
    renderRootTab("orders");
    $$("[data-root-tab]").forEach(
      (button) =>
        (button.onclick = () => {
          $$("[data-root-tab]").forEach((item) =>
            item.classList.toggle("active", item === button),
          );
          renderRootTab(button.dataset.rootTab);
        }),
    );
    $("[data-root-refresh]")?.addEventListener("click", loadRoot);
  } catch (error) {
    $("[data-root-content]").innerHTML =
      `<div class="empty"><h2>${esc(error.message)}</h2></div>`;
  }
}

function observe() {
  const io = new IntersectionObserver(
    (es) =>
      es.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
    { threshold: 0.08 },
  );
  $$(".reveal").forEach((x) => io.observe(x));
}
addEventListener("popstate", render);
Promise.all([
  api("/api/products"),
  api("/api/collections"),
  api("/api/auth/me"),
])
  .then(([p, c, u]) => {
    state.products = p;
    state.collections = c;
    state.user = u;
    render();
  })
  .catch((e) => {
    app.innerHTML = `<main class="empty"><h1>Не удалось запустить сайт</h1><p>${esc(e.message)}</p></main>`;
  });
