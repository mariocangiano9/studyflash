import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase/server";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY non configurata");
  }
  _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

let bucketReady = false;

async function ensureBucket(db: ReturnType<typeof supabaseAdmin>) {
  if (bucketReady) return;
  const { data } = await db.storage.getBucket("flashcard-images");
  if (!data) {
    await db.storage.createBucket("flashcard-images", { public: true });
    console.log("[dalle] Bucket flashcard-images creato");
  }
  bucketReady = true;
}

async function uploadToStorage(imageUrl: string, flashcardId: string): Promise<string | null> {
  try {
    // Download image from DALL-E temporary URL
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.error("[dalle] Download failed:", res.status, res.statusText);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const path = `${flashcardId}.png`;

    // Upload to Supabase Storage
    const db = supabaseAdmin();
    await ensureBucket(db);

    const { error } = await db.storage
      .from("flashcard-images")
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error("[dalle] Storage upload error:", error.message);
      return null;
    }

    // Get permanent public URL
    const { data } = db.storage.from("flashcard-images").getPublicUrl(path);
    console.log("[dalle] Uploaded:", flashcardId, "->", data.publicUrl);
    return data.publicUrl;
  } catch (error) {
    console.error("[dalle] Upload to storage failed:", error);
    return null;
  }
}

export async function generateImage(prompt: string, flashcardId: string): Promise<string | null> {
  try {
    const response = await getClient().images.generate({
      model: "dall-e-3",
      prompt: prompt + ", editorial style, clean, professional, no text",
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const tempUrl = response.data?.[0]?.url;
    if (!tempUrl) return null;

    // Upload to Supabase Storage for permanent URL
    const permanentUrl = await uploadToStorage(tempUrl, flashcardId);
    return permanentUrl;
  } catch (error) {
    console.error("[dalle] Generation error:", error);
    return null;
  }
}

export async function generateImagesBatch(
  items: { id: string; prompt: string }[],
  batchSize: number = 3
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const url = await generateImage(item.prompt, item.id);
        return { id: item.id, url };
      })
    );
    for (const { id, url } of batchResults) {
      if (url) results.set(id, url);
    }
  }

  return results;
}
