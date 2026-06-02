# GrapesJS Custom Elements - Implementation Examples

**Document Purpose:** Show how to add custom elements like Elementor  
**Target:** Builders learning to extend GrapesJS  
**Created:** June 2, 2026

---

## 🎯 Adding Custom Elements to GrapesJS

### Overview: Element Structure

Every GrapesJS element has:
1. **Block Definition** (appears in sidebar)
2. **Component Model** (editor behavior)
3. **Traits** (editable properties)
4. **Styles** (CSS classes/inline)

---

## 📦 Example 1: Custom Button Element

### Full Implementation

```tsx
// frontend/src/components/grapesjs-elements/button-element.ts

export function registerButtonElement(editor: any) {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultModel = defaultType.model;
  const defaultView = defaultType.view;

  // Define Button Component
  domc.addType("button-custom", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "button",
        droppable: false,
        draggable: true,
        resizable: true,
        highlightable: true,
        copyable: true,
        script: function() {
          // Button click handler (if needed)
          console.log("Button clicked");
        },
        traits: [
          {
            name: "text",
            label: "Text",
            type: "text",
            default: "Click Me",
          },
          {
            name: "buttonType",
            label: "Button Type",
            type: "select",
            default: "primary",
            options: [
              { id: "primary", label: "Primary" },
              { id: "secondary", label: "Secondary" },
              { id: "danger", label: "Danger" },
            ],
          },
          {
            name: "size",
            label: "Size",
            type: "select",
            default: "md",
            options: [
              { id: "sm", label: "Small" },
              { id: "md", label: "Medium" },
              { id: "lg", label: "Large" },
            ],
          },
          {
            name: "url",
            label: "Link URL",
            type: "text",
            default: "#",
          },
        ],
      },
    }),
    view: defaultView,
  });

  // Add Button Block to sidebar
  editor.BlockManager.add("button-custom", {
    label: "Button",
    category: "Basic",
    content: {
      type: "button-custom",
      content: "Click Me",
      style: {
        padding: "10px 20px",
        "border-radius": "4px",
        "background-color": "#2563eb",
        color: "white",
        cursor: "pointer",
        "font-weight": "bold",
        border: "none",
      },
    },
    attributes: { class: "fa fa-mouse-pointer" },
  });
}
```

---

## 📦 Example 2: Hero Section Component

```tsx
// frontend/src/components/grapesjs-elements/hero-element.ts

export function registerHeroElement(editor: any) {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultModel = defaultType.model;
  const defaultView = defaultType.view;

  // Hero Section Component
  domc.addType("hero-section", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "section",
        droppable: true,
        resizable: true,
        traits: [
          {
            name: "bg_image",
            label: "Background Image",
            type: "text",
            default: "https://via.placeholder.com/1200x600",
          },
          {
            name: "height",
            label: "Height (px)",
            type: "number",
            default: 600,
          },
          {
            name: "overlay_opacity",
            label: "Overlay Opacity",
            type: "range",
            min: 0,
            max: 1,
            step: 0.1,
            default: 0.5,
          },
        ],
      },
    }),
    view: defaultView,
  });

  // Add Hero Block
  editor.BlockManager.add("hero-section", {
    label: "Hero Section",
    category: "Layout",
    content: {
      type: "hero-section",
      style: {
        height: "600px",
        "background-image": "url(https://via.placeholder.com/1200x600)",
        "background-size": "cover",
        "background-position": "center",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        position: "relative",
      },
      content: `
        <div style="z-index: 10; text-align: center; color: white;">
          <h1 style="font-size: 48px; margin: 0; font-weight: bold;">Your Headline Here</h1>
          <p style="font-size: 18px; margin-top: 20px;">Your subheadline here</p>
          <button style="margin-top: 30px; padding: 12px 30px; background: #2563eb; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;">Get Started</button>
        </div>
      `,
    },
    attributes: { class: "fa fa-image" },
  });
}
```

---

## 📦 Example 3: Features Grid Component

