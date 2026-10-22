"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ImageView, VideoView } from "@/lib/catalog/types";
import { SiteImage } from "@/components/ui/SiteImage";
import { Dunes } from "@/components/brand/Decor";

/**
 * En-tête vidéo de la page d'accueil.
 * - Une seule vidéo est téléchargée, choisie selon l'écran ; aucune si une photo la remplace sur ordinateur
 *   ou si le visiteur a demandé à réduire les animations (l'image d'attente reste affichée).
 * - Sur téléphone, la mise en page suit le format réel de la vidéo : verticale → plein écran, texte en bas ;
 *   horizontale → vidéo entière (16:9), texte dessous. Le format est lu dans la vidéo elle-même,
 *   quel que soit le champ du Studio où elle a été déposée.
 */
export function HeroVideoSection({ desktop, mobile, poster, desktopImage, children }: {
  desktop: VideoView | null;
  mobile: VideoView | null;
  poster: string | null;
  desktopImage: ImageView | null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState<VideoView | null>(null);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pick = () => setSource(reduced.matches || (wide.matches && desktopImage) ? null : wide.matches ? (desktop ?? mobile) : (mobile ?? desktop));
    pick();
    wide.addEventListener("change", pick);
    reduced.addEventListener("change", pick);
    return () => {
      wide.removeEventListener("change", pick);
      reduced.removeEventListener("change", pick);
    };
  }, [desktop, mobile, desktopImage]);

  useEffect(() => {
    const video = ref.current;
    if (!video || !source) return;
    video.load();
    // La lecture automatique peut être refusée (mode économie d'énergie) : l'image d'attente reste visible.
    video.play().catch(() => {});
  }, [source]);

  return (
    <section className={`relative isolate overflow-hidden bg-ilaji text-white md:flex md:aspect-video md:min-h-0 ${portrait ? "flex min-h-[88svh]" : ""}`}>
      <div className={portrait ? "absolute inset-0" : "relative aspect-video w-full md:absolute md:inset-0 md:aspect-auto"}>
        <video
          ref={ref}
          className={`absolute inset-0 h-full w-full object-cover ${desktopImage ? "md:hidden" : ""}`}
          poster={poster ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onLoadedMetadata={(e) => setPortrait(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
        >
          {source && <source src={source.url} type={source.mimeType} />}
        </video>
        {desktopImage && <SiteImage image={desktopImage} sizes="100vw" className="absolute inset-0 hidden h-full w-full object-cover md:block" />}
        {/* Voile pour la lisibilité : par le bas (vidéo verticale sur téléphone), par la gauche sur ordinateur */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 md:block md:bg-gradient-to-r md:from-ilaji/80 md:from-10% md:via-ilaji/30 md:via-45% md:to-transparent md:to-70% ${portrait ? "bg-gradient-to-t from-ilaji/90 via-ilaji/35 to-transparent" : "hidden"}`}
        />
      </div>
      <div className={`container-page relative z-10 flex w-full md:items-center md:py-16 ${portrait ? "items-end pb-24 pt-24" : "pb-20 pt-8"}`}>
        {children}
      </div>
      <Dunes className="absolute inset-x-0 bottom-0 z-10 h-14 w-full md:h-20" />
    </section>
  );
}
