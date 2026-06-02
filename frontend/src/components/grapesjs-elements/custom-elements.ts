export const buttonElement = {
  id: 'button',
  label: 'Button',
  category: 'Basic',
  content: `
    <button style="
      padding: 12px 24px;
      background-color: #3B82F6;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.3s;
    " onmouseover="this.style.backgroundColor='#2563EB'" onmouseout="this.style.backgroundColor='#3B82F6'">
      Click Me
    </button>
  `,
  attributes: { class: 'fa fa-hand-pointer-o' },
  traits: [
    {
      type: 'text',
      name: 'text',
      label: 'Button Text',
      default: 'Click Me',
    },
    {
      type: 'color',
      name: 'bgColor',
      label: 'Background Color',
      default: '#3B82F6',
    },
    {
      type: 'color',
      name: 'textColor',
      label: 'Text Color',
      default: '#FFFFFF',
    },
    {
      type: 'text',
      name: 'url',
      label: 'Link URL',
      default: '#',
    },
  ],
};

export const heroElement = {
  id: 'hero',
  label: 'Hero Section',
  category: 'Sections',
  content: `
    <section style="
      padding: 80px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      min-height: 500px;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="max-width: 800px;">
        <h1 style="font-size: 48px; font-weight: bold; margin-bottom: 20px;">
          Welcome to Our Hero Section
        </h1>
        <p style="font-size: 18px; margin-bottom: 30px; opacity: 0.9;">
          Create stunning landing pages with our drag-and-drop editor
        </p>
        <button style="
          padding: 12px 32px;
          background-color: white;
          color: #667eea;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        ">
          Get Started
        </button>
      </div>
    </section>
  `,
  attributes: { class: 'fa fa-window-maximize' },
  traits: [
    {
      type: 'text',
      name: 'title',
      label: 'Title',
      default: 'Welcome to Our Hero Section',
    },
    {
      type: 'text',
      name: 'subtitle',
      label: 'Subtitle',
      default: 'Create stunning landing pages with our drag-and-drop editor',
    },
    {
      type: 'color',
      name: 'bgColor',
      label: 'Background Color',
      default: '#667eea',
    },
  ],
};

export const featuresElement = {
  id: 'features',
  label: 'Features Grid',
  category: 'Sections',
  content: `
    <section style="padding: 60px 20px; background-color: #f9fafb;">
      <div style="max-width: 1200px; margin: 0 auto;">
        <h2 style="font-size: 36px; font-weight: bold; text-align: center; margin-bottom: 50px;">
          Our Features
        </h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
          <div style="padding: 30px; background: white; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="font-size: 40px; margin-bottom: 15px;">🎨</div>
            <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">Easy to Use</h3>
            <p style="color: #6b7280;">Drag and drop interface makes it simple to build pages</p>
          </div>
          <div style="padding: 30px; background: white; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="font-size: 40px; margin-bottom: 15px;">⚡</div>
            <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">Fast Performance</h3>
            <p style="color: #6b7280;">Optimized for speed and search engines</p>
          </div>
          <div style="padding: 30px; background: white; border-radius: 8px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <div style="font-size: 40px; margin-bottom: 15px;">📱</div>
            <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">Responsive</h3>
            <p style="color: #6b7280;">Works perfectly on all devices and screen sizes</p>
          </div>
        </div>
      </div>
    </section>
  `,
  attributes: { class: 'fa fa-th' },
  traits: [
    {
      type: 'text',
      name: 'title',
      label: 'Section Title',
      default: 'Our Features',
    },
    {
      type: 'text',
      name: 'itemCount',
      label: 'Number of Features',
      default: '3',
    },
  ],
};

export const testimonialsElement = {
  id: 'testimonials',
  label: 'Testimonials',
  category: 'Sections',
  content: `
    <section style="padding: 60px 20px; background-color: white;">
      <div style="max-width: 1200px; margin: 0 auto;">
        <h2 style="font-size: 36px; font-weight: bold; text-align: center; margin-bottom: 50px;">
          What Our Customers Say
        </h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 30px;">
          <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3B82F6;">
            <div style="display: flex; margin-bottom: 15px;">
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
            </div>
            <p style="margin-bottom: 15px; color: #374151; font-size: 15px;">
              "Amazing tool! It saved us so much time building our landing page. Highly recommended!"
            </p>
            <p style="font-weight: 600; color: #111827;">John Smith</p>
            <p style="color: #6b7280; font-size: 14px;">CEO, Tech Company</p>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3B82F6;">
            <div style="display: flex; margin-bottom: 15px;">
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
            </div>
            <p style="margin-bottom: 15px; color: #374151; font-size: 15px;">
              "The best landing page builder I've ever used. Easy, powerful, and intuitive!"
            </p>
            <p style="font-weight: 600; color: #111827;">Sarah Johnson</p>
            <p style="color: #6b7280; font-size: 14px;">Marketing Director, StartUp Inc</p>
          </div>
          <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3B82F6;">
            <div style="display: flex; margin-bottom: 15px;">
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
              <span style="color: #fbbf24;">★</span>
            </div>
            <p style="margin-bottom: 15px; color: #374151; font-size: 15px;">
              "Fantastic support and constantly adding new features. Worth every penny!"
            </p>
            <p style="font-weight: 600; color: #111827;">Mike Davis</p>
            <p style="color: #6b7280; font-size: 14px;">Founder, Creative Agency</p>
          </div>
        </div>
      </div>
    </section>
  `,
  attributes: { class: 'fa fa-comments' },
  traits: [
    {
      type: 'text',
      name: 'title',
      label: 'Section Title',
      default: 'What Our Customers Say',
    },
  ],
};

export const ctaElement = {
  id: 'cta',
  label: 'CTA Section',
  category: 'Sections',
  content: `
    <section style="
      padding: 60px 20px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      text-align: center;
    ">
      <div style="max-width: 800px; margin: 0 auto;">
        <h2 style="font-size: 36px; font-weight: bold; margin-bottom: 15px;">
          Ready to Get Started?
        </h2>
        <p style="font-size: 18px; margin-bottom: 30px; opacity: 0.9;">
          Join thousands of satisfied customers and create your landing page today!
        </p>
        <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
          <button style="
            padding: 12px 32px;
            background-color: white;
            color: #f5576c;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
          ">
            Get Started Free
          </button>
          <button style="
            padding: 12px 32px;
            background-color: transparent;
            color: white;
            border: 2px solid white;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
          ">
            Learn More
          </button>
        </div>
      </div>
    </section>
  `,
  attributes: { class: 'fa fa-bullhorn' },
  traits: [
    {
      type: 'text',
      name: 'title',
      label: 'Title',
      default: 'Ready to Get Started?',
    },
    {
      type: 'text',
      name: 'subtitle',
      label: 'Subtitle',
      default: 'Join thousands of satisfied customers and create your landing page today!',
    },
    {
      type: 'color',
      name: 'bgColor',
      label: 'Background Color',
      default: '#f5576c',
    },
  ],
};
