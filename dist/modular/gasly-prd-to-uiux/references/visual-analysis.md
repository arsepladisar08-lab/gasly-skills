# Image-First Visual Analysis Checklist

Gunakan checklist ini saat pengguna mengunggah screenshot, export layar, atau referensi UI.

## Evidence vs. Interpretation
- **Observed:** elemen yang benar-benar terlihat pada gambar.
- **Inferred:** dugaan mengenai interaksi, breakpoint, komponen, atau sistem yang tidak tampak.
- **Unknown:** detail yang tidak dapat disimpulkan dari gambar.

Jangan menyatakan interaksi, responsivitas, aksesibilitas, atau struktur data sebagai fakta hanya dari satu screenshot.

## 12 Inspection Dimensions
1. **Overall style:** visual genre, product character, and degree of originality.
2. **Color system:** background, surface, text, accent, semantic status; sample colors are estimates until verified.
3. **Typography:** font character, hierarchy, size relationships, line length, and weights.
4. **Layout:** page structure, grids, alignment, visual hierarchy, and information architecture.
5. **Spacing:** container widths, gutters, rhythm, and component padding.
6. **Shape:** border, corner radius, dividers, and separators.
7. **Elevation:** shadows, overlays, layering, and depth.
8. **Components:** buttons, forms, cards, navigation, tables, dialogs, badges, and data visualizations.
9. **Iconography:** stroke/solid system, sizes, alignment, and consistency.
10. **Imagery:** illustration, photography, crop, aspect ratio, and art direction.
11. **Brand personality:** warmth, confidence, playfulness, seriousness, and density.
12. **Screen context:** desktop/mobile viewport clues, user role, and screen purpose.

## Output Format
- Visual summary (3–5 sentences).
- Evidence table: dimension | observed evidence | confidence | implementation implication.
- Design tokens/preset candidates and mismatches against current canonical preset.
- Component inventory and layout hierarchy.
- Missing information / questions (maximum 3, only material uncertainties).
- Implementation risks: contrast estimation, missing mobile states, ambiguous behaviors, and content not represented in screenshot.

## Design Audit Rules
- Use screenshots as visual reference, not as proof of requirements.
- Use PRD for product behavior and content; if PRD conflicts with screenshot, report the conflict.
- Do not infer user permissions, hidden screens, data values, or business claims from visual appearance.
- Keep intentional visual differences where they contribute to the reference; do not normalize every product into one template.

