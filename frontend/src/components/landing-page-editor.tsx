"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import grapesjs from "grapesjs";
import grapesjsTailwind from "grapesjs-tailwind";
import GjsPluginCkeditor from "grapesjs-plugin-ckeditor";
import "grapesjs/dist/css/grapes.min.css";
import { registerCustomElements } from "./grapesjs-elements/register-elements";

interface LandingPageEditorProps {
  pageId: string;
  token: string;
  apiBaseUrl: string;
  onSave?: (html: string, css: string) => void;
}

export function LandingPageEditor({
  pageId,
  token,
  apiBaseUrl,
  onSave,
}: LandingPageEditorProps) {
  const editorRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save mechanism
  const autoSave = useCallback(async () => {
    if (!editorRef.current || !isDirty) return;

    setIsSaving(true);
    try {
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const components = editorRef.current.getComponents();
      const styles = editorRef.current.getStyles();

      const response = await fetch(
        `${apiBaseUrl}/api/landing/editor/${pageId}/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            components_json: JSON.stringify(components),
            styles_json: JSON.stringify(styles),
            html_output: html,
            css_output: css,
          }),
        }
      );

      if (!response.ok) throw new Error("Save failed");

      setLastSaved(new Date());
      setIsDirty(false);
      onSave?.(html, css);
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [pageId, token, apiBaseUrl, onSave, isDirty]);

  // Initialize editor
  useEffect(() => {
    const initEditor = async () => {
      try {
        // Load existing page data
        const response = await fetch(
          `${apiBaseUrl}/api/landing/editor/${pageId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error("Failed to load page");

        const { data } = await response.json();

        // Initialize GrapesJS
        const editor = grapesjs.init({
          container: "#gjs-editor",
          height: "100vh",
          width: "auto",
          storageManager: false,
          plugins: [grapesjsTailwind, GjsPluginCkeditor],
          pluginsOpts: {
            grapesjsTailwind: {},
            "grapesjs-plugin-ckeditor": {
              options: {
                toolbar: ["Bold", "Italic", "Underline", "Link"],
              },
            },
          },
          blockManager: {
            blocks: [
              {
                id: "section",
                label: "Section",
                content: '<section class="w-full py-12 px-4"></section>',
                category: "Layout",
                attributes: { class: "fa fa-square-o" },
              },
              {
                id: "text",
                label: "Text",
                content: "<p>Your text here</p>",
                category: "Basic",
                attributes: { class: "fa fa-font" },
              },
              {
                id: "image",
                label: "Image",
                content:
                  '<img src="https://via.placeholder.com/350x250" alt="image" />',
                category: "Basic",
                attributes: { class: "fa fa-image" },
              },
              {
                id: "button",
                label: "Button",
                content: '<button class="px-6 py-2 bg-blue-600 text-white rounded">Click me</button>',
                category: "Basic",
                attributes: { class: "fa fa-hand-pointer-o" },
              },
              {
                id: "link",
                label: "Link",
                content: '<a href="#" class="text-blue-600 underline">Link</a>',
                category: "Basic",
                attributes: { class: "fa fa-link" },
              },
            ],
          },
        });

        // Register custom elements
        registerCustomElements(editor);

        // Load saved content if exists
        if (data?.components_json) {
          try {
            const components = JSON.parse(data.components_json);
            editor.setComponents(components);
          } catch (e) {
            console.warn("Could not parse saved components");
          }
        }

        // Mark dirty on changes
        editor.on("change:component", () => setIsDirty(true));
        editor.on("style:change", () => setIsDirty(true));

        editorRef.current = editor;

        // Setup auto-save interval
        autoSaveIntervalRef.current = setInterval(() => {
          autoSave();
        }, 30000); // 30 seconds

        return () => {
          if (autoSaveIntervalRef.current) {
            clearInterval(autoSaveIntervalRef.current);
          }
          editor.destroy();
        };
      } catch (error) {
        console.error("Editor initialization error:", error);
      }
    };

    initEditor();
  }, [pageId, token, apiBaseUrl, autoSave]);

  // Manual save
  const handleManualSave = () => {
    autoSave();
  };

  // Publish page
  const handlePublish = async () => {
    if (!editorRef.current) return;

    try {
      // Save first
      await autoSave();

      // Then publish
      const response = await fetch(
        `${apiBaseUrl}/api/landing/editor/${pageId}/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Publish failed");

      const result = await response.json();
      alert("Page published successfully!");
      console.log("Published page:", result.data);
    } catch (error) {
      console.error("Publish error:", error);
      alert("Failed to publish page");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Landing Page Editor</h1>
          <div className="flex gap-2">
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => editorRef.current?.undo()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Undo
            </button>
            <button
              onClick={() => editorRef.current?.redo()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Redo
            </button>
            <button
              onClick={handlePublish}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Publish
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          {isSaving && <span className="animate-pulse">Saving...</span>}
          {lastSaved && !isSaving && (
            <span className="text-green-600">
              Saved at {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {isDirty && !isSaving && (
            <span className="text-orange-600">● Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div id="gjs-editor" className="flex-1" />
    </div>
  );
}
