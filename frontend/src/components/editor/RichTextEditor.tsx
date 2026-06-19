import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { Bold, Italic, List, ListOrdered, Heading2, Code } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * TipTap rich-text editor. Emits sanitized-on-server HTML. Toolbar covers the
 * formatting the card model supports (bold/italic/headings/lists/code).
 */
export function RichTextEditor({ value, onChange, placeholder, ariaLabel }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write…" }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose-card min-h-24 w-full rounded-b-xl px-3 py-2 outline-none",
        "aria-label": ariaLabel ?? "Rich text editor",
      },
    },
  });

  // Keep external value in sync when it changes from outside (e.g. switching cards).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) return null;

  const Btn = ({ active, onClick, label, children }: {
    active: boolean; onClick: () => void; label: string; children: React.ReactNode;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-xl border border-input bg-background/60 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/15">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/50 p-1">
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold"><Bold className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic"><Italic className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="Heading"><Heading2 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="Bullet list"><List className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="Numbered list"><ListOrdered className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="Code block"><Code className="h-4 w-4" /></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/** Read-only renderer for stored card HTML (already server-sanitized). */
export function RichTextView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn("prose-card", className)}
      // Server sanitizes on write; this is safe display of stored content.
      dangerouslySetInnerHTML={{ __html: html || "<p class='text-muted-foreground'>Empty</p>" }}
    />
  );
}
