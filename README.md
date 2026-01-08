# WebCard Snapper

A powerful React application designed to batch extract, render, and capture high-quality images of HTML content (specifically `.card` elements) from uploaded HTML files.

**Repository:** [https://github.com/shuidong007-web/WebCardSnapper](https://github.com/shuidong007-web/WebCardSnapper)

## Features

- **Batch Processing:** Upload multiple HTML files at once (up to 10).
- **Format Preservation:** Uses a unique Sandbox Iframe approach to render cards in isolation. This prevents CSS conflicts (style bleeding) and ensures the layout (width, alignment, fonts) is preserved exactly as intended in the original design.
- **High Quality:** Captures screenshots at 2x scale (Retina quality) using `html2canvas`.
- **Bulk Download:** Download individual images or a generated `.zip` file of all captured cards.
- **Privacy Focused:** All processing happens client-side within the browser.

## How to use

1. Click "Click to upload .html file(s)".
2. Select your HTML files that contain `<div class="card">` elements.
3. Click "Start Screenshotting".
4. The app will process each card sequentially, rendering it in a hidden sandbox to ensure perfect layout.
5. Download your results.

## Tech Stack

- React
- TypeScript
- Tailwind CSS
- html2canvas
- JSZip
- Lucide React
