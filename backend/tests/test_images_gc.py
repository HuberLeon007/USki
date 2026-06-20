"""Orphan-image garbage-collection tests.

`prune_orphan_images` must delete only the stored images that no card references
anymore, leaving still-referenced images untouched. Storage I/O is faked; the
in-memory repos exercise the real reference-scanning logic.
"""

import pytest

from uski.repos.cards import InMemoryCardRepo
from uski.repos.decks import InMemoryDeckRepo
from uski.repos.images import InMemoryImageRepo
from uski.schemas.deck import DeckCreate
from uski.services import images as images_svc

OWNER = "owner-1"
SHA_USED = "a" * 64
SHA_ORPHAN = "b" * 64


def _img_url(sha: str) -> str:
    return f"http://x/storage/v1/object/public/card-images/{OWNER}/{sha}.webp"


class _FakeStorageBucket:
    def __init__(self, removed):
        self._removed = removed

    def remove(self, paths):
        self._removed.extend(paths)


class _FakeStorage:
    def __init__(self, removed):
        self._removed = removed

    def from_(self, _bucket):
        return _FakeStorageBucket(self._removed)


class _FakeClient:
    def __init__(self, removed):
        self.storage = _FakeStorage(removed)


@pytest.fixture
def repos():
    return InMemoryImageRepo(), InMemoryDeckRepo(), InMemoryCardRepo()


class TestReferencedShas:
    def test_extracts_hashes_from_html_and_ignores_blanks(self):
        found = images_svc.referenced_shas([f'<img src="{_img_url(SHA_USED)}">', "", "<p>no image</p>"])
        assert found == {SHA_USED}


class TestPruneOrphanImages:
    def test_removes_unreferenced_and_keeps_referenced(self, repos, monkeypatch):
        image_repo, deck_repo, card_repo = repos
        removed_paths: list[str] = []
        monkeypatch.setattr(images_svc, "get_supabase_client", lambda: _FakeClient(removed_paths))

        deck = deck_repo.create(OWNER, DeckCreate(title="Bio"))
        card_repo.create(deck.id, {"front_html": f'<img src="{_img_url(SHA_USED)}">', "back_html": ""})
        image_repo.create(OWNER, SHA_USED, f"{OWNER}/{SHA_USED}.webp", 100, 10, 10)
        image_repo.create(OWNER, SHA_ORPHAN, f"{OWNER}/{SHA_ORPHAN}.webp", 200, 10, 10)

        removed = images_svc.prune_orphan_images(
            OWNER, image_repo=image_repo, deck_repo=deck_repo, card_repo=card_repo
        )

        assert removed == 1
        assert image_repo.get(OWNER, SHA_USED) is not None      # still referenced -> kept
        assert image_repo.get(OWNER, SHA_ORPHAN) is None        # orphan -> deleted
        assert removed_paths == [f"{OWNER}/{SHA_ORPHAN}.webp"]   # storage object removed too

    def test_no_images_referenced_removes_all(self, repos, monkeypatch):
        image_repo, deck_repo, card_repo = repos
        monkeypatch.setattr(images_svc, "get_supabase_client", lambda: _FakeClient([]))

        deck = deck_repo.create(OWNER, DeckCreate(title="Empty"))
        card_repo.create(deck.id, {"front_html": "<p>plain</p>", "back_html": "<p>text</p>"})
        image_repo.create(OWNER, SHA_ORPHAN, f"{OWNER}/{SHA_ORPHAN}.webp", 200, 10, 10)

        removed = images_svc.prune_orphan_images(
            OWNER, image_repo=image_repo, deck_repo=deck_repo, card_repo=card_repo
        )
        assert removed == 1
        assert image_repo.list_for_owner(OWNER) == []
