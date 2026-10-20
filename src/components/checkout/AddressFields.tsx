"use client";

import { useEffect, useId, useState } from "react";

export interface WilayaOption {
  code: string;
  name: string;
}

export function AddressFields({
  wilayas,
  wilayaCode,
  communeCode,
  onChange,
  errors,
}: {
  wilayas: WilayaOption[];
  wilayaCode: string;
  communeCode: string;
  onChange: (v: { wilayaCode: string; communeCode: string }) => void;
  errors?: Record<string, string>;
}) {
  const [communes, setCommunes] = useState<{ code: string; name: string }[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const wId = useId();
  const cId = useId();

  useEffect(() => {
    if (!wilayaCode) return;
    let cancelled = false;
    fetch(`/api/geo/communes?wilaya=${wilayaCode}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { communes: { code: string; name: string }[] }) => {
        if (cancelled) return;
        setLoadError(null);
        setCommunes([...d.communes].sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" })));
      })
      .catch(() => !cancelled && setLoadError("Impossible de charger les communes."));
    return () => {
      cancelled = true;
    };
  }, [wilayaCode]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor={wId} className="field-label">Wilaya *</label>
        <select
          id={wId}
          className="field"
          value={wilayaCode}
          required
          aria-invalid={!!errors?.["address.wilayaCode"]}
          onChange={(e) => onChange({ wilayaCode: e.target.value, communeCode: "" })}
        >
          <option value="">Choisir…</option>
          {wilayas.map((w) => (
            <option key={w.code} value={w.code}>{w.code} — {w.name}</option>
          ))}
        </select>
        {errors?.["address.wilayaCode"] && <p className="field-error">{errors["address.wilayaCode"]}</p>}
      </div>
      <div>
        <label htmlFor={cId} className="field-label">Commune *</label>
        <select
          id={cId}
          className="field"
          value={communeCode}
          required
          disabled={!wilayaCode || communes.length === 0}
          aria-invalid={!!errors?.["address.communeCode"]}
          onChange={(e) => onChange({ wilayaCode, communeCode: e.target.value })}
        >
          <option value="">{wilayaCode ? "Choisir…" : "Choisissez d'abord la wilaya"}</option>
          {wilayaCode && communes.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
        {(errors?.["address.communeCode"] || loadError) && <p className="field-error">{errors?.["address.communeCode"] ?? loadError}</p>}
      </div>
    </div>
  );
}
