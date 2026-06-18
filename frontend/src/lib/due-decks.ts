/**
 * Pure due-deck selection logic (R15.3, R15.4, A4).
 *
 * A deck is "due" when it contains at least one card whose FSRS next-review
 * timestamp is at or before the current time. These helpers are intentionally
 * side-effect-free so they can be tested across many inputs and reused for both
 * the current mock deck data and a future deck API without modification.
 */

/** A single card with its FSRS next-review schedule. */
export interface DeckCard {
  /** ISO timestamp of the next scheduled review, or `null` when never scheduled. */
  nextReview: string | null;
}

/** The minimal deck shape needed to evaluate due-ness. */
export interface DeckLike {
  id: string;
  name: string;
  cards: DeckCard[];
}

/**
 * A deck is due iff at least one card's `nextReview` time is at or before `now`.
 * Cards with a `null` (never scheduled) or unparseable `nextReview` are not due.
 *
 * @param deck The deck to evaluate.
 * @param now The reference time (defaults to the current time). Pure: callers may
 *            inject a fixed `Date` for deterministic behavior.
 */
export function isDeckDue(deck: DeckLike, now: Date = new Date()): boolean {
  const nowMs = now.getTime();
  return deck.cards.some((card) => {
    if (card.nextReview === null) {
      return false;
    }
    const reviewMs = Date.parse(card.nextReview);
    if (Number.isNaN(reviewMs)) {
      return false;
    }
    return reviewMs <= nowMs;
  });
}

/**
 * Returns only the due decks, preserving the input order. Does not mutate the
 * input array.
 *
 * @param decks The decks to filter.
 * @param now The reference time (defaults to the current time).
 */
export function selectDueDecks<T extends DeckLike>(decks: T[], now: Date = new Date()): T[] {
  return decks.filter((deck) => isDeckDue(deck, now));
}