```tsx
// frontend/src/components/grapesjs-elements/features-element.ts

export function registerFeaturesElement(editor: any) {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultModel = defaultType.model;
  const defaultView = defaultType.view;

  // Feature Item Component
  domc.addType("feature-item", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "div",
        droppable: false,
        resizable: true,
        traits: [
          {
            name: "icon",
            label: "Icon (emoji or class)",
            type: "text",
            default: "⭐",
          },
          {
            name: "title",
            label: "Title",
            type: "text",
            default: "Feature Title",
          },
          {
            name: "description",
            label: "Description",
            type: "text",
            default: "Feature description goes here",
          },
        ],
      },
    }),
    view: defaultView,
  });

  // Features Grid Component
  domc.addType("features-grid", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "section",
        droppable: true,
        traits: [
          {
            name: "columns",
            label: "Columns",
            type: "select",
            default: "3",
            options: [
              { id: "2", label: "2 Columns" },
              { id: "3", label: "3 Columns" },
              { id: "4", label: "4 Columns" },
            ],
          },
        ],
      },
    }),
    view: defaultView,
  });

  // Add Features Block
  editor.BlockManager.add("features-grid", {
    label: "Features Grid",
    category: "Pro",
    content: {
      type: "features-grid",
      style: {
        padding: "60px 20px",
        "background-color": "#f9fafb",
      },
      content: `
        <div style="max-width: 1200px; margin: 0 auto;">
          <h2 style="text-align: center; font-size: 36px; margin-bottom: 50px; font-weight: bold;">Our Features</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px;">
            <div style="padding: 20px; background: white; border-radius: 8px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 15px;">⭐</div>
              <h3 style="font-size: 20px; margin: 10px 0; font-weight: bold;">Feature One</h3>
              <p style="color: #666; margin: 0;">Description of your first feature goes here</p>
            </div>
            <div style="padding: 20px; background: white; border-radius: 8px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 15px;">🚀</div>
              <h3 style="font-size: 20px; margin: 10px 0; font-weight: bold;">Feature Two</h3>
              <p style="color: #666; margin: 0;">Description of your second feature goes here</p>
            </div>
            <div style="padding: 20px; background: white; border-radius: 8px; text-align: center;">
              <div style="font-size: 40px; margin-bottom: 15px;">💡</div>
              <h3 style="font-size: 20px; margin: 10px 0; font-weight: bold;">Feature Three</h3>
              <p style="color: #666; margin: 0;">Description of your third feature goes here</p>
            </div>
          </div>
        </div>
      `,
    },
    attributes: { class: "fa fa-th" },
  });
}
```

---

## 📦 Example 4: Testimonials Component

```tsx
// frontend/src/components/grapesjs-elements/testimonials-element.ts

export function registerTestimonialsElement(editor: any) {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultModel = defaultType.model;
  const defaultView = defaultType.view;

  domc.addType("testimonials", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "section",
        droppable: true,
        traits: [
          {
            name: "columns",
            label: "Number of Testimonials",
            type: "select",
            default: "3",
            options: [
              { id: "1", label: "1" },
              { id: "2", label: "2" },
              { id: "3", label: "3" },
            ],
          },
        ],
      },
    }),
    view: defaultView,
  });

  editor.BlockManager.add("testimonials", {
    label: "Testimonials",
    category: "Pro",
    content: {
      type: "testimonials",
      style: {
        padding: "60px 20px",
        "background-color": "#ffffff",
      },
      content: `
        <div style="max-width: 1200px; margin: 0 auto;">
          <h2 style="text-align: center; font-size: 36px; margin-bottom: 50px; font-weight: bold;">What Our Customers Say</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px;">
            <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2563eb;">
              <p style="font-style: italic; color: #333; margin-bottom: 20px;">"This product changed my life! Highly recommended."</p>
              <div style="font-weight: bold; color: #000;">John Doe</div>
              <div style="color: #666; font-size: 14px;">CEO, Tech Company</div>
            </div>
            <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2563eb;">
              <p style="font-style: italic; color: #333; margin-bottom: 20px;">"Amazing experience! Best service ever."</p>
              <div style="font-weight: bold; color: #000;">Jane Smith</div>
              <div style="color: #666; font-size: 14px;">Founder, Design Studio</div>
            </div>
            <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #2563eb;">
              <p style="font-style: italic; color: #333; margin-bottom: 20px;">"Excellent quality and support!"</p>
              <div style="font-weight: bold; color: #000;">Mike Johnson</div>
              <div style="color: #666; font-size: 14px;">Entrepreneur</div>
            </div>
          </div>
        </div>
      `,
    },
    attributes: { class: "fa fa-quote-left" },
  });
}
```

---

## 📦 Example 5: CTA (Call-to-Action) Section

```tsx
// frontend/src/components/grapesjs-elements/cta-element.ts

export function registerCTAElement(editor: any) {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultModel = defaultType.model;
  const defaultView = defaultType.view;

  domc.addType("cta-section", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "section",
        droppable: true,
        traits: [
          {
            name: "headline",
            label: "Headline",
            type: "text",
            default: "Ready to get started?",
          },
          {
            name: "subheadline",
            label: "Subheadline",
            type: "text",
            default: "Join thousands of satisfied customers",
          },
          {
            name: "button_text",
            label: "Button Text",
            type: "text",
            default: "Start Free Trial",
          },
          {
            name: "button_url",
            label: "Button URL",
            type: "text",
            default: "#",
          },
          {
            name: "bg_color",
            label: "Background Color",
            type: "color",
            default: "#2563eb",
          },
        ],
      },
    }),
    view: defaultView,
  });

  editor.BlockManager.add("cta-section", {
    label: "Call to Action",
    category: "Pro",
    content: {
      type: "cta-section",
      style: {
        padding: "80px 20px",
        "background-color": "#2563eb",
        "text-align": "center",
        color: "white",
      },
      content: `
        <div style="max-width: 800px; margin: 0 auto;">
          <h2 style="font-size: 42px; margin: 0 0 20px 0; font-weight: bold;">Ready to get started?</h2>
          <p style="font-size: 18px; margin: 0 0 30px 0; opacity: 0.9;">Join thousands of satisfied customers</p>
          <a href="#" style="display: inline-block; padding: 14px 40px; background: white; color: #2563eb; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">Start Free Trial</a>
        </div>
      `,
    },
    attributes: { class: "fa fa-bullhorn" },
  });
}
```

