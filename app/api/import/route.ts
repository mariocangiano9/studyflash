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

function parseHtmlToFlashcards(html: string): ExtractedCard[] {
  const cards: ExtractedCard[] = [];

  // Split HTML into blocks: each tag with its content
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
      // Clean chapter name: strip numbering like "1. " or "1) "
      const raw = stripHtml(block.html).trim();
      currentCapitolo = raw.replace(/^\d+[\.\)]\s*/, "");
      continue;
    }

    // Paragraph: check if it starts with <strong> = new flashcard title
    if (block.type === "p") {
      const strongMatch = block.html.match(/^<strong>([\s\S]*?)<\/strong>([\s\S]*)$/i);

      if (strongMatch) {
        const boldText = stripHtml(strongMatch[1]).trim();
        const rest = stripHtml(strongMatch[2]).trim();

        if (boldText) {
          // New flashcard: flush previous one
          flush();
          // Clean title: strip numbering
          currentTitolo = boldText.replace(/^\d+[\.\)]\s*/, "");
          // If there's text after the bold on the same line, add it to testo
          if (rest) {
            currentTesto.push(rest);
          }
          continue;
        }
      }

      // Normal paragraph — append to current flashcard body
      const text = stripHtml(block.html).trim();
      if (text && currentTitolo) {
        currentTesto.push(text);
      }
      continue;
    }

    // List item — append as bullet to current flashcard body
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
