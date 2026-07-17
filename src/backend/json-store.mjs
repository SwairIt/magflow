import fs from "node:fs";
import { uid, normalizeEmail, passwordRecord } from "./security.mjs";
export class JsonStore {
  constructor(catalogFile, runtimeFile) {
    this.catalogFile = catalogFile;
    this.runtimeFile = runtimeFile || catalogFile + ".runtime";
  }
  catalog() {
    return JSON.parse(fs.readFileSync(this.catalogFile, "utf8"));
  }
  read() {
    if (!fs.existsSync(this.runtimeFile))
      return { users: [], sessions: [], orders: [], leads: [] };
    return JSON.parse(fs.readFileSync(this.runtimeFile, "utf8"));
  }
  write(db) {
    const t = this.runtimeFile + ".tmp";
    fs.writeFileSync(t, JSON.stringify(db, null, 2));
    fs.renameSync(t, this.runtimeFile);
  }
  async init({ rootEmail, rootPassword }) {
    const db = this.read();
    if (rootEmail && rootPassword && !db.users.some((x) => x.role === "root"))
      db.users.push({
        id: uid("root"),
        name: "Root",
        email: normalizeEmail(rootEmail),
        phone: "",
        role: "root",
        ...passwordRecord(rootPassword),
        createdAt: new Date().toISOString(),
      });
    this.write(db);
  }
  async products({ q = "", category = "" } = {}) {
    let x = this.catalog().products;
    if (q)
      x = x.filter((v) =>
        (v.name + " " + v.description).toLowerCase().includes(q.toLowerCase()),
      );
    if (category) x = x.filter((v) => v.category === category);
    return x;
  }
  async product(id) {
    return (
      this.catalog().products.find((v) => v.id === id || v.slug === id) || null
    );
  }
  async collections() {
    return this.catalog().collections;
  }
  async collection(k) {
    return this.catalog().collections[k] || null;
  }
  async page(k) {
    return this.catalog().pages[String(k).toLowerCase()] || null;
  }
  async findUserByEmail(e) {
    return this.read().users.find((x) => x.email === normalizeEmail(e)) || null;
  }
  async createUser(u) {
    const d = this.read();
    if (d.users.some((x) => x.email === u.email))
      throw Object.assign(Error("Этот email уже зарегистрирован"), {
        status: 409,
        code: "EMAIL_EXISTS",
      });
    d.users.push(u);
    this.write(d);
    return u;
  }
  async createSession(s) {
    const d = this.read();
    d.sessions = d.sessions.filter((x) => new Date(x.expiresAt) > new Date());
    d.sessions.push(s);
    this.write(d);
  }
  async userBySession(h) {
    const d = this.read(),
      s = d.sessions.find(
        (x) => x.tokenHash === h && new Date(x.expiresAt) > new Date(),
      );
    return s ? d.users.find((x) => x.id === s.userId) || null : null;
  }
  async deleteSession(h) {
    const d = this.read();
    d.sessions = d.sessions.filter((x) => x.tokenHash !== h);
    this.write(d);
  }
  async createOrder(o) {
    const d = this.read();
    d.orders.unshift(o);
    this.write(d);
    return o;
  }
  async ordersFor(u) {
    return this.read().orders.filter(
      (x) => x.userId === u.id || x.email === u.email,
    );
  }
  async createLead(l) {
    const d = this.read();
    d.leads.unshift(l);
    this.write(d);
    return l;
  }
  async rootDashboard() {
    const d = this.read();
    return {
      stats: {
        orders: d.orders.length,
        customers: d.users.filter((x) => x.role !== "root").length,
        leads: d.leads.length,
        revenue: d.orders
          .filter((x) => x.status !== "Отменён")
          .reduce((a, x) => a + x.total, 0),
      },
      orders: d.orders,
      users: d.users.map(({ passwordHash, passwordSalt, ...u }) => u),
      leads: d.leads,
    };
  }
  async updateOrderStatus(id, status) {
    const d = this.read(),
      o = d.orders.find((x) => x.id === id);
    if (!o) return null;
    o.status = status;
    o.updatedAt = new Date().toISOString();
    this.write(d);
    return o;
  }
}
