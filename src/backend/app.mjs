import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  normalizeEmail,
  passwordRecord,
  verifyPassword,
  publicUser,
  sessionHash,
  sessionCookie,
  clearSessionCookie,
  uid,
} from "./security.mjs";

const STATUSES = [
  "Принят",
  "Подтверждён",
  "Готовится",
  "Готов",
  "В доставке",
  "Доставлен",
  "Отменён",
];
const json = (res, status, payload, headers = {}) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(payload));
};
async function requestBody(req) {
  let value = "";
  for await (const chunk of req) {
    value += chunk;
    if (value.length > 2_000_000)
      throw Object.assign(new Error("Слишком большой запрос"), { status: 413 });
  }
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    throw Object.assign(new Error("Некорректный JSON"), { status: 400 });
  }
}
function cookies(req) {
  return Object.fromEntries(
    (req.headers.cookie ?? "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [
          decodeURIComponent(part.slice(0, index).trim()),
          decodeURIComponent(part.slice(index + 1)),
        ];
      }),
  );
}
const secureCookie = (req) =>
  process.env.COOKIE_SECURE === "true" ||
  req.headers["x-forwarded-proto"] === "https";
async function currentUser(req, store) {
  const token = cookies(req).magday_session;
  return token ? store.userBySession(sessionHash(token)) : null;
}
function requireRoot(user) {
  if (!user)
    throw Object.assign(new Error("Войдите в root-аккаунт"), {
      status: 401,
      code: "AUTH_REQUIRED",
    });
  if (user.role !== "root")
    throw Object.assign(new Error("Доступ разрешён только root-пользователю"), {
      status: 403,
      code: "ROOT_ONLY",
    });
}
function cleanText(value, max = 500) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export function createHandler({ store, publicDir }) {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
  };
  async function api(req, res, url) {
    const method = req.method ?? "GET",
      route = decodeURIComponent(url.pathname),
      user = await currentUser(req, store);
    if (route === "/api/health")
      return json(res, 200, {
        data: {
          status: "ok",
          database: process.env.DB_DRIVER ?? "json",
          time: new Date().toISOString(),
        },
      });
    if (route === "/api/products" && method === "GET")
      return json(res, 200, {
        data: await store.products({
          q: url.searchParams.get("q") ?? "",
          category: url.searchParams.get("category") ?? "",
        }),
      });
    let match = route.match(/^\/api\/products\/([^/]+)$/);
    if (match && method === "GET") {
      const row = await store.product(match[1]);
      return row
        ? json(res, 200, { data: row })
        : json(res, 404, {
            error: { code: "NOT_FOUND", message: "Товар не найден" },
          });
    }
    if (route === "/api/collections" && method === "GET")
      return json(res, 200, { data: await store.collections() });
    match = route.match(/^\/api\/collections\/([^/]+)$/);
    if (match && method === "GET") {
      const row = await store.collection(match[1]);
      return row
        ? json(res, 200, { data: row })
        : json(res, 404, {
            error: { code: "NOT_FOUND", message: "Раздел не найден" },
          });
    }
    match = route.match(/^\/api\/pages\/(.+)$/);
    if (match && method === "GET") {
      const row = await store.page(match[1]);
      return row
        ? json(res, 200, { data: row })
        : json(res, 404, {
            error: { code: "NOT_FOUND", message: "Страница не найдена" },
          });
    }
    if (route === "/api/auth/register" && method === "POST") {
      const body = await requestBody(req),
        email = normalizeEmail(body.email),
        name = cleanText(body.name, 120),
        phone = cleanText(body.phone, 40);
      if (!name || !/^\S+@\S+\.\S+$/.test(email))
        return json(res, 422, {
          error: {
            code: "VALIDATION",
            message: "Укажите корректные имя и email",
          },
        });
      if (await store.findUserByEmail(email))
        return json(res, 409, {
          error: {
            code: "EMAIL_EXISTS",
            message: "Этот email уже зарегистрирован",
          },
        });
      const userRecord = {
        id: uid("usr"),
        name,
        email,
        phone,
        role: "customer",
        ...passwordRecord(String(body.password ?? "")),
        createdAt: new Date().toISOString(),
      };
      await store.createUser(userRecord);
      const token = crypto.randomBytes(32).toString("hex");
      await store.createSession({
        tokenHash: sessionHash(token),
        userId: userRecord.id,
        expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(),
      });
      return json(
        res,
        201,
        { data: publicUser(userRecord) },
        { "Set-Cookie": sessionCookie(token, secureCookie(req)) },
      );
    }
    if (route === "/api/auth/login" && method === "POST") {
      const body = await requestBody(req),
        account = await store.findUserByEmail(body.email);
      if (!account || !verifyPassword(body.password, account))
        return json(res, 401, {
          error: {
            code: "INVALID_LOGIN",
            message: "Неверный email или пароль",
          },
        });
      const token = crypto.randomBytes(32).toString("hex");
      await store.createSession({
        tokenHash: sessionHash(token),
        userId: account.id,
        expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(),
      });
      return json(
        res,
        200,
        { data: publicUser(account) },
        { "Set-Cookie": sessionCookie(token, secureCookie(req)) },
      );
    }
    if (route === "/api/auth/me" && method === "GET")
      return json(res, 200, { data: publicUser(user) });
    if (route === "/api/auth/logout" && method === "POST") {
      const token = cookies(req).magday_session;
      if (token) await store.deleteSession(sessionHash(token));
      return json(
        res,
        200,
        { data: { ok: true } },
        { "Set-Cookie": clearSessionCookie(secureCookie(req)) },
      );
    }
    if (route === "/api/orders" && method === "POST") {
      const body = await requestBody(req);
      if (
        !cleanText(body.name, 120) ||
        !cleanText(body.phone, 40) ||
        !cleanText(body.address, 500) ||
        !Array.isArray(body.items) ||
        !body.items.length
      )
        return json(res, 422, {
          error: {
            code: "VALIDATION",
            message: "Заполните контакты, адрес и корзину",
          },
        });
      let total = 0;
      const items = [];
      for (const requested of body.items) {
        const product = await store.product(requested.id),
          quantity = Math.max(1, Math.min(99, Number(requested.qty) || 1));
        if (!product)
          return json(res, 422, {
            error: {
              code: "PRODUCT_NOT_FOUND",
              message: "Один из товаров больше недоступен",
            },
          });
        total += product.price * quantity;
        items.push({
          id: product.id,
          name: product.name,
          price: product.price,
          qty: quantity,
        });
      }
      const order = {
        id: uid("MD"),
        userId: user?.id ?? null,
        name: cleanText(body.name, 120),
        phone: cleanText(body.phone, 40),
        email: normalizeEmail(body.email || user?.email),
        address: cleanText(body.address, 500),
        comment: cleanText(body.comment, 1000),
        delivery: cleanText(body.delivery, 100) || "Как можно скорее",
        payment: cleanText(body.payment, 100) || "Картой курьеру",
        items,
        total,
        status: "Принят",
        createdAt: new Date().toISOString(),
      };
      await store.createOrder(order);
      return json(res, 201, { data: order });
    }
    if (route === "/api/orders/mine" && method === "GET") {
      if (!user)
        return json(res, 401, {
          error: {
            code: "AUTH_REQUIRED",
            message: "Войдите, чтобы увидеть заказы",
          },
        });
      return json(res, 200, { data: await store.ordersFor(user) });
    }
    if (route === "/api/leads" && method === "POST") {
      const body = await requestBody(req);
      if (!cleanText(body.phone, 40))
        return json(res, 422, {
          error: { code: "VALIDATION", message: "Укажите телефон" },
        });
      const lead = {
        id: uid("lead"),
        name: cleanText(body.name, 120),
        phone: cleanText(body.phone, 40),
        email: normalizeEmail(body.email),
        message: cleanText(body.message || body.comment, 1000),
        source: cleanText(body.source || "site", 120),
        createdAt: new Date().toISOString(),
      };
      await store.createLead(lead);
      return json(res, 201, { data: lead });
    }
    if (route === "/api/root/dashboard" && method === "GET") {
      requireRoot(user);
      return json(res, 200, { data: await store.rootDashboard() });
    }
    match = route.match(/^\/api\/root\/orders\/([^/]+)\/status$/);
    if (match && method === "PATCH") {
      requireRoot(user);
      const body = await requestBody(req);
      if (!STATUSES.includes(body.status))
        return json(res, 422, {
          error: { code: "INVALID_STATUS", message: "Недопустимый статус" },
        });
      const order = await store.updateOrderStatus(match[1], body.status);
      return order
        ? json(res, 200, { data: order })
        : json(res, 404, {
            error: { code: "NOT_FOUND", message: "Заказ не найден" },
          });
    }
    return json(res, 404, {
      error: { code: "NOT_FOUND", message: "Маршрут не найден" },
    });
  }
  function staticFile(res, url) {
    let relative = decodeURIComponent(url.pathname),
      file = path.normalize(path.join(publicDir, relative));
    if (
      relative === "/" ||
      !path.extname(relative) ||
      !file.startsWith(publicDir) ||
      !fs.existsSync(file)
    )
      file = path.join(publicDir, "index.html");
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control":
        path.extname(file) === ".html" ? "no-cache" : "public,max-age=3600",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'",
    });
    fs.createReadStream(file).pipe(res);
  }
  return async (req, res) => {
    const url = new URL(
      req.url,
      "http" + "://" + (req.headers.host ?? "localhost"),
    );
    try {
      url.pathname.startsWith("/api/")
        ? await api(req, res, url)
        : staticFile(res, url);
    } catch (error) {
      console.error(error);
      json(res, error.status ?? 500, {
        error: {
          code: error.code ?? "REQUEST_FAILED",
          message: error.message ?? "Ошибка сервера",
        },
      });
    }
  };
}
