import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHandler } from "./src/backend/app.mjs";
import { JsonStore } from "./src/backend/json-store.mjs";
import { MariaDbStore } from "./src/backend/mariadb-store.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
const driver = process.env.DB_DRIVER || "mariadb";
const config = {
  port: Number(process.env.PORT || 4180),
  rootEmail: process.env.ROOT_EMAIL,
  rootPassword: process.env.ROOT_PASSWORD,
  socketPath: process.env.DB_SOCKET,
  host: process.env.DB_HOST || "127.0.0.1",
  portDb: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  catalogFile: path.join(root, "data", "db.json"),
  runtimeFile: path.join(root, "data", "runtime.json"),
  schemaFile: path.join(root, "infra", "mariadb", "001_schema.sql"),
};
if (driver === "mariadb") {
  for (const key of [
    "user",
    "password",
    "database",
    "rootEmail",
    "rootPassword",
  ])
    if (!config[key])
      throw new Error(`Missing required ENV for MariaDB: ${key}`);
}
const store =
  driver === "mariadb"
    ? await MariaDbStore.connect({ ...config, port: config.portDb })
    : new JsonStore(config.catalogFile, config.runtimeFile);
if (driver !== "mariadb") await store.init(config);
http
  .createServer(createHandler({ store, publicDir: path.join(root, "public") }))
  .listen(config.port, "127.0.0.1", () =>
    console.log(
      `MAGDAY production on 127.0.0.1:${config.port}; DB=${driver}${config.socketPath ? " via unix socket" : ""}`,
    ),
  );
