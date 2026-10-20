import { createHmac } from "node:crypto";
const secret = "super-secret-jwt-token-with-at-least-32-characters-long";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload) => {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64(payload);
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
};
const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 30;
console.log(`JWT_SECRET=${secret}`);
console.log(`ANON_KEY=${sign({ role: "anon", iss: "supabase", exp })}`);
console.log(`SERVICE_KEY=${sign({ role: "service_role", iss: "supabase", exp })}`);
