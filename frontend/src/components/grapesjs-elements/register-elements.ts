import {
  buttonElement,
  heroElement,
  featuresElement,
  testimonialsElement,
  ctaElement,
} from './custom-elements';

export function registerCustomElements(editor: any) {
  // Register block elements
  const elements = [
    buttonElement,
    heroElement,
    featuresElement,
    testimonialsElement,
    ctaElement,
  ];

  elements.forEach((element) => {
    // Register component
    editor.DomComponents.addType(element.id, {
      model: {
        defaults: {
          traits: element.traits || [],
          attributes: element.attributes || {},
        },
      },
      view: {
        render() {
          return this;
        },
      },
    });

    // Register block
    editor.BlockManager.add(element.id, {
      label: element.label,
      content: { type: element.id },
      category: element.category,
      attributes: element.attributes,
    });
  });

  console.log('Custom elements registered:', elements.map(e => e.id));
}

export { buttonElement, heroElement, featuresElement, testimonialsElement, ctaElement };
