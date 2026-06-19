"""RAG retrieval + indexing with the fake embedder (no network)."""

from uski.repos.chunks import InMemoryChunkRepo
from uski.services import rag
from uski.services.card_index import reindex_card, remove_card_index
from uski.services.embeddings import FakeEmbedder


def test_indexed_card_is_retrieved_for_matching_query():
    emb, chunks = FakeEmbedder(), InMemoryChunkRepo()
    reindex_card(
        "c1", "d1", "owner", "<p>Photosynthesis</p>", "<p>plants make sugar</p>",
        embedder=emb, chunk_repo=chunks,
    )
    ctx = rag.retrieve_context("Photosynthesis", "owner", "d1", embedder=emb, chunk_repo=chunks)
    assert any("Photosynthesis" in c for c in ctx)


def test_removed_card_drops_from_index():
    emb, chunks = FakeEmbedder(), InMemoryChunkRepo()
    reindex_card("c1", "d1", "owner", "<p>x</p>", "<p>y</p>", embedder=emb, chunk_repo=chunks)
    remove_card_index("c1", chunk_repo=chunks)
    ctx = rag.retrieve_context("x", "owner", "d1", embedder=emb, chunk_repo=chunks)
    assert ctx == []


def test_context_isolated_by_deck():
    emb, chunks = FakeEmbedder(), InMemoryChunkRepo()
    reindex_card("c1", "deckA", "owner", "secretA", "", embedder=emb, chunk_repo=chunks)
    ctx = rag.retrieve_context("secretA", "owner", "deckB", embedder=emb, chunk_repo=chunks)
    assert ctx == []


def test_build_system_prompt_includes_context():
    p = rag.build_system_prompt(["fact one", "fact two"])
    assert "fact one" in p and "fact two" in p
