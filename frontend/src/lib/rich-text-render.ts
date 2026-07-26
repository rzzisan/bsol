// Pure string-based renderer for the Rich Text block's Tiptap JSON.
//
// We used to call @tiptap/core's generateHTML() for this, but it goes
// through prosemirror-model's DOMSerializer, which requires a real `window`.
// This component renders during Next.js SSR (no DOM in the Node process),
// so generateHTML threw there and the caller's try/catch swallowed it into
// an empty string. React then hydrates without ever re-diffing
// dangerouslySetInnerHTML against the correct client-computed value, so the
// body stayed blank forever, not just on first paint. Walking the JSON
// ourselves needs no DOM, so server and client always agree.
//
// Covers exactly the node/mark types reachable through RICH_TEXT_EXTENSIONS
// (StarterKit + Link): both the toolbar buttons and StarterKit's built-in
// markdown input rules (e.g. "# ", "> ", "```", "---").
import type { JSONContent } from "@tiptap/core";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarks(text: string, marks: JSONContent["marks"]): string {
  let html = escapeHtml(text);
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case "bold":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
        html = `<em>${html}</em>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link": {
        const href = String(mark.attrs?.href ?? "");
        html = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer nofollow">${html}</a>`;
        break;
      }
      default:
        break;
    }
  }
  return html;
}

function renderNodes(nodes: JSONContent[] | undefined): string {
  return (nodes ?? []).map(renderNode).join("");
}

function renderNode(node: JSONContent): string {
  switch (node.type) {
    case "text":
      return renderMarks(node.text ?? "", node.marks);
    case "paragraph":
      return `<p>${renderNodes(node.content)}</p>`;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1));
      return `<h${level}>${renderNodes(node.content)}</h${level}>`;
    }
    case "bulletList":
      return `<ul>${renderNodes(node.content)}</ul>`;
    case "orderedList":
      return `<ol>${renderNodes(node.content)}</ol>`;
    case "listItem":
      return `<li>${renderNodes(node.content)}</li>`;
    case "blockquote":
      return `<blockquote>${renderNodes(node.content)}</blockquote>`;
    case "codeBlock":
      return `<pre><code>${escapeHtml((node.content ?? []).map((n) => n.text ?? "").join(""))}</code></pre>`;
    case "horizontalRule":
      return "<hr/>";
    case "hardBreak":
      return "<br/>";
    default:
      return renderNodes(node.content);
  }
}

export function renderTiptapJSON(doc: JSONContent | null | undefined): string {
  if (!doc) return "";
  try {
    return renderNodes(doc.content);
  } catch {
    return "";
  }
}
