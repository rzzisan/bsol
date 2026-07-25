// Shared Tiptap schema for the Rich Text block — used by the builder's
// editor (frontend/src/components/landing-builder/block-fields.tsx) and by
// the public page's read-only renderer (generateHTML) so both agree on
// exactly what's allowed (bold/italic/link/list/heading — no raw HTML).
// Kept in its own file, separate from block-fields.tsx, so the public page
// doesn't have to bundle the editor UI (@tiptap/react hooks) just to render.
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

export const RICH_TEXT_EXTENSIONS = [StarterKit, Link.configure({ openOnClick: false })];
