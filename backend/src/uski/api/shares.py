"""Sharing / RBAC endpoints: grant, revoke, invites, redeem, access log."""

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from pydantic import BaseModel

from uski.core.deps import (
    AuditRepoDep, DeckRepoDep, InviteRepoDep, NotificationRepoDep, ShareRepoDep, UserRepoDep,
)
from uski.core.security import CurrentUser, get_current_user
from uski.schemas.sharing import (
    AccessLogOut, InviteCreate, InviteOut, RedeemRequest, ShareGrant, ShareOut,
)

router = APIRouter(prefix="/api", tags=["sharing"])


class OutgoingShareOut(BaseModel):
    """A grant the current user has made on one of their own decks."""
    deck_id: str
    deck_title: str
    grantee_id: str
    grantee: str | None = None
    permission: str


def _require_owner(deck_repo, deck_id, user_id):
    """Sharing is an owner-only right: only the deck's creator may view, grant,
    revoke or invite. It is never delegated through a share (not even 'share'
    permission) - the owner alone controls who has access, same as delete."""
    deck = deck_repo.get(deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found")
    if deck.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the deck owner can manage sharing.",
        )
    return deck


@router.get("/decks/{deck_id}/shares", response_model=list[ShareOut])
async def list_shares(
    deck_id: str, deck_repo: DeckRepoDep, share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    _require_owner(deck_repo, deck_id, user.id)
    return share_repo.list_for_deck(deck_id)


@router.get("/shares/outgoing", response_model=list[OutgoingShareOut])
async def outgoing_shares(
    deck_repo: DeckRepoDep, share_repo: ShareRepoDep, user_repo: UserRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    """Every grant the current user has made on decks they own (for the Shared overview)."""
    out: list[OutgoingShareOut] = []
    for deck in deck_repo.list_for(user.id):
        for s in share_repo.list_for_deck(deck.id):
            out.append(OutgoingShareOut(
                deck_id=deck.id,
                deck_title=deck.title,
                grantee_id=s["grantee_id"],
                grantee=user_repo.get_handle(s["grantee_id"]),
                permission=s["permission"],
            ))
    return out


@router.delete("/shares/incoming/{deck_id}", status_code=204)
async def leave_shared_deck(
    deck_id: str, share_repo: ShareRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    """The current user removes their OWN access to a deck shared with them.
    One-time and final: a new share would have to be granted again."""
    share_repo.revoke(deck_id, user.id)


@router.post("/decks/{deck_id}/shares", response_model=ShareOut, status_code=201)
async def grant_share(
    deck_id: str, body: ShareGrant,
    deck_repo: DeckRepoDep, share_repo: ShareRepoDep, user_repo: UserRepoDep,
    audit: AuditRepoDep, notify: NotificationRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    deck = _require_owner(deck_repo, deck_id, user.id)
    grantee = user_repo.find_by_handle(body.username, body.discriminator)
    if grantee is None:
        raise HTTPException(status_code=404, detail="User not found")
    if grantee == deck.owner_id:
        raise HTTPException(status_code=400, detail="Owner already has full access")
    row = share_repo.grant(deck_id, grantee, body.permission, user.id)
    audit.record(deck_id, user.id, "grant", {"grantee": grantee, "permission": body.permission})
    notify.create(grantee, deck_id, "granted",
                  f"You were granted '{body.permission}' access to a deck.")
    logger.info("Share granted deck={} grantee={} perm={}", deck_id, grantee, body.permission)
    return row


@router.delete("/decks/{deck_id}/shares/{grantee_id}", status_code=204)
async def revoke_share(
    deck_id: str, grantee_id: str,
    deck_repo: DeckRepoDep, share_repo: ShareRepoDep,
    audit: AuditRepoDep, notify: NotificationRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    _require_owner(deck_repo, deck_id, user.id)
    share_repo.revoke(deck_id, grantee_id)
    audit.record(deck_id, user.id, "revoke", {"grantee": grantee_id})
    notify.create(grantee_id, deck_id, "revoked", "Your access to a deck was revoked.")


@router.post("/decks/{deck_id}/invites", response_model=InviteOut, status_code=201)
async def create_invite(
    deck_id: str, body: InviteCreate,
    deck_repo: DeckRepoDep, share_repo: ShareRepoDep, invite_repo: InviteRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    _require_owner(deck_repo, deck_id, user.id)
    return invite_repo.create(deck_id, body.permission, user.id)


@router.post("/shares/redeem", response_model=ShareOut, status_code=201)
async def redeem_invite(
    body: RedeemRequest,
    invite_repo: InviteRepoDep, share_repo: ShareRepoDep, deck_repo: DeckRepoDep,
    audit: AuditRepoDep, notify: NotificationRepoDep, user_repo: UserRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    invite = invite_repo.get_by_code(body.code)
    if invite is None:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    deck = deck_repo.get(invite["deck_id"])
    if deck is None:
        raise HTTPException(status_code=404, detail="Deck no longer exists")
    if deck.owner_id == user.id:
        raise HTTPException(status_code=400, detail="You can't use your own invite link.")
    if invite.get("redeemed_by"):
        raise HTTPException(status_code=409, detail="This invite link has already been used.")
    row = share_repo.grant(invite["deck_id"], user.id, invite["permission"], invite["created_by"])
    invite_repo.mark_redeemed(body.code, user.id)  # single-use
    audit.record(invite["deck_id"], user.id, "redeem", {"permission": invite["permission"]})
    # Tell the deck owner someone joined.
    handle = user_repo.get_handle(user.id) or "Someone"
    notify.create(invite["created_by"], invite["deck_id"], "redeemed",
                  f"{handle} joined your shared deck '{deck.title}'.")
    logger.info("Invite redeemed deck={} by={}", invite["deck_id"], user.id)
    return row


@router.get("/decks/{deck_id}/access-log", response_model=list[AccessLogOut])
async def access_log(
    deck_id: str, deck_repo: DeckRepoDep, share_repo: ShareRepoDep, audit: AuditRepoDep,
    user: CurrentUser = Depends(get_current_user),
):
    _require_owner(deck_repo, deck_id, user.id)
    return audit.list_for_deck(deck_id)
