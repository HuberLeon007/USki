import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { ResizableImage } from "./ResizableImage";
import {
  createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Code,
  Quote, Subscript as SubIcon, Superscript as SupIcon, Indent, Outdent,
  Undo2, Redo2, ImagePlus,
} from "lucide-react";
import { uploadImage, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface RichTextFieldProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const MAX_INDENT = 3; // R: up to 3 levels of list indentation

/* --------------------------------------------------------------------------
 * Shared-toolbar context.
 *
 * Multiple fields (e.g. card front + back) share ONE toolbar. Each field
 * registers as the "active" editor on focus; the toolbar always acts on the
 * currently focused editor. The toolbar lives above all fields.
 * ------------------------------------------------------------------------ */
interface RichTextCtx {
  active: Editor | null;
  setActive: (e: Editor | null) => void;
}
const Ctx = createContext<RichTextCtx | null>(null);

/** Provides the shared "active editor" so a single Toolbar can drive many fields. */
export function RichTextProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Editor | null>(null);
  return <Ctx.Provider value={{ active, setActive }}>{children}</Ctx.Provider>;
}

function useRichCtx(): RichTextCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("RichText components must be wrapped in <RichTextProvider>");
  return ctx;
}

async function uploadAndInsert(editor: Editor | null, file: File) {
  if (!editor) return;
  try {
    const { url } = await uploadImage(file);
    editor.chain().focus().setImage({ src: url }).run();
  } catch (err) {
    toast.error(err instanceof ApiError ? err.message : "Image upload failed");
  }
}

/* --------------------------------------------------------------------------
 * Toolbar: drives whichever field is currently focused.
 * ------------------------------------------------------------------------ */
export function RichTextToolbar() {
  const { active } = useRichCtx();
  const fileRef = useRef<HTMLInputElement>(null);
  // Re-render on the active editor's transactions so button states stay live.
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!active) return;
    const cb = () => force();
    active.on("transaction", cb);
    active.on("selectionUpdate", cb);
    active.on("focus", cb);
    return () => {
      active.off("transaction", cb);
      active.off("selectionUpdate", cb);
      active.off("focus", cb);
    };
  }, [active]);

  const ed = active;
  const on = (fn: (e: Editor) => void) => () => { if (ed) fn(ed); };
  const is = (name: string, attrs?: Record<string, unknown>) => Boolean(ed?.isActive(name, attrs));

  const inList = is("bulletList") || is("orderedList");
  const indentDepth = ed ? (ed.state.selection.$from.depth - 2) / 2 : 0;

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 rounded-xl border border-input bg-background/85 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <Btn dim={!ed} active={false} onClick={on((e) => e.chain().focus().undo().run())} label="Undo"><Undo2 className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={false} onClick={on((e) => e.chain().focus().redo().run())} label="Redo"><Redo2 className="h-4 w-4" /></Btn>
      <Divider />
      <Btn dim={!ed} active={is("bold")} onClick={on((e) => e.chain().focus().toggleBold().run())} label="Bold"><Bold className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("italic")} onClick={on((e) => e.chain().focus().toggleItalic().run())} label="Italic"><Italic className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("underline")} onClick={on((e) => e.chain().focus().toggleUnderline().run())} label="Underline"><UnderlineIcon className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("subscript")} onClick={on((e) => e.chain().focus().toggleSubscript().run())} label="Subscript"><SubIcon className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("superscript")} onClick={on((e) => e.chain().focus().toggleSuperscript().run())} label="Superscript"><SupIcon className="h-4 w-4" /></Btn>
      <Divider />
      <Btn dim={!ed} active={is("heading", { level: 2 })} onClick={on((e) => e.chain().focus().toggleHeading({ level: 2 }).run())} label="Heading"><Heading2 className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("bulletList")} onClick={on((e) => e.chain().focus().toggleBulletList().run())} label="Bullet list"><List className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("orderedList")} onClick={on((e) => e.chain().focus().toggleOrderedList().run())} label="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
      <Btn dim={!ed || !inList} active={false} onClick={on((e) => e.chain().focus().liftListItem("listItem").run())} label="Outdent"><Outdent className="h-4 w-4" /></Btn>
      <Btn dim={!ed || !inList} active={false} onClick={on((e) => { if (indentDepth < MAX_INDENT) e.chain().focus().sinkListItem("listItem").run(); })} label="Indent"><Indent className="h-4 w-4" /></Btn>
      <Divider />
      <Btn dim={!ed} active={is("codeBlock")} onClick={on((e) => e.chain().focus().toggleCodeBlock().run())} label="Code block"><Code className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={is("blockquote")} onClick={on((e) => e.chain().focus().toggleBlockquote().run())} label="Quote"><Quote className="h-4 w-4" /></Btn>
      <Btn dim={!ed} active={false} onClick={() => fileRef.current?.click()} label="Insert image"><ImagePlus className="h-4 w-4" /></Btn>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAndInsert(ed, f); e.target.value = ""; }}
      />
    </div>
  );
}

