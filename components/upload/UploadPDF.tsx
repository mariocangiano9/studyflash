"use client";

import { useState, useRef, useCallback } from "react";

interface FlashcardPreview {
  id: string;
  titolo: string;
  testo: string;
  difficolta: string;
  ordine: number;
}

type QueueItemStatus = "waiting" | "uploading" | "generating" | "images" | "done" | "error";

interface QueueItem {
  file: File;
  materia: string;
  status: QueueItemStatus;
  progress: { pct: number; msg: string };
  numFlashcard: number;
  dispensaId: string | null;
  error: string | null;
}

type UploadMode = "ai" | "structured";

interface ImportedCard {
  titolo: string;
  testo: string;
}

type ImportStep = "upload" | "preview" | "saving" | "done" | "error";

const MATERIE = [
  { emoji: "📚", label: "Diritto" },
  { emoji: "💰", label: "Economia" },
  { emoji: "🏛️", label: "Storia" },
  { emoji: "💭", label: "Filosofia" },
  { emoji: "🧬", label: "Scienze" },
  { emoji: "📐", label: "Matematica" },
  { emoji: "🧪", label: "Fisica" },
  { emoji: "💊", label: "Medicina" },
  { emoji: "📖", label: "Letteratura" },
  { emoji: "💻", label: "Informatica" },
  { emoji: "🧠", label: "Psicologia" },
  { emoji: "📝", label: "Altro" },
];

const PAGE_SIZE = 50;

const STATUS_ICON: Record<QueueItemStatus, string> = {
  waiting: "⏸️",
  uploading: "⬆️",
  generating: "⏳",
  images: "🖼️",
  done: "✅",
  error: "❌",
};

