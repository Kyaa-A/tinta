# TINTA

**TINTA** — Tools for Inspiring New Tones & Art

A professional-grade color extraction tool that transforms images into beautiful, accurate color palettes. Features perceptual color algorithms, live UI preview, and palette manipulation tools.

*TINTA* is the Filipino word for "ink" — the essential medium that brings art to life.

![Screenshot 2025-01-03 160332](https://github.com/user-attachments/assets/404d58b5-38e8-4cba-b21e-c8b314083bc8)

**[Live Demo](https://tinta-extractor.vercel.app/)** — Try TINTA online now!

## Features

### Color Extraction
- **Perceptual Algorithm** — CIEDE2000 + OKLab color space for human-vision accuracy
- **8 Extraction Methods** — Vibrant, K-Means, Median-Cut, Octree, Weighted K-Means, Fast Average, Combined, and Perceptual
- **Smart Filtering** — Removes noise, duplicates, and invalid colors automatically

### Live UI Preview
- Preview your extracted palette in a real UI mockup
- Toggle between light and dark mode
- See how colors work together in buttons, cards, and text

### Palette Tools
- **Tints & Shades** — Generate lighter and darker variations
- **Gradients** — Create smooth transitions between colors
- **Adjustments** — Fine-tune saturation and brightness
- **Color Harmony** — View complementary, analogous, and triadic colors

### Export Options
- Copy individual colors or entire palette
- Multiple formats: HEX, RGB, HSL
- Download as JSON with full metadata

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## Usage

1. **Upload** — Drag & drop, click to browse, or paste from clipboard (Ctrl+V)
2. **Extract** — Colors are automatically extracted using perceptual algorithms
3. **Explore** — Use palette tools to generate tints, shades, and gradients
4. **Preview** — See your palette in the live UI preview
5. **Export** — Copy colors or download the full palette

## Tech Stack

- **React 18** + **Vite** + **Tailwind CSS**
- **node-vibrant** + **fast-average-color**
- **Framer Motion** for animations
- **Custom algorithms**: CIEDE2000, OKLab, K-Means++

## Algorithm Guide

| Algorithm | Best For |
|-----------|----------|
| Perceptual | Most accurate, human-vision optimized |
| Combined | Maximum coverage, runs all methods |
| Vibrant | Artistic images with bold colors |
| K-Means | Photos with distinct color regions |
| Weighted K-Means | Portraits, centered compositions |
| Median-Cut | Color quantization tasks |
| Octree | Complex images with many variations |

## Browser Support

Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

**Built with care for designers, developers, and color enthusiasts**

*TINTA* — Where every image becomes a palette of possibilities.
