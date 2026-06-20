import Image from "@tiptap/extension-image";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import {
  useCallback, useRef, useState, type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
 * Resizable / pictogram image node.
 *
 * Extends the default @tiptap/extension-image with two extra, serialized
 * attributes and a custom React NodeView:
 *
 *   - `width`   number | null   chosen pixel width in "full" mode. Height is
 *                               never stored: the <img> keeps height:auto, so
 *                               the aspect ratio stays locked while resizing.
 *   - `display` "full" | "pictogram"   "pictogram" shows a tidy 64x64 inline
 *                               thumbnail; "full" shows the (capped) image.
 *
 * Both attributes parse from / render to the stored HTML so saved card content
 * round-trips. Newly inserted images carry no width and are capped to the
 * content width (max-width: 100% in CSS), so they are reasonable, not huge.
 * ------------------------------------------------------------------------ */

const MIN_WIDTH = 48; // px, smallest a full image may be dragged down to

type ImageDisplay = "full" | "pictogram";
type Corner = "nw" | "ne" | "sw" | "se";

const CORNERS: { corner: Corner; pos: string; cursor: string }[] = [
  { corner: "nw", pos: "-left-1 -top-1", cursor: "cursor-nwse-resize" },
  { corner: "ne", pos: "-right-1 -top-1", cursor: "cursor-nesw-resize" },
  { corner: "sw", pos: "-bottom-1 -left-1", cursor: "cursor-nesw-resize" },
  { corner: "se", pos: "-bottom-1 -right-1", cursor: "cursor-nwse-resize" },
];

function ResizableImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string | null) ?? "";
  const title = (node.attrs.title as string | null) ?? undefined;
  const width = node.attrs.width as number | null;
  const display = (node.attrs.display as ImageDisplay) ?? "full";

  const isPictogram = display === "pictogram";
  const editable = editor.isEditable;

  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);

  // Drag any corner handle to scale width; height follows from height:auto so
  // the aspect ratio stays locked. Left-side corners grow the image when dragged
  // outward (leftward), right-side corners when dragged rightward. Width may grow
  // up to the editor content width (small images can be enlarged) and shrink to
  // MIN_WIDTH.
  const startResize = useCallback(
    (event: ReactPointerEvent<HTMLSpanElement>, corner: Corner) => {
      event.preventDefault();
      event.stopPropagation();
      const img = imgRef.current;
      if (!img) return;

      const startX = event.clientX;
      const startWidth = img.offsetWidth;
      const contentWidth =
        (img.closest(".ProseMirror") as HTMLElement | null)?.clientWidth ?? startWidth;
      const cap = Math.max(contentWidth, startWidth);
      const growsLeft = corner === "nw" || corner === "sw";

      setResizing(true);

      const onMove = (e: PointerEvent) => {
        const dx = e.clientX - startX;
        const delta = growsLeft ? -dx : dx;
        const next = Math.round(Math.max(MIN_WIDTH, Math.min(startWidth + delta, cap)));
        updateAttributes({ width: next });
      };
      const onUp = () => {
        setResizing(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [updateAttributes],
  );

  // Double-click toggles between full and the compact pictogram thumbnail.
  const toggleDisplay = useCallback(() => {
    updateAttributes({ display: isPictogram ? "full" : "pictogram" });
  }, [isPictogram, updateAttributes]);

  return (
    <NodeViewWrapper
      as="div"
      className={cn("rt-image group relative my-2 inline-block max-w-full align-top")}
      data-display={display}
      data-resizing={resizing ? "true" : undefined}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        title={title}
        draggable={false}
        data-drag-handle
        onDoubleClick={(e) => { e.preventDefault(); toggleDisplay(); }}
        style={!isPictogram && width ? { width: `${width}px` } : undefined}
        className={cn(
          "block max-w-full cursor-grab rounded-lg",
          isPictogram ? "h-28 w-28 object-cover" : "h-auto",
          selected && "ring-2 ring-primary/60",
        )}
      />
      {editable && !isPictogram &&
        CORNERS.map(({ corner, pos, cursor }) => (
          <span
            key={corner}
            role="presentation"
            aria-hidden="true"
            onPointerDown={(e) => startResize(e, corner)}
            style={{ touchAction: "none" }}
            className={cn(
              "absolute h-3.5 w-3.5 rounded-full border border-background bg-primary shadow",
              "opacity-0 transition-opacity group-hover:opacity-100",
              pos,
              cursor,
              selected && "opacity-100",
            )}
          />
        ))}
    </NodeViewWrapper>
  );
}

/** Image node with locked-aspect resize, pictogram toggle, and drag-to-move. */
export const ResizableImage = Image.extend({
  draggable: true,

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const styleWidth = element.style.width || "";
          const match = styleWidth.match(/^(\d+(?:\.\d+)?)px$/);
          if (match) return Math.round(parseFloat(match[1]));
          const attr = element.getAttribute("width");
          if (attr) {
            const n = parseFloat(attr);
            return Number.isFinite(n) ? Math.round(n) : null;
          }
          return null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width || attributes.display === "pictogram") return {};
          return { style: `width: ${attributes.width}px` };
        },
      },
      display: {
        default: "full",
        parseHTML: (element) =>
          element.getAttribute("data-display") === "pictogram" ? "pictogram" : "full",
        renderHTML: (attributes) =>
          attributes.display === "pictogram" ? { "data-display": "pictogram" } : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});
