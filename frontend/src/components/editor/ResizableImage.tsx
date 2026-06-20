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

  // Drag the corner handle to scale width. Height follows from height:auto,
  // so the aspect ratio is locked. Width is capped to the natural size and the
  // editor content width so the image never upscales or overflows the field.
  const startResize = useCallback((event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const img = imgRef.current;
    if (!img) return;

    const startX = event.clientX;
    const startWidth = img.offsetWidth;
    const natural = img.naturalWidth || startWidth;
    const contentWidth =
      (img.closest(".ProseMirror") as HTMLElement | null)?.clientWidth ?? natural;
    const cap = Math.min(natural || contentWidth, contentWidth || natural);

    setResizing(true);

    const onMove = (e: PointerEvent) => {
      const next = Math.round(
        Math.max(MIN_WIDTH, Math.min(startWidth + (e.clientX - startX), cap)),
      );
      updateAttributes({ width: next });
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [updateAttributes]);

  // Double-click toggles between full and the compact 64x64 pictogram.
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
          isPictogram ? "h-16 w-16 object-cover" : "h-auto",
          selected && "ring-2 ring-primary/60",
        )}
      />
      {editable && !isPictogram && (
        <span
          role="presentation"
          aria-hidden="true"
          onPointerDown={startResize}
          style={{ touchAction: "none" }}
          className={cn(
            "absolute -bottom-1 -right-1 h-3.5 w-3.5 cursor-nwse-resize rounded-full",
            "border border-background bg-primary shadow",
            "opacity-0 transition-opacity group-hover:opacity-100",
            selected && "opacity-100",
          )}
        />
      )}
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
