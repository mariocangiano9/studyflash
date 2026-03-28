"use client";

import { useState, useRef, useCallback } from "react";

interface FlashcardPreview {
  id: string;
  titolo: string;
  testo: string;
  difficolta: string;
  ordine: number;
}

interface GenerateResult {
  dispensaId: string;
  titolo: string;
  numFlashcard: number;
  flashcard: FlashcardPreview[];
}

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

export default function UploadPDF() {
  const [file, setFile] = useState<File | null>(null);
  const [titolo, setTitolo] = useState("");
  const [materia, setMateria] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ pct: 0, msg: "" });
  const [errore, setErrore] = useState("");
  const [risultato, setRisultato] = useState<GenerateResult | null>(null);
  const extractedRef = useRef<{ dispensaId: string; testo: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function parseTags(): string[] {
    return tagInput.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.name.toLowerCase().endsWith(".pdf")) {
      setFile(dropped);
    }
  }, []);

  async function generate(dispensaId: string, testo: string) {
    const effectiveTitolo = titolo || file?.name.replace(/\.pdf$/i, "") || "Dispensa";

    setProgress({ pct: 25, msg: "Connessione al server..." });

    const res = await fetch("/api/generate/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dispensaId,
        testo,
        titolo: effectiveTitolo,
        materia: materia || undefined,
        tags: parseTags(),
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error("Errore nella connessione al server");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: GenerateResult | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const event = JSON.parse(raw);

          if (event.type === "progress") {
            setProgress({ pct: event.pct, msg: event.msg });
          } else if (event.type === "done") {
            setProgress({ pct: 100, msg: "Completato!" });
            const flashcard = (event.flashcard as FlashcardPreview[]).sort(
              (a, b) => a.ordine - b.ordine
            );
            finalResult = {
              dispensaId: event.dispensaId,
              titolo: effectiveTitolo,
              numFlashcard: event.numFlashcard,
              flashcard,
            };
          } else if (event.type === "error") {
            throw new Error(event.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    if (!finalResult) throw new Error("Nessun risultato ricevuto dal server");

    setRisultato(finalResult);
    setIsLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setErrore("");
    setRisultato(null);
    setIsLoading(true);
    setProgress({ pct: 5, msg: "Caricamento file..." });

    try {
      // Step 1: Upload PDF and extract text
      setProgress({ pct: 10, msg: "Estrazione testo dal PDF..." });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("titolo", titolo || file.name.replace(/\.pdf$/i, ""));

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Errore durante l'upload");
      }
      const { dispensaId, testo } = await uploadRes.json();
      extractedRef.current = { dispensaId, testo };
      setProgress({ pct: 20, msg: "Testo estratto, avvio generazione..." });

      // Step 2: Generate via SSE stream
      await generate(dispensaId, testo);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setIsLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!extractedRef.current) return;
    setErrore("");
    setRisultato(null);
    setIsLoading(true);
    setProgress({ pct: 20, msg: "Avvio rigenerazione..." });
    try {
      await generate(extractedRef.current.dispensaId, extractedRef.current.testo);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-[560px] mx-auto">
      <div className="rounded-2xl bg-white p-6 shadow-md shadow-zinc-200/60">
        <h1 className="text-xl font-bold text-zinc-900">Carica dispensa</h1>
        <p className="mt-1 text-sm text-zinc-500">Carica un PDF e genera flashcard con l&apos;AI</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-all ${
              dragging
                ? "border-blue-400 bg-blue-50 scale-[1.02]"
                : file
                ? "border-green-300 bg-green-50"
                : "border-zinc-300 bg-zinc-50 hover:border-zinc-400 hover:bg-zinc-100"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={isLoading}
              className="hidden"
            />
            {file ? (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl">
                  ✅
                </div>
                <div>
                  <p className="text-sm font-medium text-green-800">{file.name}</p>
                  <p className="mt-0.5 text-xs text-green-600">
                    {(file.size / 1024 / 1024).toFixed(1)} MB — clicca per cambiare
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-200 text-2xl">📄</div>
                <div>
                  <p className="text-sm font-medium text-zinc-700">
                    {dragging ? "Rilascia il file qui" : "Trascina il PDF qui"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">oppure clicca per selezionare</p>
                </div>
              </>
            )}
          </div>

          {/* Titolo */}
          <div>
            <label htmlFor="titolo" className="block text-sm font-medium text-zinc-700 mb-1.5">Titolo (opzionale)</label>
            <input id="titolo" type="text" value={titolo} onChange={(e) => setTitolo(e.target.value)}
              placeholder="Es: Anatomia — Capitolo 3" disabled={isLoading}
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50" />
          </div>

          {/* Materia */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">Materia</label>
            <div className="grid grid-cols-4 gap-2">
              {MATERIE.map((m) => (
                <button key={m.label} type="button"
                  onClick={() => setMateria(materia === m.label ? "" : m.label)}
                  disabled={isLoading}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-all disabled:opacity-50 ${
                    materia === m.label ? "bg-blue-50 text-blue-700 ring-2 ring-blue-300" : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                  }`}>
                  <span className="text-lg">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tag */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-zinc-700 mb-1.5">Tag (separati da virgola)</label>
            <input id="tags" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
              placeholder="Es: costituzione, pubblica amministrazione" disabled={isLoading}
              className="w-full rounded-xl border border-zinc-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50" />
            {parseTags().length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {parseTags().map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={!file || isLoading}
            className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Carica e genera flashcard
          </button>
        </form>

        {/* Progress bar */}
        {isLoading && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
              <span className="truncate pr-2">{progress.msg}</span>
              <span className="shrink-0 font-medium">{progress.pct}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-700 ease-out"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Error */}
        {!isLoading && errore && (
          <div className="mt-4 rounded-xl bg-red-50 p-3.5 text-sm text-red-700">{errore}</div>
        )}
      </div>

      {/* Results */}
      {risultato && !isLoading && (
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-md shadow-zinc-200/60">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-zinc-900">
              {risultato.numFlashcard} flashcard generate
            </h3>
            <div className="flex gap-2">
              <button onClick={handleRegenerate}
                className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
                Rigenera
              </button>
              <a href={`/feed/${risultato.dispensaId}`}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                Vai al feed
              </a>
            </div>
          </div>

          <div className="mt-3 max-h-[360px] overflow-y-auto rounded-xl border border-zinc-100">
            {risultato.flashcard.map((fc, i) => (
              <div key={fc.id} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? "border-t border-zinc-50" : ""}`}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-500">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900">{fc.titolo}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 line-clamp-2">{fc.testo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
