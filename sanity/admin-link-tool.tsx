import type { Tool } from "sanity";

function AdminLink() {
  return (
    <div style={{ padding: "2rem", maxWidth: 640, fontFamily: "inherit", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Commandes, revendeurs et livraison</h1>
      <p>
        Le catalogue, les prix publics, les photos et les textes se gèrent ici, dans le Studio.
        Les commandes, les comptes revendeurs, les tarifs revendeurs France, la livraison et le colisage se gèrent dans le
        tableau de bord protégé.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <a href="/admin" style={{ display: "inline-block", padding: "0.75rem 1.25rem", background: "#6B440A", color: "#fff", borderRadius: 6, textDecoration: "none" }}>
          Ouvrir le tableau de bord
        </a>
      </p>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem", opacity: 0.75 }}>
        Le tableau de bord demande la connexion avec votre compte administrateur du site (email et mot de passe du site,
        différents de votre compte Sanity). Une fois connecté, vous le restez.
      </p>
    </div>
  );
}

export const adminLinkTool: Tool = {
  name: "tableau-de-bord",
  title: "Commandes & revendeurs",
  component: AdminLink,
};
