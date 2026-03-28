import { StoredFlashcard } from "./store";

type FeedCard = StoredFlashcard & { materia: string };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSmartFeed(cards: FeedCard[]): FeedCard[] {
  if (cards.length === 0) return [];

  // 1. Split: unseen first, seen last
  const unseen = cards.filter((c) => !c.last_seen_at);
  const seen = cards.filter((c) => c.last_seen_at);

  // If all seen, treat as fresh cycle
  const pool = unseen.length > 0 ? [...shuffle(unseen), ...shuffle(seen)] : shuffle(cards);

  // 2. Extract "importante" cards for injection
  const importanteCards = shuffle(cards.filter((c) => c.importante));

  // 3. De-duplicate consecutive dispensa_id
  const feed = dedupeConsecutive(pool);

  // 4. Inject importante cards every 10 positions
  if (importanteCards.length > 0) {
    injectImportante(feed, importanteCards);
  }

  return feed;
}

function dedupeConsecutive(cards: FeedCard[]): FeedCard[] {
  if (cards.length <= 1) return [...cards];

  const result: FeedCard[] = [];
  const deferred: FeedCard[] = [];

  for (const card of cards) {
    const lastDispensa = result.length > 0 ? result[result.length - 1].dispensa_id : null;

    if (card.dispensa_id === lastDispensa) {
      deferred.push(card);
    } else {
      result.push(card);

      // Try to place deferred cards
      let i = 0;
      while (i < deferred.length) {
        const d = deferred[i];
        const currentLast = result[result.length - 1].dispensa_id;
        if (d.dispensa_id !== currentLast) {
          result.push(d);
          deferred.splice(i, 1);
        } else {
          i++;
        }
      }
    }
  }

  // Append any remaining deferred at the end
  result.push(...deferred);
  return result;
}

function injectImportante(feed: FeedCard[], importanteCards: FeedCard[]) {
  const existingIds = new Set(feed.map((c) => c.id));
  const toInject = importanteCards.filter((c) => !existingIds.has(c.id));

  let injIdx = 0;
  for (let pos = 10; pos <= feed.length + toInject.length && injIdx < toInject.length; pos += 11) {
    feed.splice(pos, 0, toInject[injIdx]);
    injIdx++;
  }

  // If we still have importante cards that are already in the feed,
  // we re-inject duplicates at intervals as bonus reminders
  if (injIdx === 0 && importanteCards.length > 0) {
    let bonusIdx = 0;
    for (let pos = 10; pos < feed.length && bonusIdx < importanteCards.length; pos += 11) {
      const card = { ...importanteCards[bonusIdx], id: importanteCards[bonusIdx].id + "-imp" };
      feed.splice(pos, 0, card);
      bonusIdx++;
    }
  }
}
