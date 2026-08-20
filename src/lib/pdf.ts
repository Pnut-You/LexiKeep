import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

export class PdfNoTextError extends Error {
  constructor() {
    super('PDF_NO_TEXT');
    this.name = 'PdfNoTextError';
  }
}

function joinTextItems(items: Array<{ str: string; hasEOL?: boolean }>): string {
  const lines: string[] = [];
  let line = '';

  for (const item of items) {
    const text = item.str.trim();
    if (text) {
      line += `${line ? ' ' : ''}${text}`;
    }
    if (item.hasEOL && line) {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

export async function extractPdfText(data: Uint8Array): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const loadingTask = getDocument({ data });
  const document = await loadingTask.promise;
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = joinTextItems(
        textContent.items.filter((item): item is typeof item & { str: string } => 'str' in item),
      );
      if (pageText) pages.push(pageText);
      page.cleanup();
    }
    const text = pages.join('\n\n').trim();
    if (!text) throw new PdfNoTextError();
    return text;
  } finally {
    await loadingTask.destroy();
  }
}
