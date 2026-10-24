---
name: storefront-quality
description: Use for any UI work on the storefront or admin, including pages, components, styling, images, SEO and accessibility.
---

# Storefront quality

## Original, not copied
- Use our own brand (`docs/05-design/brand`). Never copy another site's logo, name, photos, text or distinctive layout details. Take ideas about features and flows only.

## Looks like a real store, not a template
- Build from design tokens in `tailwind.config.ts` (colors, type scale, spacing). One consistent system, no random one-off styles.
- Avoid the generic "AI template" look: default purple gradients, identical card grids everywhere, stock emoji icons, lorem ipsum. Real copy, real product-focused layouts.
- Every screen has real loading, empty and error states.

## Shopping UX that matters
- Product page: image gallery, size and size guide, stock state, delivery pincode check, price in rupees with discount, return info, add to cart that gives clear feedback.
- Mobile first. Checkout with the fewest possible steps. Cart persists.

## Accessibility (aim for WCAG 2.2 AA)
- Semantic HTML, labels on every input, visible focus, keyboard navigation, alt text, sufficient color contrast.

## Speed and SEO
- Use `next/image` with proper sizes and lazy loading. Watch Core Web Vitals.
- Per-page metadata, Product JSON-LD, sitemap and robots, clean slugs.

## Before saying a UI task is done
Run it, check it at phone and desktop width, check keyboard use, and check the empty and error states.