/* --------------------------------------------------------------------------
 * A single editable field. Registers itself with the shared toolbar on focus.
 * Supports image paste (Ctrl+V) and drag-drop, and protects images from being
 * deleted when typing onto a selected image node.
 * ------------------------------------------------------------------------ */
export function RichTextField({ value, onChange, placeholder, ariaLabel }: RichTextFieldProps) {
  const { active, setActive } = useRichCtx();
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Subscript,
      Superscript,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    onFocus: ({ editor }) => setActive(editor),
    editorProps: {
      attributes: {
        class: "prose-card min-h-24 w-full rounded-xl px-3 py-2 outline-none",
        "aria-label": ariaLabel ?? "Rich text editor",
      },
      // Paste images straight from the clipboard.
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => uploadAndInsert(editorRef.current, f));
        return true;
      },
      // Drop images onto the editor.
      handleDrop: (_view, event) => {
        const dt = (event as DragEvent).dataTransfer;
        const files = Array.from(dt?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => uploadAndInsert(editorRef.current, f));
        return true;
      },
      // Guard: typing while an image node is selected must NOT replace/delete it.
      // Instead, insert the text right after the image and keep the picture.
      handleTextInput: (view, _from, _to, text) => {
        const sel = view.state.selection as unknown as { node?: { type: { name: string } }; to: number };
        if (sel.node && sel.node.type.name === "image") {
          const pos = sel.to;
          view.dispatch(view.state.tr.insertText(text, pos));
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => { editorRef.current = editor; }, [editor]);

  useEffect(() => {
    if (editor && value !== editor.getHTML()) editor.commands.setContent(value);
  }, [value, editor]);

  // Clear shared "active" when this field unmounts while focused.
  useEffect(() => {
    return () => { if (editor) setActive(active === editor ? null : active); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-input bg-background/60 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/15">
      <EditorContent editor={editor} />
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Standalone convenience: a self-contained field with its own toolbar.
 * Use <RichTextProvider> + <RichTextToolbar> + multiple <RichTextField>
 * when several fields should share one toolbar.
 * ------------------------------------------------------------------------ */
export function RichTextEditor(props: RichTextFieldProps) {
  return (
    <RichTextProvider>
      <div className="space-y-2">
        <RichTextToolbar />
        <RichTextField {...props} />
      </div>
    </RichTextProvider>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px bg-border/60" />;
}

function Btn({ active, dim, onClick, label, children }: {
  active: boolean; dim?: boolean; onClick: () => void; label: string; children: ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={dim}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Read-only renderer for stored card HTML (already server-sanitized). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("prose-card", className)}
      dangerouslySetInnerHTML={{ __html: html || "<p class='text-muted-foreground'>Empty</p>" }}
    />
  );
}
