import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Copy, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  createInvite, grantShare, listShares, revokeShare,
  type Permission, type Share,
} from "@/lib/api";

/** Copy text to the clipboard, with a fallback for non-secure contexts /
 *  browsers where the async Clipboard API is unavailable. Returns success. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deckId: string;
}

export function ShareDialog({ open, onOpenChange, deckId }: Props) {
  const [shares, setShares] = useState<Share[]>([]);
  const [handle, setHandle] = useState("");
  const [permission, setPermission] = useState<Permission>("read");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      listShares(deckId).then(setShares).catch(() => setShares([]));
      setInviteLink(null);
      setInviteCode(null);
      setCopiedCode(false);
      setCopiedLink(false);
      setError(null);
    }
  }, [open, deckId]);

  async function grant(e: FormEvent) {
    e.preventDefault();
    const m = handle.match(/^(.+)#(\d{4})$/);
    if (!m) {
      setError("Use the format username#1234");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await grantShare(deckId, { username: m[1], discriminator: m[2], permission });
      setShares(await listShares(deckId));
      setHandle("");
    } catch {
      setError("User not found or grant failed.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(granteeId: string) {
    await revokeShare(deckId, granteeId);
    setShares(await listShares(deckId));
  }

  async function makeLink() {
    setBusy(true);
    setError(null);
    try {
      const inv = await createInvite(deckId, permission);
      // A full, shareable URL — opening it (signed in) redeems the invite once.
      const link = `${window.location.origin}/dashboard?invite=${inv.code}`;
      setInviteLink(link);
      setInviteCode(inv.code);
      setCopiedCode(false);
      setCopiedLink(false);
      // Convenience: generating also copies the link straight away.
      const ok = await copyToClipboard(link);
      if (ok) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1800);
        toast.success("Invite link created and copied");
      } else {
        toast.success("Invite link created");
      }
    } catch {
      setError("Could not create an invite link.");
      toast.error("Could not create an invite link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!inviteCode) return;
    if (await copyToClipboard(inviteCode)) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
      toast.success("Code copied to clipboard");
    } else {
      toast.error("Couldn't copy — select the code and copy manually");
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    if (await copyToClipboard(inviteLink)) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1800);
      toast.success("Link copied to clipboard");
    } else {
      toast.error("Couldn't copy — select the link and copy manually");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share deck</DialogTitle>
          <DialogDescription>Invite people by handle or share a link.</DialogDescription>
        </DialogHeader>

        <form onSubmit={grant} className="flex flex-col gap-3">
          <Label htmlFor="share-handle">Invite by handle</Label>
          <div className="flex gap-2">
            <input
              id="share-handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="bob#0427"
              className="h-10 flex-1 rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
            />
            <SelectMenu
              value={permission}
              onChange={(v) => setPermission(v as Permission)}
              ariaLabel="Permission"
              className="w-28"
              options={[
                { value: "read", label: "read" },
                { value: "edit", label: "edit" },
                { value: "share", label: "share" },
              ]}
            />
            <Button type="submit" disabled={busy} className="h-10 rounded-xl">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Invite"}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>

        <div className="space-y-2">
          <Button type="button" variant="outline" className="h-10 w-full rounded-xl" onClick={makeLink} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create invite link"}
          </Button>
          {inviteCode && (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 p-1.5">
              <span className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Code</span>
              <input
                readOnly
                value={inviteCode}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-1 font-mono text-sm tracking-wider outline-none"
                aria-label="Invite code"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shrink-0 gap-1.5 rounded-lg"
                onClick={copyCode}
              >
                {copiedCode ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy code</>}
              </Button>
            </div>
          )}
          {inviteLink && (
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 p-1.5">
              <input
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent px-2 text-xs text-muted-foreground outline-none"
                aria-label="Invite link"
              />
              <Button type="button" size="sm" variant="secondary" className="h-8 shrink-0 gap-1.5 rounded-lg" onClick={copyLink}>
                {copiedLink ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
              </Button>
            </div>
          )}
          {inviteLink && <p className="px-1 text-xs text-muted-foreground">Share the code or link. Either one lets a person join once.</p>}
        </div>

        <div className="flex flex-col gap-1">
          <Label>People with access</Label>
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one yet.</p>
          ) : (
            shares.map((s) => (
              <div key={s.grantee_id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm">
                <span className="font-mono text-xs">{s.grantee_id.slice(0, 8)}…</span>
                <span className="text-muted-foreground">{s.permission}</span>
                <button onClick={() => revoke(s.grantee_id)} aria-label="Revoke" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
