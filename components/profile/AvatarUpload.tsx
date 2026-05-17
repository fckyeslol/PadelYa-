"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  currentUrl?: string | null;
  fullName: string;
}

function initials(name: string) {
  if (name.includes("@")) return name[0].toUpperCase();
  const parts = name.trim().split(/\s+/);
  const f = parts[0]?.[0]?.toUpperCase() ?? "";
  const l = parts.length > 1 ? (parts[parts.length - 1][0]?.toUpperCase() ?? "") : "";
  return f + l || "?";
}

export function AvatarUpload({ userId, currentUrl, fullName }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Solo se aceptan imágenes (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("La imagen debe pesar menos de 3 MB.");
      return;
    }

    setError(null);
    setUploading(true);

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const supabase = getSupabaseBrowserClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);

      // Add cache-busting so the browser doesn't show the old photo
      const busted = `${publicUrl}?t=${Date.now()}`;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: busted })
        .eq("id", userId);

      if (profileErr) throw profileErr;

      setPreview(busted);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir la imagen.");
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      {/* Avatar circle — clickable */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          position: "relative",
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          border: "2px solid var(--border)",
          background: "var(--surface)",
          cursor: uploading ? "wait" : "pointer",
          overflow: "hidden",
          padding: 0,
          flexShrink: 0,
          transition: "border-color 0.15s",
        }}
        className="hover:border-[var(--primary)]"
        title="Cambiar foto"
      >
        {preview ? (
          <Image
            src={preview}
            alt={fullName}
            fill
            style={{ objectFit: "cover" }}
          />
        ) : (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              background: "var(--primary)",
              color: "#ffffff",
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {initials(fullName)}
          </span>
        )}

        {/* Upload overlay */}
        <span
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: uploading ? 1 : 0,
            transition: "opacity 0.15s",
          }}
          className="group-hover:opacity-100"
        >
          {uploading ? (
            <SpinIcon />
          ) : (
            <CameraIcon />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          background: "none",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "0.3rem 0.875rem",
          fontSize: "0.8rem",
          fontWeight: 500,
          color: "var(--text-2)",
          fontFamily: "var(--font-dm-sans)",
          cursor: uploading ? "wait" : "pointer",
          transition: "border-color 0.15s, color 0.15s",
        }}
        className="hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        {uploading ? "Subiendo..." : "Cambiar foto"}
      </button>

      {error && (
        <p style={{ fontSize: "0.78rem", color: "var(--danger)", fontFamily: "var(--font-dm-sans)", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <circle cx="12" cy="13" r="3" stroke="white" strokeWidth={2} />
    </svg>
  );
}

function SpinIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} style={{ animation: "spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path strokeLinecap="round" d="M12 3a9 9 0 109 9" />
    </svg>
  );
}
