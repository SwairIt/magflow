import fs from "node:fs/promises";
import { uid, normalizeEmail, passwordRecord } from "./security.mjs";
export class MariaDbStore {
  constructor(pool, catalog, schemaFile) {
    this.pool = pool;
    this.catalog = catalog;
    this.schemaFile = schemaFile;
  }
  static async connect(c) {
    const mysql = await import("mysql2/promise");
    const transport = c.socketPath
      ? { socketPath: c.socketPath }
      : { host: c.host, port: Number(c.port || 3306) };
    const pool = mysql.createPool({
      ...transport,
      user: c.user,
      password: c.password,
      database: c.database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      charset: "utf8mb4",
    });
    const catalog = JSON.parse(await fs.readFile(c.catalogFile, "utf8"));
    const store = new MariaDbStore(pool, catalog, c.schemaFile);
    await store.init(c);
    return store;
  }
  async init({ rootEmail, rootPassword }) {
    const sql = await fs.readFile(this.schemaFile, "utf8");
    for (const q of sql
      .split(/;\s*(?:\n|$)/)
      .map((x) => x.trim())
      .filter(Boolean))
      await this.pool.query(q);
    const [rows] = await this.pool.execute(
      "SELECT id FROM users WHERE role='root' LIMIT 1",
    );
    if (!rows.length) {
      const r = passwordRecord(rootPassword);
      await this.pool.execute(
        "INSERT INTO users (id,name,email,phone,role,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?,NOW())",
        [
          uid("root"),
          "Root",
          normalizeEmail(rootEmail),
          "",
          "root",
          r.passwordHash,
          r.passwordSalt,
        ],
      );
    }
  }
  async products({ q = "", category = "" } = {}) {
    let x = this.catalog.products;
    if (q)
      x = x.filter((v) =>
        (v.name + " " + v.description).toLowerCase().includes(q.toLowerCase()),
      );
    if (category) x = x.filter((v) => v.category === category);
    return x;
  }
  async product(id) {
    return (
      this.catalog.products.find((v) => v.id === id || v.slug === id) || null
    );
  }
  async collections() {
    return this.catalog.collections;
  }
  async collection(k) {
    return this.catalog.collections[k] || null;
  }
  async page(k) {
    return this.catalog.pages[String(k).toLowerCase()] || null;
  }
  mapUser(r) {
    return (
      r && {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        role: r.role,
        passwordHash: r.password_hash,
        passwordSalt: r.password_salt,
        createdAt: new Date(r.created_at).toISOString(),
      }
    );
  }
  async findUserByEmail(e) {
    const [r] = await this.pool.execute(
      "SELECT * FROM users WHERE email=? LIMIT 1",
      [normalizeEmail(e)],
    );
    return this.mapUser(r[0]);
  }
  async createUser(u) {
    try {
      await this.pool.execute(
        "INSERT INTO users (id,name,email,phone,role,password_hash,password_salt,created_at) VALUES (?,?,?,?,?,?,?,?)",
        [
          u.id,
          u.name,
          u.email,
          u.phone,
          u.role,
          u.passwordHash,
          u.passwordSalt,
          u.createdAt,
        ],
      );
      return u;
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY")
        throw Object.assign(Error("Этот email уже зарегистрирован"), {
          status: 409,
          code: "EMAIL_EXISTS",
        });
      throw e;
    }
  }
  async createSession(s) {
    await this.pool.execute(
      "INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,NOW())",
      [s.tokenHash, s.userId, s.expiresAt],
    );
  }
  async userBySession(h) {
    const [r] = await this.pool.execute(
      "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>NOW() LIMIT 1",
      [h],
    );
    return this.mapUser(r[0]);
  }
  async deleteSession(h) {
    await this.pool.execute("DELETE FROM sessions WHERE token_hash=?", [h]);
  }
  async createOrder(o) {
    const c = await this.pool.getConnection();
    try {
      await c.beginTransaction();
      await c.execute(
        "INSERT INTO orders(id,user_id,customer_name,phone,email,address,comment,delivery,payment,total,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          o.id,
          o.userId,
          o.name,
          o.phone,
          o.email,
          o.address,
          o.comment,
          o.delivery,
          o.payment,
          o.total,
          o.status,
          o.createdAt,
        ],
      );
      for (const i of o.items)
        await c.execute(
          "INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES(?,?,?,?,?)",
          [o.id, i.id, i.name, i.price, i.qty],
        );
      await c.commit();
      return o;
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }
  async orderRows(w = "", p = []) {
    const [r] = await this.pool.execute(
      `SELECT o.*,JSON_ARRAYAGG(JSON_OBJECT('id',i.product_id,'name',i.name,'price',i.price,'qty',i.quantity)) items FROM orders o JOIN order_items i ON i.order_id=o.id ${w} GROUP BY o.id ORDER BY o.created_at DESC`,
      p,
    );
    return r.map((x) => ({
      id: x.id,
      userId: x.user_id,
      name: x.customer_name,
      phone: x.phone,
      email: x.email,
      address: x.address,
      comment: x.comment,
      delivery: x.delivery,
      payment: x.payment,
      total: Number(x.total),
      status: x.status,
      createdAt: new Date(x.created_at).toISOString(),
      items: typeof x.items === "string" ? JSON.parse(x.items) : x.items,
    }));
  }
  async ordersFor(u) {
    return this.orderRows("WHERE o.user_id=? OR o.email=?", [u.id, u.email]);
  }
  async createLead(l) {
    await this.pool.execute(
      "INSERT INTO leads(id,name,phone,email,message,source,created_at) VALUES(?,?,?,?,?,?,?)",
      [
        l.id,
        l.name || "",
        l.phone,
        l.email || "",
        l.message || "",
        l.source || "",
        l.createdAt,
      ],
    );
    return l;
  }
  async rootDashboard() {
    const [s] = await this.pool.query(
      "SELECT(SELECT COUNT(*) FROM orders)orders,(SELECT COUNT(*) FROM users WHERE role<>'root')customers,(SELECT COUNT(*) FROM leads)leads,(SELECT COALESCE(SUM(total),0) FROM orders WHERE status<>'Отменён')revenue",
    );
    const orders = await this.orderRows();
    const [users] = await this.pool.query(
      "SELECT id,name,email,phone,role,created_at createdAt FROM users ORDER BY created_at DESC",
    );
    const [leads] = await this.pool.query(
      "SELECT * FROM leads ORDER BY created_at DESC",
    );
    return {
      stats: { ...s[0], revenue: Number(s[0].revenue) },
      orders,
      users,
      leads,
    };
  }
  async updateOrderStatus(id, status) {
    const [r] = await this.pool.execute(
      "UPDATE orders SET status=?,updated_at=NOW() WHERE id=?",
      [status, id],
    );
    return r.affectedRows
      ? (await this.orderRows("WHERE o.id=?", [id]))[0]
      : null;
  }
}
