# StudyFlash — Istruzioni per Claude Code

## Cos'è questo progetto
StudyFlash è una web app (futura PWA/app mobile) per studiare in modo attivo.
L'utente carica dispense (PDF, Word, testo) e il sistema genera automaticamente
flashcard intelligenti tramite Claude API. Le flashcard si accumulano in un feed
a scroll verticale (stile TikTok) e sono disponibili anche come quiz.

## Stack tecnico
- **Frontend**: Next.js 14+ con App Router, TypeScript, Tailwind CSS
- **AI**: Claude API (claude-sonnet-4-6) per generazione flashcard e quiz
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage per i PDF)
- **Deployment**: Vercel (frontend) + Supabase cloud

## Struttura cartelle
app/, components/, lib/supabase, lib/claude, types/, supabase/migrations/

## Regole flashcard
1. Autonome: senso compiuto senza contesto della dispensa
2. Complete: retro esaustivo ma conciso (max 3-4 frasi)
3. Copertura totale di tutti i concetti
4. No domande banali

## Priorità MVP
1. Upload PDF + estrazione testo
2. Generazione flashcard via Claude API
3. Feed scroll verticale con flip animation
4. Quiz
5. Auth Supabase
