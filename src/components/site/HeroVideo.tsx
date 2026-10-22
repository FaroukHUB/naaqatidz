"use client";

import { useEffect, useRef, useState } from "react";
import type { VideoView } from "@/lib/catalog/types";

/**
 * Vidéo de fond de l'en-tête : version paysage sur ordinateur, portrait sur téléphone.
 * La source est choisie côté navigateur pour ne télécharger qu'une seule vidéo ; rien n'est
 * lu si le visiteur a demandé à réduire les animations (l'image d'attente reste affichée).
 */
export function HeroVideo({ desktop, mobile, poster }: { desktop: VideoView | null; mobile: VideoView | null; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<VideoView | null>(null);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pick = () => setSource(reduced.matches ? null : wide.matches ? (desktop ?? mobile) : (mobile ?? desktop));
    pick();
    wide.addEventListener("change", pick);
    reduced.addEventListener("change", pick);
    return () => {
      wide.removeEventListener("change", pick);
      reduced.removeEventListener("change", pick);
    };
  }, [desktop, mobile]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    video.load();
    // La lecture automatique peut être refusée (mode économie d'énergie) : l'image d'attente reste visible.
    video.play().catch(() => {});
  }, [source]);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover"
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
    >
      {source && <source src={source.url} type={source.mimeType} />}
    </video>
  );
}
