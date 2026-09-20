const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');

(async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const root = path.resolve(__dirname, '..', '..');
  const source = path.join(root, 'output', 'pdf', 'OnChain-Wallet-Profiler-Methodology.pdf');
  const outDir = path.join(root, 'tmp', 'pdfs', 'rendered');
  fs.mkdirSync(outDir, { recursive: true });
  const data = new Uint8Array(fs.readFileSync(source));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  console.log(`pages=${pdf.numPages}`);
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    const output = path.join(outDir, `page-${pageNumber}.png`);
    fs.writeFileSync(output, canvas.toBuffer('image/png'));
    console.log(output);
  }
})();
