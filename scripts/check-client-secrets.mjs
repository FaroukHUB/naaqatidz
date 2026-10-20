#!/usr/bin/env node
/**
 * Vérifie qu'aucun secret ni nom de variable secrète ne se retrouve dans les fichiers servis au navigateur
 * (.next/static) après `next build`. Vérifie aussi les valeurs réelles si elles sont définies dans l'environnement.
 * Usage : npm run build && npm run check:secrets
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = ".next/static";
if (!existsSync(dir)) {
  console.error("Aucun build trouvé : lancez d'abord `npm run build`.");
  process.exit(1);
}

const SECRET_NAMES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ORDER_TOKEN_SECRET", "SANITY_REVALIDATE_SECRET", "SANITY_API_TOKEN"];
const PATTERNS = [/sb_secret_[A-Za-z0-9_-]{10,}/, /"role"\s*:\s*"service_role"/, /createServiceClient/, /reseller_prices/, /get_order_confirmation/];
const values = SECRET_NAMES.map((n) => process.env[n]).filter((v) => v && v.length >= 8);

function* walk(d) {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(js|css|html|json|txt|map)$/.test(name)) yield p;
  }
}

const problems = [];
let files = 0;
for (const file of walk(dir)) {
  files++;
  const text = readFileSync(file, "utf8");
  for (const name of SECRET_NAMES) if (text.includes(name)) problems.push(`${file} : nom de variable secrète « ${name} »`);
  for (const re of PATTERNS) if (re.test(text)) problems.push(`${file} : motif interdit ${re}`);
  for (const v of values) if (text.includes(v)) problems.push(`${file} : valeur d'un secret présente`);
}

if (problems.length) {
  console.error("Secrets ou code serveur détectés dans les fichiers publics :\n" + problems.join("\n"));
  process.exit(1);
}
console.log(`OK : ${files} fichiers publics analysés, aucun secret ni code d'accès privé détecté.`);
