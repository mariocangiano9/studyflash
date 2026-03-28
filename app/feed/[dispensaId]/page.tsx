import FlashcardFeed from "@/components/flashcard/FlashcardFeed";

export default async function FeedPage({
  params,
}: {
  params: Promise<{ dispensaId: string }>;
}) {
  const { dispensaId } = await params;

  return <FlashcardFeed dispensaId={dispensaId} />;
}
