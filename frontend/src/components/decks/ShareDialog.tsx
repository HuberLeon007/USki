import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Copy, Trash2, Check } from "lucide-react";
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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      listShares(deckId).then(setShares).catch(() => setShares([]));
      setInviteLink(null);
      setCopied(false);
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
    try {
      const inv = await createInvite(deckId, permission);
      // A full, shareable URL — opening it (signed in) redeems the invite once.
      setInviteLink(`${window.location.origin}/dashboard?invite=${inv.code}`);
      setCopied(false);
    } catch {
      setError("Could not create an invite link.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard?.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
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
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </Button>
            </div>
          )}
          {inviteLink && <p className="px-1 text-xs text-muted-foreground">Anyone with this link can join once. The link works a single time.</p>}
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
