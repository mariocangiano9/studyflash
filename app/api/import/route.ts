import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const maxDuration = 30;

interface ExtractedCard {
  titolo: string;
  testo: string;
  capitolo: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "File .docx richiesto" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Convert to HTML to detect headings
    const { value: html } = await mammoth.convertToHtml({ buffer });

    // Parse HTML to extract heading → text structure
    const flashcards = parseHtmlToFlashcards(html);

    if (flashcards.length === 0) {
      return NextResponse.json(
        { error: "Nessuna flashcard trovata. Il documento deve avere capitoli (H1) e paragrafi con titoli in grassetto." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      flashcards,
      titolo: file.name.replace(/\.docx$/i, ""),
    });
  } catch (err) {
    console.error("[import] Errore parsing docx:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Errore parsing documento" },
      { status: 500 }
    );
  }
}

// Regex: a numbered title starts with one or more digits followed by a dot and space
const NUMBERED_TITLE_RE = /^\d+\.\s+/;

function parseHtmlToFlashcards(html: string): ExtractedCard[] {
  const cards: ExtractedCard[] = [];

  // Extract blocks: headings, paragraphs, list items
  const blocks: { type: string; html: string }[] = [];
  const blockPattern = /<(h[1-3]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockPattern.exec(html)) !== null) {
    blocks.push({ type: m[1].toLowerCase(), html: m[2] });
  }

  let currentCapitolo = "";
  let currentTitolo = "";
  let currentTesto: string[] = [];

  function flush() {
    if (currentTitolo && currentTesto.length > 0) {
      const testo = currentTesto.join("\n").trim();
      if (testo) {
        cards.push({
          titolo: currentTitolo,
          testo,
          capitolo: currentCapitolo,
        });
      }
    }
    currentTitolo = "";
    currentTesto = [];
  }

  for (const block of blocks) {
    // H1/H2/H3 = chapter heading → flush current card, update chapter
    if (block.type === "h1" || block.type === "h2" || block.type === "h3") {
      flush();
      const raw = stripHtml(block.html).trim();
      currentCapitolo = raw.replace(/^\d+[\.\)]\s*/, "");
      continue;
    }

    if (block.type === "p") {
      // Check if this paragraph starts with <strong> containing a numbered title
      const strongMatch = block.html.match(/^<strong>([\s\S]*?)<\/strong>([\s\S]*)$/i);

      if (strongMatch) {
        const boldText = stripHtml(strongMatch[1]).trim();

        // ONLY create a new flashcard if the bold text starts with "N. "
        if (boldText && NUMBERED_TITLE_RE.test(boldText)) {
          flush();
          currentTitolo = boldText;
          const rest = stripHtml(strongMatch[2]).trim();
          if (rest) {
            currentTesto.push(rest);
          }
          continue;
        }
      }

      // Everything else: accumulate as body text of the current flashcard
      const text = stripHtml(block.html).trim();
      if (text && currentTitolo) {
        currentTesto.push(text);
      }
      continue;
    }

    // List items — accumulate as bullet points in current flashcard body
    if (block.type === "li") {
      const text = stripHtml(block.html).trim();
      if (text && currentTitolo) {
        currentTesto.push("• " + text);
      }
    }
  }

  // Flush last card
  flush();

  return cards;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