export default function UploadPDF() {
  const [mode, setMode] = useState<UploadMode>("ai");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [globalMateria, setGlobalMateria] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  // Structured import state
  const [importStep, setImportStep] = useState<ImportStep>("upload");
  const [importCards, setImportCards] = useState<ImportedCard[]>([]);
  const [importTitolo, setImportTitolo] = useState("");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<{ dispensaId: string; numFlashcard: number } | null>(null);
  const [importDragging, setImportDragging] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  function parseTags(): string[] {
    return tagInput.split(",").map((t) => t.trim()).filter(Boolean);
  }

  // ── Structured import handlers ──

  async function handleImportFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setImportError("Seleziona un file .docx");
      return;
    }

    setImportError("");
    setImportStep("upload");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || "Errore parsing documento");
        setImportStep("error");
        return;
      }

      setImportCards(data.flashcards);
      setImportTitolo(data.titolo);
      setImportStep("preview");
    } catch {
      setImportError("Errore di rete");
      setImportStep("error");
    }
  }

  async function confirmImport() {
    setImportStep("saving");

    try {
      const res = await fetch("/api/import/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flashcards: importCards,
          titolo: importTitolo,
          materia: globalMateria || undefined,
          tags: parseTags(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setImportError(data.error || "Errore salvataggio");
        setImportStep("error");
        return;
      }

      setImportResult(data);
      setImportStep("done");

      // Trigger image generation in background
      if (data.dispensaId) {
        fetch("/api/generate/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dispensaId: data.dispensaId }),
        }).catch(() => {});
      }
    } catch {
      setImportError("Errore di rete");
      setImportStep("error");
    }
  }

  function resetImport() {
    setImportStep("upload");
    setImportCards([]);
    setImportTitolo("");
    setImportError("");
    setImportResult(null);
  }

  const addFiles = useCallback((files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) return;
    setQueue((prev) => [
      ...prev,
      ...pdfs.map((file): QueueItem => ({
        file,
        materia: globalMateria,
        status: "waiting",
        progress: { pct: 0, msg: "In attesa" },
        numFlashcard: 0,
        dispensaId: null,
        error: null,
      })),
    ]);
  }, [globalMateria]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFromQueue = (idx: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== idx));
  };

  const setItemMateria = (idx: number, materia: string) => {
    setQueue((prev) => prev.map((item, i) => i === idx ? { ...item, materia } : item));
  };

  const updateItem = (idx: number, updates: Partial<QueueItem>) => {
    setQueue((prev) => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  async function processFile(idx: number) {
    const item = queue[idx];
    if (!item || item.status !== "waiting") return;

    try {
      // Step 1: Upload PDF
      updateItem(idx, { status: "uploading", progress: { pct: 10, msg: "Estrazione testo..." } });
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("titolo", item.file.name.replace(/\.pdf$/i, ""));

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Errore estrazione testo");
      const { dispensaId, testo } = await uploadRes.json();
      updateItem(idx, { dispensaId });

      // Step 2: Prepare chunks
      updateItem(idx, { status: "generating", progress: { pct: 15, msg: "Preparazione..." } });
      const prepRes = await fetch("/api/generate/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispensaId,
          testo,
          titolo: item.file.name.replace(/\.pdf$/i, ""),
          materia: item.materia || undefined,
          tags: parseTags(),
        }),
      });
      if (!prepRes.ok) throw new Error("Errore preparazione");
      const { totalChunks, chunkTexts } = await prepRes.json();

      // Step 3: Process chunks
      let totalFc = 0;
      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) throw new Error("Annullato");
        const pct = Math.round(15 + ((i + 0.5) / totalChunks) * 70);
        updateItem(idx, { progress: { pct, msg: `Chunk ${i + 1}/${totalChunks}` } });

        let ok = false;
        for (let attempt = 0; attempt < 2; attempt++) {
          const res = await fetch("/api/generate/chunk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dispensaId,
              chunkText: chunkTexts[i],
              chunkIndex: i,
              totalChunks,
              titolo: item.file.name.replace(/\.pdf$/i, ""),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            totalFc += data.numFlashcard || 0;
            ok = true;
            break;
          }
        }
        if (!ok) console.warn(`Chunk ${i + 1} fallito`);

        updateItem(idx, {
          numFlashcard: totalFc,
          progress: { pct: Math.round(15 + ((i + 1) / totalChunks) * 70), msg: `${totalFc} flashcard` },
        });
      }

      // Step 4: Images (background, non-blocking)
      updateItem(idx, { status: "images", progress: { pct: 90, msg: "Immagini..." } });
      try {
        const imgRes = await fetch("/api/generate/images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dispensaId }),
        });
        if (imgRes.ok && imgRes.body) {
          const reader = imgRes.body.getReader();
          while (true) {
            const { done } = await reader.read();
            if (done) break;
          }
        }
      } catch { /* non-blocking */ }

      updateItem(idx, {
        status: "done",
        numFlashcard: totalFc,
        progress: { pct: 100, msg: `${totalFc} flashcard generate` },
      });
    } catch (err) {
      updateItem(idx, {
        status: "error",
        error: err instanceof Error ? err.message : "Errore",
        progress: { pct: 0, msg: "Errore" },
      });
    }
  }

  async function startQueue() {
    setProcessing(true);
    abortRef.current = false;

    for (let i = 0; i < queue.length; i++) {
      if (abortRef.current) break;
      if (queue[i].status === "waiting") {
        await processFile(i);
      }
    }

    setProcessing(false);
  }

  const completedCount = queue.filter((q) => q.status === "done").length;
  const totalFlashcards = queue.reduce((sum, q) => sum + q.numFlashcard, 0);
  const hasWaiting = queue.some((q) => q.status === "waiting");
  const allDone = queue.length > 0 && queue.every((q) => q.status === "done" || q.status === "error");

  return (
    <div className="w-full max-w-[560px] mx-auto">
      <div className="rounded-2xl bg-white p-6 shadow-md shadow-zinc-200/60">
        <h1 className="text-xl font-bold text-zinc-900">Carica dispense</h1>
        <p className="mt-1 text-sm text-zinc-500">Seleziona la modalità di caricamento</p>

        {/* Mode toggle */}
        <div className="mt-4 flex rounded-xl bg-zinc-100 p-1">
          <button
            onClick={() => setMode("ai")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "ai" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Genera con AI
          </button>
          <button
            onClick={() => setMode("structured")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              mode === "structured" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            Importa strutturato
          </button>
        </div>

        {mode === "ai" ? (
          <>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`mt-5 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all ${
                dragging ? "border-blue-400 bg-blue-50 scale-[1.02]"
                : queue.length > 0 ? "border-green-300 bg-green-50"
                : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
                disabled={processing}
                className="hidden"
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-200 text-2xl">📄</div>
              <div>
                <p className="text-sm font-medium text-zinc-700">
                  {dragging ? "Rilascia qui" : "Trascina PDF qui o clicca per selezionare"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">Puoi selezionare più file</p>
              </div>
            </div>

            {/* Global materia + tags */}
            {queue.length > 0 && !processing && (
              <div className="mt-5 flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Materia (per tutti)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MATERIE.map((m) => (
                      <button key={m.label} type="button"
                        onClick={() => {
                          const next = globalMateria === m.label ? "" : m.label;
                          setGlobalMateria(next);
                          setQueue((prev) => prev.map((item) => item.status === "waiting" ? { ...item, materia: next } : item));
                        }}
                        className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-all ${
                          globalMateria === m.label ? "bg-blue-50 text-blue-700 ring-2 ring-blue-300" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                        }`}>
                        <span className="text-base">{m.emoji}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tag (per tutti)</label>
                  <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    placeholder="Es: costituzione, diritto" className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>
            )}

            {/* Queue */}
            {queue.length > 0 && (
              <div className="mt-5 flex flex-col gap-2">
                {queue.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{STATUS_ICON[item.status]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900 truncate">{item.file.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-zinc-500">{item.progress.msg}</p>
                          {item.status === "waiting" && !processing && (
                            <button
                              onClick={() => setItemMateria(idx, "")}
                              className="text-[10px] text-blue-600 hover:underline"
                            >
                              {item.materia || "Materia..."}
                            </button>
                          )}
                        </div>
                      </div>
                      {item.numFlashcard > 0 && (
                        <span className="text-xs font-medium text-zinc-500">{item.numFlashcard} fc</span>
                      )}
                      {item.status === "waiting" && !processing && (
                        <button onClick={() => removeFromQueue(idx)} className="text-zinc-400 hover:text-red-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {(item.status === "generating" || item.status === "uploading" || item.status === "images") && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                        <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${item.progress.pct}%` }} />
                      </div>
                    )}
                    {item.error && (
                      <p className="mt-1 text-xs text-red-600">{item.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            {queue.length > 0 && (
              <div className="mt-4 flex gap-2">
                {hasWaiting && !processing && (
                  <button onClick={startQueue}
                    className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700">
                    Avvia generazione ({queue.filter((q) => q.status === "waiting").length} file)
                  </button>
                )}
                {processing && (
                  <button onClick={() => { abortRef.current = true; }}
                    className="flex-1 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100">
                    Annulla coda
                  </button>
                )}
              </div>
            )}

            {/* Summary */}
            {allDone && (
              <div className="mt-5 rounded-xl bg-green-50 p-4 text-center">
                <p className="text-sm font-semibold text-green-800">
                  {completedCount} dispense caricate, {totalFlashcards} flashcard generate
                </p>
                <a href="/feed" className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline">
                  Vai al feed &rarr;
                </a>
              </div>
            )}
          </>
        ) : (
          /* ── Structured Import Mode ── */
          <>
            {importStep === "upload" && (
              <>
                {/* Docx drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
                  onDragLeave={() => setImportDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setImportDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleImportFile(file);
                  }}
                  onClick={() => importInputRef.current?.click()}
                  className={`mt-5 flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-all ${
                    importDragging ? "border-purple-400 bg-purple-50 scale-[1.02]"
                    : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
                  }`}
                >
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFile(file);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">📋</div>
                  <div>
                    <p className="text-sm font-medium text-zinc-700">
                      {importDragging ? "Rilascia qui" : "Carica un file .docx strutturato"}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Ogni heading (H1/H2/H3) diventa il titolo, il testo sotto diventa il contenuto
                    </p>
                  </div>
                </div>
              </>
            )}

            {importStep === "error" && (
              <div className="mt-5">
                <div className="rounded-xl bg-red-50 p-4 text-center">
                  <p className="text-sm text-red-700">{importError}</p>
                </div>
                <button onClick={resetImport}
                  className="mt-3 w-full rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
                  Riprova
                </button>
              </div>
            )}

            {importStep === "preview" && (
              <>
                {/* Materia + tags */}
                <div className="mt-5 flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Materia</label>
                    <div className="grid grid-cols-4 gap-2">
                      {MATERIE.map((m) => (
                        <button key={m.label} type="button"
                          onClick={() => setGlobalMateria(globalMateria === m.label ? "" : m.label)}
                          className={`flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-medium transition-all ${
                            globalMateria === m.label ? "bg-blue-50 text-blue-700 ring-2 ring-blue-300" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                          }`}>
                          <span className="text-base">{m.emoji}</span>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1.5">Tag</label>
                    <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Es: bilancio, economia aziendale" className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>

                {/* Preview header */}
                <div className="mt-5 rounded-xl bg-purple-50 p-3 text-center">
                  <p className="text-sm font-semibold text-purple-800">
                    Trovate {importCards.length} flashcard
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">da &ldquo;{importTitolo}&rdquo;</p>
                </div>

                {/* Cards preview */}
                <div className="mt-4 flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                  {importCards.map((card, i) => (
                    <div key={i} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
                      <p className="text-sm font-semibold text-zinc-900">{card.titolo}</p>
                      <p className="mt-1 text-xs text-zinc-600 line-clamp-3">{card.testo}</p>
                    </div>
                  ))}
                </div>

                {/* Confirm / Cancel */}
                <div className="mt-4 flex gap-2">
                  <button onClick={resetImport}
                    className="flex-1 rounded-xl bg-zinc-100 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-200">
                    Annulla
                  </button>
                  <button onClick={confirmImport}
                    className="flex-1 rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-700">
                    Importa {importCards.length} flashcard
                  </button>
                </div>
              </>
            )}

            {importStep === "saving" && (
              <div className="mt-5 text-center">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                </div>
                <p className="mt-3 text-sm text-zinc-600">Salvataggio e generazione tag...</p>
              </div>
            )}

            {importStep === "done" && importResult && (
              <div className="mt-5 rounded-xl bg-green-50 p-4 text-center">
                <p className="text-sm font-semibold text-green-800">
                  {importResult.numFlashcard} flashcard importate con successo
                </p>
                <p className="text-xs text-green-600 mt-1">Le immagini vengono generate in background</p>
                <div className="mt-3 flex gap-2 justify-center">
                  <a href="/feed" className="text-sm font-medium text-blue-600 hover:underline">
                    Vai al feed &rarr;
                  </a>
                  <span className="text-zinc-300">|</span>
                  <button onClick={resetImport} className="text-sm font-medium text-zinc-500 hover:underline">
                    Importa altro
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
