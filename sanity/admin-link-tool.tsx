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
    </div>
  );
}

export const adminLinkTool: Tool = {
  name: "tableau-de-bord",
  title: "Commandes & revendeurs",
  component: AdminLink,
};
