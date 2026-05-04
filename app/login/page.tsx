"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = useCallback(async (fullPin: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const target = data?.redirect || "/";
        if (target.startsWith("http")) {
          window.location.href = target;
        } else {
          router.push(target);
        }
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setPin(""); }, 500);
      }
    } catch {
      setShake(true);
      setTimeout(() => { setShake(false); setPin(""); }, 500);
    } finally {
      setLoading(false);
    }
  }, [router]);

  const addDigit = (d: string) => {
    if (pin.length >= 4 || loading) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      submit(next);
    }
  };

  const removeDigit = () => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f5f5f5] px-4">
      {/* Logo */}
      <h1 className="mb-10 text-3xl font-bold tracking-tight">
        Study<span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Flash</span>
      </h1>

      {/* PIN dots */}
      <div className={`mb-10 flex gap-4 ${shake ? "animate-shake" : ""}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-all duration-150 ${
              i < pin.length
                ? "border-blue-600 bg-blue-600 scale-110"
                : "border-zinc-300 bg-transparent"
            }`}
          />
        ))}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-3 w-[240px]">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
          if (key === "") return <div key="empty" />;
          if (key === "del") {
            return (
              <button
                key="del"
                onClick={removeDigit}
                className="flex h-16 items-center justify-center rounded-2xl text-zinc-500 transition-colors hover:bg-zinc-200 active:bg-zinc-300"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75L14.25 12m0 0l2.25 2.25M14.25 12l2.25-2.25M14.25 12L12 14.25m-2.58 4.92l-6.374-6.375a1.125 1.125 0 010-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 012.25 2.25v10.5a2.25 2.25 0 01-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33z" />
                </svg>
              </button>
            );
          }
          return (
            <button
              key={key}
              onClick={() => addDigit(key)}
              className="flex h-16 items-center justify-center rounded-2xl bg-white text-xl font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 active:scale-95 active:bg-zinc-100"
            >
              {key}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="mt-6 h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      )}
    </div>
  );
}
