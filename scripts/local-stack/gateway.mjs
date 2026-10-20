// Passerelle minimale imitant Kong de Supabase : /auth/v1 → Auth (9999), /rest/v1 → PostgREST (3001).
import http from "node:http";
const routes = [["/auth/v1", 9999], ["/rest/v1", 3001]];
http.createServer((req, res) => {
  const r = routes.find(([p]) => req.url.startsWith(p));
  if (!r) { res.writeHead(404); return res.end("no route"); }
  const path = req.url.slice(r[0].length) || "/";
  const headers = { ...req.headers, host: `127.0.0.1:${r[1]}` };
  const up = http.request({ host: "127.0.0.1", port: r[1], path, method: req.method, headers }, (u) => {
    res.writeHead(u.statusCode, u.headers); u.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(54321, "127.0.0.1", () => console.log("gateway on 54321"));
