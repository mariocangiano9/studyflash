"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import ModificaModal, { ModificaData } from "./ModificaModal";

interface FlashcardItemProps {
  id: string;
  titolo: string;
  testo: string;
  tag?: string[] | null;
  difficolta: "facile" | "media" | "difficile";
  materia: string;
  dispensaId?: string;
  inizialmenteImportante?: boolean;
  imageUrl?: string | null;
  onDeleted?: (id: string) => void;
}

const coloriDifficolta = {
  facile: "bg-green-100 text-green-700",
  media: "bg-amber-100 text-amber-700",
  difficile: "bg-red-100 text-red-700",
};

const coloriMateria = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

function materiaColor(materia: string) {
  let hash = 0;
  for (let i = 0; i < materia.length; i++) {
    hash = materia.charCodeAt(i) + ((hash << 5) - hash);
  }
  return coloriMateria[Math.abs(hash) % coloriMateria.length];
}

const gradients = [
  "from-blue-400 to-indigo-500",
  "from-violet-400 to-purple-500",
  "from-rose-400 to-pink-500",
  "from-teal-400 to-emerald-500",
  "from-amber-400 to-orange-500",
];

const emojiMap: Record<string, string> = {
  diritto: "\u2696\uFE0F", economia: "\uD83D\uDCB0", medicina: "\uD83E\uDE7A", biologia: "\uD83E\uDDEC",
  storia: "\uD83C\uDFDB\uFE0F", filosofia: "\uD83E\uDD14", matematica: "\uD83D\uDCCF", fisica: "\u269B\uFE0F",
  chimica: "\uD83E\uDDEA", informatica: "\uD83D\uDCBB", letteratura: "\uD83D\uDCDA", psicologia: "\uD83E\uDDE0",
};

function getMateriaEmoji(materia: string): string {
  const lower = materia.toLowerCase();
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lower.includes(key)) return emoji;
  }
  return "\uD83D\uDCD6";
}

function getMateriaGradient(materia: string): string {
  let hash = 0;
  for (let i = 0; i < materia.length; i++) {
    hash = materia.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

export default function FlashcardItem({
  id,
  titolo,
  testo,
  tag,
  difficolta,
  materia,
  dispensaId,
  inizialmenteImportante = false,
  imageUrl,
  onDeleted,
}: FlashcardItemProps) {
  const [imgError, setImgError] = useState(false);
  const [importante, setImportante] = useState(inizialmenteImportante);
  const [modalOpen, setModalOpen] = useState(false);
  const [removed, setRemoved] = useState(false);

  const [display, setDisplay] = useState({
    titolo,
    testo,
    imageUrl: imageUrl || null,
    materia,
    difficolta,
    tag: tag || [],
  });

  useEffect(() => {
    setDisplay({
      titolo,
      testo,
      imageUrl: imageUrl || null,
      materia,
      difficolta,
      tag: tag || [],
    });
  }, [titolo, testo, materia, difficolta, imageUrl, tag]);

  const apiBase = dispensaId ? `/api/flashcard/${dispensaId}/${id}` : null;

  const toggleImportante = () => {
    const next = !importante;
    setImportante(next);
    if (apiBase) {
      fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importante: next }),
      }).catch(() => setImportante(!next));
    }
  };

  const handleSaved = (updated: ModificaData) => {
    setDisplay({
      ...display,
      titolo: updated.titolo,
      testo: updated.testo,
      imageUrl: updated.imageUrl || null,
      difficolta: updated.difficolta,
      tag: updated.tag.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setImgError(false);
    setModalOpen(false);
  };

  const handleDeleted = () => {
    setModalOpen(false);
    setRemoved(true);
    setTimeout(() => onDeleted?.(id), 300);
  };

  if (removed) {
    return <div className="transition-all duration-300 opacity-0 scale-95 h-0 overflow-hidden" />;
  }

  const displayTags = display.tag.length > 0 ? display.tag : null;
  const hasImage = !!display.imageUrl && !imgError;

  return (
    <>
      <article className="overflow-hidden rounded-2xl bg-white shadow-md shadow-zinc-200/60">
        {/* Banner image */}
        <div className="relative w-full" style={{ aspectRatio: "16 / 5" }}>
          {hasImage ? (
            <Image
              src={display.imageUrl!}
              alt=""
              fill
              className="object-cover"
              sizes="600px"
              onError={() => setImgError(true)}
              unoptimized
            />
          ) : (
            <div className={`flex h-full items-center justify-center bg-gradient-to-br ${getMateriaGradient(display.materia)}`}>
              <span className="text-4xl opacity-80">{getMateriaEmoji(display.materia)}</span>
            </div>
          )}
          {importante && (
            <div className="absolute top-2.5 right-3 rounded-full bg-yellow-400/90 px-2.5 py-1 text-[11px] font-bold text-yellow-900 shadow">
              Importante
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-5">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${materiaColor(display.materia)}`}>
            {display.materia}
          </span>

          <h2 className="mt-3 text-xl font-bold leading-snug tracking-tight text-zinc-900">
            {display.titolo}
          </h2>

          <div className="mt-3 text-[15px] leading-[1.7] text-zinc-600 whitespace-pre-line">
            {display.testo}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${coloriDifficolta[display.difficolta]}`}>
              {display.difficolta}
            </span>
            {displayTags?.map((t) => (
              <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-600">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex border-t border-zinc-100">
          <button
            onClick={toggleImportante}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
              importante ? "bg-yellow-50 text-yellow-700" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
            }`}
          >
            <span className="text-base">{importante ? "⭐" : "☆"}</span>
            Importante
          </button>
          <div className="w-px bg-zinc-100" />
          <button
            onClick={() => setModalOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-600"
          >
            <span className="text-base">✏️</span>
            Modifica
          </button>
        </div>
      </article>

      <ModificaModal
        open={modalOpen}
        flashcardId={id}
        dispensaId={dispensaId}
        initial={{
          titolo: display.titolo,
          testo: display.testo,
          tag: (display.tag || []).join(", "),
          imageUrl: display.imageUrl || "",
          difficolta: display.difficolta,
        }}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        onDeleted={handleDeleted}
      />
    </>
  );
}
