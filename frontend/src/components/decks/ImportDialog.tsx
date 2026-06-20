import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectMenu } from "@/components/ui/select-menu";
import { importDeckFile, ApiError, type ImportResult } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (r: ImportResult) => void;
}

const DELIMS = [
  { label: "Semicolon ;", value: ";" },
  { label: "Comma ,", value: "," },
  { label: "Tab", value: "\t" },
  { label: "Pipe |", value: "|" },
];

/** Import a deck from an .apkg (Anki) or delimited .csv/.txt file. */
export function ImportDialog({ open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [delimiter, setDelimiter] = useState(";");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isApkg = file?.name.toLowerCase().endsWith(".apkg");

  async function submit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const r = await importDeckFile(file, title.trim(), delimiter);
      onImported(r);
      onOpenChange(false);
      setFile(null); setTitle("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import deck</DialogTitle>
          <DialogDescription>Anki .apkg, or .csv / .txt with a chosen separator.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".apkg,.csv,.txt"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }}
          />
          <Button variant="outline" className="h-11 justify-start gap-2 rounded-xl" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" /> {file ? file.name : "Choose file (.apkg / .csv / .txt)"}
          </Button>

          <div className="flex flex-col gap-2">
            <Label htmlFor="import-title">Deck title</Label>
            <input
              id="import-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Imported deck"
              className="h-11 rounded-xl border border-input bg-background/60 px-3 text-sm outline-none focus-visible:border-primary/60 focus-visible:ring-4 focus-visible:ring-primary/15"
            />
          </div>

          {!isApkg && (
            <div className="flex flex-col gap-2">
              <Label>Separator (for csv / txt)</Label>
              <SelectMenu
                value={delimiter}
                onChange={setDelimiter}
                ariaLabel="Separator"
                className="w-full"
                options={DELIMS.map((d) => ({ value: d.value, label: d.label }))}
              />
              <p className="text-xs text-muted-foreground">Column 1 = front, column 2 = back.</p>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={submit} disabled={loading || !file} className="h-11 rounded-xl font-semibold">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : "Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
