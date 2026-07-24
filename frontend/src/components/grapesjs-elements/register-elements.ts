import {
  buttonElement,
  heroElement,
  featuresElement,
  testimonialsElement,
  ctaElement,
} from './custom-elements';
import { checkoutPlaceholderElement } from './checkout-placeholder';
import { featureItemElement, reviewItemElement, carouselBlockElement } from './content-blocks';

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

  // Checkout placeholder — a fixed marker, not freeform content: no traits,
  // can't accept nested drops, and its inner text can't be edited (the real
  // checkout form is a separate React component on the public page, not
  // something a merchant can hand-author here).
  editor.DomComponents.addType(checkoutPlaceholderElement.id, {
    model: {
      defaults: {
        attributes: checkoutPlaceholderElement.attributes || {},
        editable: false,
        droppable: false,
      },
    },
    view: {
      render() {
        return this;
      },
    },
  });

  editor.BlockManager.add(checkoutPlaceholderElement.id, {
    label: checkoutPlaceholderElement.label,
    content: { type: checkoutPlaceholderElement.id },
    category: checkoutPlaceholderElement.category,
    attributes: checkoutPlaceholderElement.attributes,
  });

  // Content-bound blocks: unlike the decorative elements above, these
  // traits actually update the rendered markup (real init() bindings),
  // since their output gets parsed back into structured `content` arrays
  // (features[]/reviews[]) on the backend rather than treated as opaque
  // freeform HTML.
  [featureItemElement, reviewItemElement].forEach((element) => {
    editor.DomComponents.addType(element.id, {
      model: {
        defaults: {
          traits: element.traits,
          attributes: element.attributes || {},
        },
        init(this: any) {
          element.traitBindings.forEach(({ trait, selector }: { trait: string; selector: string }) => {
            this.on(`change:${trait}`, () => {
              const target = this.find(selector)[0];
              if (target) target.components(this.get(trait));
            });
          });
        },
      },
      view: {
        render() {
          return this;
        },
      },
    });

    editor.BlockManager.add(element.id, {
      label: element.label,
      content: { type: element.id },
      category: element.category,
      attributes: element.attributes,
    });
  });

  // Carousel block: its one trait updates the component's own data
  // attribute (the gallery title), not a child element's text.
  editor.DomComponents.addType(carouselBlockElement.id, {
    model: {
      defaults: {
        traits: carouselBlockElement.traits,
        attributes: carouselBlockElement.attributes || {},
      },
      init(this: any) {
        this.on('change:carouselTitle', () => {
          this.addAttributes({ 'data-carousel-title': this.get('carouselTitle') });
        });
      },
    },
    view: {
      render() {
        return this;
      },
    },
  });

  editor.BlockManager.add(carouselBlockElement.id, {
    label: carouselBlockElement.label,
    content: { type: carouselBlockElement.id },
    category: carouselBlockElement.category,
    attributes: carouselBlockElement.attributes,
  });

  console.log('Custom elements registered:', [
    ...elements.map(e => e.id),
    checkoutPlaceholderElement.id,
    featureItemElement.id,
    reviewItemElement.id,
    carouselBlockElement.id,
  ]);
}

export {
  buttonElement, heroElement, featuresElement, testimonialsElement, ctaElement,
  checkoutPlaceholderElement, featureItemElement, reviewItemElement, carouselBlockElement,
};
