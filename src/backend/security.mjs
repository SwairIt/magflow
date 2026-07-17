import crypto from "node:crypto";

export const uid = (prefix) =>
  `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
export const normalizeEmail = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();
export const sessionHash = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
export function validatePassword(password) {
  const value = String(password ?? "");
  if (
    value.length < 10 ||
    !/[A-ZА-ЯЁ]/.test(value) ||
    !/[a-zа-яё]/.test(value) ||
    !/\d/.test(value)
  ) {
    throw Object.assign(
      new Error(
        "Пароль должен содержать минимум 10 символов, цифру, строчную и заглавную букву",
      ),
      { status: 422, code: "WEAK_PASSWORD" },
    );
  }
  return value;
}
export function passwordRecord(
  password,
  salt = crypto.randomBytes(16).toString("hex"),
) {
  validatePassword(password);
  return {
    passwordSalt: salt,
    passwordHash: crypto.scryptSync(password, salt, 64).toString("hex"),
  };
}
export function verifyPassword(password, user) {
  try {
    const actual = crypto.scryptSync(
      String(password ?? ""),
      user.passwordSalt,
      64,
    );
    const expected = Buffer.from(user.passwordHash, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
export function publicUser(user) {
  return (
    user && {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? "",
      role: user.role ?? "customer",
      createdAt: user.createdAt,
    }
  );
}
export const sessionCookie = (token, secure = false) =>
  `magday_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure ? "; Secure" : ""}`;
export const clearSessionCookie = (secure) =>
  `magday_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