---

## 🔌 Integrating All Elements

### Main Editor Setup File

```tsx
// frontend/src/components/grapesjs-with-elements.tsx

"use client";

import { useEffect, useRef } from "react";
import grapesjs from "grapesjs";
import grapesjsTailwind from "grapesjs-tailwind";

// Import custom element registrations
import { registerButtonElement } from "./grapesjs-elements/button-element";
import { registerHeroElement } from "./grapesjs-elements/hero-element";
import { registerFeaturesElement } from "./grapesjs-elements/features-element";
import { registerTestimonialsElement } from "./grapesjs-elements/testimonials-element";
import { registerCTAElement } from "./grapesjs-elements/cta-element";

export function LandingPageEditorWithElements() {
  const editorRef = useRef<any>(null);

  useEffect(() => {
    const editor = grapesjs.init({
      container: "#gjs",
      height: "100vh",
      width: "auto",
      plugins: [grapesjsTailwind],
      pluginsOpts: {
        grapesjsTailwind: {},
      },
    });

    // Register all custom elements
    registerButtonElement(editor);
    registerHeroElement(editor);
    registerFeaturesElement(editor);
    registerTestimonialsElement(editor);
    registerCTAElement(editor);

    editorRef.current = editor;

    return () => {
      editor.destroy();
    };
  }, []);

  return <div id="gjs" />;
}
```

---

## 🎨 Adding Style Traits to Elements

### Enhanced Button with Color Controls

```tsx
export function registerAdvancedButtonElement(editor: any) {
  const domc = editor.DomComponents;
  const defaultType = domc.getType("default");
  const defaultModel = defaultType.model;
  const defaultView = defaultType.view;

  const styleManager = editor.StyleManager;

  domc.addType("button-advanced", {
    model: defaultModel.extend({
      defaults: {
        ...defaultModel.prototype.defaults,
        tagName: "button",
        droppable: false,
        traits: [
          {
            name: "text",
            label: "Button Text",
            type: "text",
            default: "Click Me",
          },
          {
            name: "bg_color",
            label: "Background Color",
            type: "color",
            default: "#2563eb",
          },
          {
            name: "text_color",
            label: "Text Color",
            type: "color",
            default: "#ffffff",
          },
          {
            name: "padding",
            label: "Padding (px)",
            type: "number",
            default: 12,
          },
          {
            name: "border_radius",
            label: "Border Radius (px)",
            type: "number",
            default: 4,
          },
          {
            name: "font_size",
            label: "Font Size (px)",
            type: "number",
            default: 16,
          },
        ],
      },
    }),
    view: defaultView,
  });

  editor.BlockManager.add("button-advanced", {
    label: "Advanced Button",
    category: "Basic",
    content: {
      type: "button-advanced",
      content: "Click Me",
      style: {
        padding: "12px 30px",
        "border-radius": "4px",
        "background-color": "#2563eb",
        color: "#ffffff",
        cursor: "pointer",
        "font-weight": "bold",
        border: "none",
        "font-size": "16px",
      },
    },
    attributes: { class: "fa fa-mouse-pointer" },
  });
}
```

---

## 🧪 Testing Custom Elements

```tsx
// frontend/src/app/test/editor-with-elements.tsx

"use client";

import { LandingPageEditorWithElements } from "@/components/grapesjs-with-elements";

export default function EditorTestPage() {
  return (
    <div className="h-screen w-screen">
      <LandingPageEditorWithElements />
    </div>
  );
}
```

Access at: `http://localhost:3000/test/editor-with-elements`

---

## 📊 Element Complexity Chart

| Element | Complexity | Time to Build | Dependencies |
|---------|-----------|---------------|--------------|
| Button | ⭐ Easy | 30 mins | None |
| Hero Section | ⭐⭐ Medium | 1 hour | CSS |
| Features Grid | ⭐⭐ Medium | 1.5 hours | Grid system |
| Testimonials | ⭐⭐ Medium | 1.5 hours | None |
| CTA Section | ⭐⭐ Medium | 1 hour | None |
| **Total MVP** | **⭐⭐** | **5.5 hours** | - |

---

## 🚀 Next Phase Elements (After MVP)

### Elements to add in Phase 2:

```
- Video embed
- Image carousel
- Accordion/Toggle
- Icon box
- Stats counter
- Pricing table
- Contact form
- Newsletter signup
```

---

## ✅ Checklist: Custom Elements Implementation

- [ ] Button element tested
- [ ] Hero section tested
- [ ] Features grid tested
- [ ] Testimonials section tested
- [ ] CTA section tested
- [ ] All elements save/load correctly
- [ ] Responsive design verified
- [ ] Mobile preview tested
- [ ] Performance optimized

---

**Document Version:** 1.0  
**Created:** June 2, 2026  
**Ready to implement:** Yes  
**Estimated time to implement all examples:** 6-8 hours

