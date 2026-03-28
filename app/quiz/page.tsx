"use client";

import { useEffect, useState, useCallback } from "react";

interface DispensaOption {
  dispensaId: string;
  titolo: string;
  materia: string | null;
  numFlashcard: number;
}

interface Domanda {
  id: string;
  domanda: string;
  opzioni: string[];
  risposta_corretta: number;
  spiegazione: string;
}

interface RisultatoMateria {
  materia: string;
  media_percentuale: number;
  num_quiz: number;
  trend: "migliorato" | "peggiorato" | "stabile" | "primo";
}

type Fase = "setup" | "loading" | "playing" | "result";

export default function QuizPage() {
  const [fase, setFase] = useState<Fase>("setup");
  const [dispense, setDispense] = useState<DispensaOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [numDomande, setNumDomande] = useState<number>(10);
  const [domande, setDomande] = useState<Domanda[]>([]);
  const [corrente, setCorrente] = useState(0);
  const [selezionata, setSelezionata] = useState<number | null>(null);
  const [risposte, setRisposte] = useState<boolean[]>([]);
  const [errore, setErrore] = useState("");
  const [slideDir, setSlideDir] = useState<"in" | "out">("in");
  const [risultati, setRisultati] = useState<RisultatoMateria[]>([]);

  useEffect(() => {
    fetch("/api/archivio")
      .then((r) => r.json())
      .then((d) => setDispense(d.dispense || []))
      .catch(() => {});
    fetch("/api/quiz/risultati")
      .then((r) => r.json())
      .then((d) => setRisultati(d.risultati || []))
      .catch(() => {});
  }, []);

  // Pre-select from URL query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("dispensaId");
    if (id) setSelectedIds(new Set([id]));
  }, []);

  function toggleDispensa(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Compute materia string from selected dispense
  function getMateriaString(): string {
    const selected = dispense.filter((d) => selectedIds.has(d.dispensaId));
    const materie = [...new Set(selected.map((d) => d.materia || d.titolo))];
    return materie.join(" + ");
  }

  const avviaQuiz = useCallback(async () => {
    if (selectedIds.size === 0) {
      setErrore("Seleziona almeno una dispensa");
      return;
    }

    setFase("loading");
    setErrore("");
    try {
      const res = await fetch("/api/quiz/genera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dispensaIds: Array.from(selectedIds),
          numDomande,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Errore");
      }
      const data = await res.json();
      if (!data.domande?.length) {
        throw new Error("Nessuna domanda generata");
      }
      setDomande(data.domande);
      setCorrente(0);
      setSelezionata(null);
      setRisposte([]);
      setSlideDir("in");
      setFase("playing");
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore");
      setFase("setup");
    }
  }, [numDomande, selectedIds]);

  function selezionaRisposta(idx: number) {
    if (selezionata !== null) return;
    setSelezionata(idx);
    const corretta = idx === domande[corrente].risposta_corretta;
    setRisposte((prev) => [...prev, corretta]);
  }

  function prossima() {
    if (corrente + 1 >= domande.length) {
      setFase("result");
    } else {
      setSlideDir("out");
      setTimeout(() => {
        setCorrente((c) => c + 1);
        setSelezionata(null);
        setSlideDir("in");
      }, 200);
    }
  }

  function ricomincia() {
    setFase("setup");
    setDomande([]);
    setRisposte([]);
    setCorrente(0);
    setSelezionata(null);
    // Refresh risultati
    fetch("/api/quiz/risultati")
      .then((r) => r.json())
      .then((d) => setRisultati(d.risultati || []))
      .catch(() => {});
  }

  const punteggio = risposte.filter(Boolean).length;
  const percentuale = domande.length > 0 ? Math.round((punteggio / domande.length) * 100) : 0;

  // Save result when entering result phase
  useEffect(() => {
    if (fase !== "result" || domande.length === 0) return;
    const materia = getMateriaString();
    fetch("/api/quiz/risultati", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        materia,
        dispense_ids: Array.from(selectedIds),
        num_domande: domande.length,
        risposte_corrette: punteggio,
        percentuale,
      }),
    }).catch((err) => console.error("Errore salvataggio risultato:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase]);

  // ── Setup ──
  if (fase === "setup") {
    return (
      <div className="mx-auto max-w-md px-4 pt-10">
        <div className="rounded-2xl bg-white p-6 shadow-md shadow-zinc-200/60">
          <h1 className="text-xl font-bold text-zinc-900">Quiz</h1>
          <p className="mt-1 text-sm text-zinc-500">Genera domande dalle tue flashcard con l&apos;AI</p>

          {errore && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errore}</div>
          )}

          <div className="mt-6 flex flex-col gap-4">
            <div>
              <span className="text-sm font-medium text-zinc-700">Dispense</span>
              <p className="text-xs text-zinc-400 mt-0.5">Seleziona una o piu dispense</p>
              <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {dispense.map((d) => (
                  <label
                    key={d.dispensaId}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                      selectedIds.has(d.dispensaId)
                        ? "border-blue-400 bg-blue-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.dispensaId)}
                      onChange={() => toggleDispensa(d.dispensaId)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex-1 text-zinc-700">{d.titolo}</span>
                    <span className="text-xs text-zinc-400">{d.numFlashcard} fc</span>
                  </label>
                ))}
                {dispense.length === 0 && (
                  <p className="text-sm text-zinc-400 py-2">Nessuna dispensa trovata</p>
                )}
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-zinc-700">Numero domande</span>
              <div className="mt-1.5 flex gap-2">
                {([10, 20, 50] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => setNumDomande(n)}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${
                      numDomande === n
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={avviaQuiz}
            disabled={selectedIds.size === 0}
            className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Genera e inizia quiz
          </button>
        </div>

        {/* Sezione risultati */}
        {risultati.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-md shadow-zinc-200/60">
            <h2 className="text-lg font-bold text-zinc-900">I tuoi risultati</h2>
            <div className="mt-4 flex flex-col gap-3">
              {risultati.map((r) => (
                <div key={r.materia} className="flex items-center justify-between rounded-xl border border-zinc-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{r.materia}</p>
                    <p className="text-xs text-zinc-400">{r.num_quiz} quiz completati</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${
                      r.media_percentuale >= 80 ? "text-green-600"
                      : r.media_percentuale >= 50 ? "text-amber-600"
                      : "text-red-600"
                    }`}>
                      {r.media_percentuale}%
                    </span>
                    <span className="text-xs">
                      {r.trend === "migliorato" && <span className="text-green-600">&#8593;</span>}
                      {r.trend === "peggiorato" && <span className="text-red-600">&#8595;</span>}
                      {r.trend === "stabile" && <span className="text-zinc-400">=</span>}
                      {r.trend === "primo" && <span className="text-blue-500">&#9679;</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Loading ──
  if (fase === "loading") {
    return (
      <div className="mx-auto max-w-md px-4 pt-10">
        <div className="rounded-2xl bg-white p-8 text-center shadow-md shadow-zinc-200/60">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-zinc-600">Generazione domande in corso...</p>
          <p className="mt-1 text-xs text-zinc-400">Claude sta creando il quiz dalle tue flashcard</p>
        </div>
      </div>
    );
  }

  // ── Result ──
  if (fase === "result") {
    const emoji = percentuale >= 80 ? "\uD83C\uDF89" : percentuale >= 50 ? "\uD83D\uDC4D" : "\uD83D\uDCAA";
    return (
      <div className="mx-auto max-w-md px-4 pt-10">
        <div className="rounded-2xl bg-white p-8 text-center shadow-md shadow-zinc-200/60">
          <div className="text-5xl">{emoji}</div>
          <h2 className="mt-4 text-2xl font-bold text-zinc-900">Quiz completato!</h2>
          <div className="mt-6 flex items-baseline justify-center gap-1">
            <span className="text-5xl font-bold text-blue-600">{punteggio}</span>
            <span className="text-2xl text-zinc-400">/ {domande.length}</span>
          </div>
          <div className="mt-2">
            <span className={`text-lg font-semibold ${
              percentuale >= 80 ? "text-green-600" : percentuale >= 50 ? "text-amber-600" : "text-red-600"
            }`}>
              {percentuale}%
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-1 text-left">
            {domande.map((d, i) => (
              <div key={d.id + i} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                  risposte[i] ? "bg-green-500" : "bg-red-500"
                }`}>
                  {risposte[i] ? "\u2713" : "\u2717"}
                </span>
                <span className="text-zinc-700 truncate">{d.domanda}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex gap-3">
            <button onClick={avviaQuiz}
              className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700">
              Nuovo quiz
            </button>
            <button onClick={ricomincia}
              className="flex-1 rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-200">
              Impostazioni
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ──
  const domanda = domande[corrente];
  const progressPct = ((corrente + (selezionata !== null ? 1 : 0)) / domande.length) * 100;

  return (
    <div className="mx-auto max-w-lg px-4 pt-6">
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500">
        <span>{corrente + 1} / {domande.length}</span>
        <span>{punteggio} corrette</span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
        <div className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progressPct}%` }} />
      </div>

      <div className={`rounded-2xl bg-white p-6 shadow-md shadow-zinc-200/60 transition-all duration-200 ${
        slideDir === "in" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}>
        <h2 className="text-lg font-bold leading-snug text-zinc-900">{domanda.domanda}</h2>
        <p className="mt-1 text-xs text-zinc-400">Seleziona la risposta corretta</p>

        <div className="mt-5 flex flex-col gap-2.5">
          {domanda.opzioni.map((opzione, idx) => {
            const isCorrect = idx === domanda.risposta_corretta;
            const isSelected = selezionata === idx;
            const revealed = selezionata !== null;

            let style = "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50";
            if (revealed) {
              if (isCorrect) style = "border-green-400 bg-green-50 ring-1 ring-green-200";
              else if (isSelected) style = "border-red-400 bg-red-50 ring-1 ring-red-200";
              else style = "border-zinc-100 bg-zinc-50 opacity-50";
            }

            return (
              <button key={idx} onClick={() => selezionaRisposta(idx)} disabled={revealed}
                className={`rounded-xl border px-4 py-3.5 text-left text-sm leading-relaxed transition-all ${style}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    revealed && isCorrect ? "bg-green-500 text-white"
                    : revealed && isSelected ? "bg-red-500 text-white"
                    : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {revealed && isCorrect ? "\u2713" : revealed && isSelected ? "\u2717" : String.fromCharCode(65 + idx)}
                  </span>
                  <span className={revealed && isCorrect ? "text-green-800 font-medium" : "text-zinc-700"}>
                    {opzione}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {selezionata !== null && domanda.spiegazione && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">Spiegazione</p>
            <p className="text-sm text-blue-900 leading-relaxed">{domanda.spiegazione}</p>
          </div>
        )}

        {selezionata !== null && (
          <button onClick={prossima}
            className="mt-5 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700">
            {corrente + 1 >= domande.length ? "Vedi risultati" : "Prossima"}
          </button>
        )}
      </div>
    </div>
  );
}
