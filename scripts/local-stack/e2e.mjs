// Tests de bout en bout dans un vrai navigateur (Chromium), contre la pile locale et `npm run dev` (catalogue de démonstration).
// Usage : cd scripts/local-stack && npm install && CHROMIUM_PATH=/chemin/chrome node e2e.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const B = "http://localhost:3000";
const SHOTS = process.env.SHOTS_DIR ?? new URL("./shots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });
const PWD = "Motdepasse-test-123";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "OK  " : "ÉCHEC"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function login(page, email) {
  await page.goto(`${B}/connexion`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", PWD);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30000 }), page.click("button:has-text('Se connecter')")]);
  await page.waitForLoadState("networkidle");
  await page.locator("main h1").first().waitFor({ timeout: 30000 });
}

try {
  // --- A. Particulier, mobile, sans compte -----------------------------------
  {
    const ctx = await browser.newContext(mobile);
    const page = await ctx.newPage();
    await page.goto(B, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SHOTS}01-accueil-mobile.png`, fullPage: true });
    check("Accueil : un seul H1", (await page.locator("h1").count()) === 1);

    await page.goto(`${B}/produit/savon-demo-a`, { waitUntil: "networkidle" });
    await page.selectOption("select", "2");
    await page.click("button:has-text('Ajouter au panier')");
    await page.waitForSelector("text=ajoutés au panier");
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    check("Fiche produit : données structurées Product avec prix DZD", ld.some((t) => t.includes('"Product"') && t.includes('"priceCurrency":"DZD"')));

    await page.goto(`${B}/produit/savon-demo-b`, { waitUntil: "networkidle" });
    await page.click("text=Grand format (fictif)");
    await page.selectOption("select", "5");
    await page.click("button:has-text('Ajouter au panier')");
    await page.waitForSelector("text=ajoutés au panier");
    check("Limite 5 / référence dans l'interface : bouton désactivé une fois 5 atteints", await page.locator("button:has-text('Ajouter au panier')").isDisabled());
    await page.screenshot({ path: `${SHOTS}02-fiche-produit-variantes.png`, fullPage: true });

    await page.goto(`${B}/produit/lait-de-chamelle-demo`, { waitUntil: "networkidle" });
    check("Produit « présentation uniquement » sans bouton d'achat", (await page.locator("button:has-text('Ajouter au panier')").count()) === 0);

    await page.goto(`${B}/panier`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Sous-total");
    await page.screenshot({ path: `${SHOTS}03-panier.png`, fullPage: true });
    await page.click("text=Passer la commande");
    await page.waitForURL(`${B}/commande`);
    await page.waitForLoadState("networkidle");

    // Un clic sans formulaire rempli ne doit pas être possible (livraison non choisie)
    check("Commande : bouton désactivé tant que la destination n'est pas choisie", await page.locator("button[type=submit]").isDisabled());
    await page.fill("input[autocomplete=given-name]", "Amina");
    await page.fill("input[autocomplete=family-name]", "Test");
    await page.fill("input[type=tel]", "0661 00 00 00");
    const selects = page.locator("form select");
    await selects.nth(0).selectOption("16");
    await page.waitForFunction(() => document.querySelectorAll("form select")[1]?.querySelectorAll("option").length > 5);
    const firstCommune = await selects.nth(1).locator("option").nth(1).getAttribute("value");
    await selects.nth(1).selectOption(firstCommune);
    await page.fill("textarea[autocomplete=street-address]", "12 rue des Dunes");
    await page.waitForSelector("text=Mode de livraison");
    await page.click("text=Domicile (démo)");
    await page.waitForFunction(() => !document.querySelector("button[type=submit]")?.disabled, null, { timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}04-commande-formulaire.png`, fullPage: true });
    // Double clic volontaire
    await page.locator("button[type=submit]").dblclick();
    await page.waitForURL(/\/commande\/confirmation\//, { timeout: 20000 });
    await page.waitForSelector("text=Merci, votre commande est enregistrée");
    const ref = (await page.locator("strong.font-mono").textContent())?.trim();
    check("Commande particulière sans compte confirmée", !!ref, ref);
    await page.screenshot({ path: `${SHOTS}05-confirmation.png`, fullPage: true });
    check("Panier vidé après commande", (await page.evaluate(() => localStorage.getItem("naaqati:panier:particulier:v1"))) === "[]");
    globalThis.retailRef = ref;
    await ctx.close();
  }

  // --- B. Accès protégés sans session -----------------------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${B}/revendeur`, { waitUntil: "networkidle" });
    check("Espace revendeur sans session → connexion", page.url().includes("/connexion"));
    await page.goto(`${B}/admin`, { waitUntil: "networkidle" });
    check("Administration sans session → connexion", page.url().includes("/connexion"));
    const res = await page.request.get(`${B}/admin/commandes/export`);
    check("Export CSV sans session refusé", res.status() === 403 || (await res.text()).includes("Connexion"), String(res.status()));
    await ctx.close();
  }

  // --- C. Revendeur Algérie ---------------------------------------------------
  let dzRef;
  {
    const ctx = await browser.newContext(mobile);
    const page = await ctx.newPage();
    await login(page, "dz@test.local");
    check("Revendeur DZ redirigé vers son catalogue", page.url().endsWith("/revendeur"));
    const html = await page.content();
    check("Revendeur DZ : prix publics DZD affichés", (await page.locator("table").first().innerText()).includes("DZD"));
    check("Revendeur DZ : aucun tarif France dans le HTML", !html.includes("EUR"));
    await page.fill('input[aria-label="Quantité pour Savon démo A"]', "25");
    await page.fill('input[aria-label="Quantité pour Savon démo B Grand format (fictif)"]', "12");
    await page.click("button:has-text('Ajouter au panier')");
    await page.waitForSelector("text=ajoutés au panier");
    await page.screenshot({ path: `${SHOTS}06-revendeur-catalogue.png`, fullPage: true });
    await page.goto(`${B}/revendeur/panier`, { waitUntil: "networkidle" });
    await page.fill("#contact", "Boutique test DZ");
    await page.fill("#phone", "0770 00 00 00");
    const selects = page.locator("form select");
    await selects.nth(0).selectOption("31");
    await page.waitForFunction(() => document.querySelectorAll("form select")[1]?.querySelectorAll("option").length > 5);
    await selects.nth(1).selectOption(await selects.nth(1).locator("option").nth(1).getAttribute("value"));
    await page.fill("#addr", "Zone d'activité, lot 4");
    await page.waitForSelector("text=Colisage calculé");
    const packingTitle = await page.locator("#colisage").textContent();
    check("Colisage affiché (25 A + 12 B → 3 cartons de 10 max par SKU)", /[3-9] cartons/.test(packingTitle ?? ""), packingTitle);
    await page.waitForFunction(() => !document.querySelector("button[type=submit]")?.disabled, null, { timeout: 15000 });
    await page.screenshot({ path: `${SHOTS}07-revendeur-panier-colisage.png`, fullPage: true });
    await page.click("button[type=submit]");
    await page.waitForURL(/\/revendeur\/commandes\/NQ-/, { timeout: 20000 });
    dzRef = page.url().split("/").pop().split("?")[0];
    check("Commande revendeur DZ enregistrée (au-delà de 5 unités)", !!dzRef, dzRef);
    await ctx.close();
  }

  // --- D. Un autre revendeur ne voit pas cette commande ------------------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "dz2@test.local");
    const res = await page.goto(`${B}/revendeur/commandes/${dzRef}`, { waitUntil: "networkidle" });
    const bodyB = await page.locator("body").innerText();
    check("Revendeur B : commande du revendeur A introuvable (page « introuvable », aucune donnée)", bodyB.includes("Page introuvable") && !bodyB.includes(dzRef), `HTTP ${res.status()} (rendu en streaming)`);
    await page.goto(`${B}/revendeur/commandes`, { waitUntil: "networkidle" });
    check("Revendeur B : liste vide", (await page.content()).includes("Aucune commande"));
    const admin = await page.goto(`${B}/admin`, { waitUntil: "networkidle" });
    check("Revendeur : pas d'accès à l'administration", page.url().includes("erreur=acces"), String(admin.status()));
    await ctx.close();
  }

  // --- E. Administration --------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await login(page, "admin@test.local");
    check("Admin redirigé vers le tableau de bord", page.url().endsWith("/admin"));
    await page.screenshot({ path: `${SHOTS}08-admin-tableau-de-bord.png`, fullPage: true });

    await page.goto(`${B}/admin/parametres`, { waitUntil: "networkidle" });
    await page.fill("#cur", "EUR");
    await page.click("button:has-text('Enregistrer les paramètres')");
    await page.waitForSelector("text=Paramètres enregistrés");
    // Tentative d'ouverture des commandes France sans conditions → refus
    await page.check("#open");
    await page.click("button:has-text('Enregistrer les paramètres')");
    await page.waitForSelector("text=Impossible d'ouvrir les commandes France");
    check("Ouverture des commandes France refusée sans conditions complètes", true);

    await page.goto(`${B}/admin/tarifs-france`, { waitUntil: "networkidle" });
    await page.fill('input[name="prix:DEMO-SAV-A"]', "4,50");
    await page.click("button:has-text('Enregistrer les tarifs')");
    await page.waitForSelector("text=Tarifs enregistrés");

    await page.goto(`${B}/admin/commandes?q=${dzRef}`, { waitUntil: "networkidle" });
    await page.click(`a:has-text("${dzRef}")`);
    await page.waitForSelector("text=Colisage");
    await page.selectOption("#status", "confirmee");
    await page.click("button:has-text('Enregistrer') >> nth=0");
    await page.waitForSelector("text=Statut mis à jour");
    await page.fill("#tracking_number", "SUIVI-TEST-001");
    await page.fill("#carton_index", "1");
    await page.click("button:has-text('Ajouter')");
    await page.waitForSelector("text=Suivi ajouté");
    // Ajustement de colisage invalide (11 unités d'un SKU dans un carton)
    await page.fill("#plan", "DEMO-SAV-A:11, DEMO-SAV-B-L:2\nDEMO-SAV-A:14, DEMO-SAV-B-L:10");
    await page.click("button:has-text('Vérifier et enregistrer')");
    await page.waitForSelector("text=Répartition refusée");
    check("Ajustement de colisage invalide refusé", true);
    await page.fill("#plan", "DEMO-SAV-A:10, DEMO-SAV-B-L:2\nDEMO-SAV-A:10, DEMO-SAV-B-L:10\nDEMO-SAV-A:5");
    await page.click("button:has-text('Vérifier et enregistrer')");
    await page.waitForSelector("text=Répartition validée");
    check("Ajustement de colisage valide enregistré", true);
    await page.screenshot({ path: `${SHOTS}09-admin-commande.png`, fullPage: true });

    const csv = await page.request.get(`${B}/admin/commandes/export?q=${dzRef}`);
    const text = await csv.text();
    check("Export CSV générique (une ligne par article et par carton)", csv.status() === 200 && text.includes(dzRef) && text.split("\r\n").length >= 5, `${text.split("\r\n").length - 1} lignes`);

    await page.goto(`${B}/admin/livraison`, { waitUntil: "networkidle" });
    await page.screenshot({ path: `${SHOTS}10-admin-livraison.png`, fullPage: false });
    await ctx.close();
  }

  // --- F. Revendeur France ---------------------------------------------------------
  {
    const ctx = await browser.newContext(mobile);
    const page = await ctx.newPage();
    await login(page, "fr@test.local");
    const html = await page.content();
    check("Revendeur FR : tarif France affiché", html.includes("4,50") && html.includes("EUR"));
    check("Revendeur FR : référence sans tarif signalée", html.includes("Tarif non configuré"));
    await page.fill('input[aria-label="Quantité pour Savon démo A"]', "30");
    await page.click("button:has-text('Ajouter au panier')");
    await page.goto(`${B}/revendeur/panier`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=Commande ferme pas encore possible");
    check("Revendeur FR : panier préparé mais commande ferme bloquée", await page.locator("button[type=submit]").isDisabled());
    await page.screenshot({ path: `${SHOTS}11-revendeur-france-panier.png`, fullPage: true });
    await ctx.close();
  }

  // --- G. Le tarif France n'apparaît pas pour le revendeur DZ ni publiquement ------------
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page, "dz@test.local");
    check("Revendeur DZ : toujours aucun tarif France", !(await page.content()).includes("4,50"));
    await ctx.close();
    const anon = await browser.newContext();
    const p2 = await anon.newPage();
    await p2.goto(`${B}/produit/savon-demo-a`, { waitUntil: "networkidle" });
    check("Fiche publique : aucun tarif France", !(await p2.content()).includes("4,50"));
    await anon.close();
  }
} catch (err) {
  check("Exécution du scénario", false, String(err).slice(0, 400));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
process.exit(failed.length ? 1 : 0);
