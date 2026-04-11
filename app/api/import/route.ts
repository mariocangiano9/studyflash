import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const maxDuration = 30;

interface ExtractedCard {
  titolo: string;
  testo: string;
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
        { error: "Nessun heading (H1/H2/H3) trovato nel documento. Il file deve avere titoli strutturati." },
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

  // Split by heading tags
  // Match: <h1>...</h1>, <h2>...</h2>, <h3>...</h3>
  const headingPattern = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  const headings: { title: string; index: number; endIndex: number }[] = [];

  let match;
  while ((match = headingPattern.exec(html)) !== null) {
    headings.push({
      title: stripHtml(match[1]).trim(),
      index: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextStart = i + 1 < headings.length ? headings[i + 1].index : html.length;
    const bodyHtml = html.slice(heading.endIndex, nextStart).trim();
    const bodyText = stripHtml(bodyHtml).trim();

    if (heading.title && bodyText) {
      cards.push({ titolo: heading.title, testo: bodyText });
    }
  }

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
