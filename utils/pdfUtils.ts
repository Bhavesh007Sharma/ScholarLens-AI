
// Access global PDF.js library loaded via CDN
export const getPdfLib = () => {
  const pdfjs = (window as any).pdfjsLib;
  if (!pdfjs) throw new Error("PDF.js library not loaded");
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return pdfjs;
};

export const getDocument = async (file: File): Promise<any> => {
  const pdfjs = getPdfLib();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  return await loadingTask.promise;
};

export const extractTextFromPdf = async (pdf: any): Promise<{ text: string; pageCount: number }> => {
  let fullText = '';
  const pageCount = pdf.numPages;

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items || [];
    const pageText = items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return { text: fullText, pageCount };
};

// New: Convert a PDF page to a base64 image for the AI to "see"
export const renderPageAsImage = async (pdf: any, pageNumber: number): Promise<string> => {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2.0 }); // High quality for AI
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  if (!context) throw new Error("Canvas context not available");
  
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  // Convert to base64 JPEG
  return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // Return only the data parts
};
