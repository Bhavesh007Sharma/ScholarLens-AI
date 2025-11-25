import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronLeft, ZoomIn, ZoomOut, FileText } from 'lucide-react';
import { Button } from './Button';

interface PdfViewerProps {
  pdfDocument: any;
  pageNumber: number;
  onPageChange: (page: number) => void;
  onTextSelect?: (e: MouseEvent) => void;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ pdfDocument, pageNumber, onPageChange, onTextSelect }) => {
  const [scale, setScale] = useState(1.2); 
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    // If no document (e.g. restored session without re-upload), don't render
    if (!pdfDocument || !canvasRef.current) return;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        const textLayerDiv = textLayerRef.current;

        if (canvas && context) {
          // 1. Render Visual Canvas
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };

          const renderTask = page.render(renderContext);
          renderTaskRef.current = renderTask;
          await renderTask.promise;

          // 2. Render Text Layer for Selection
          if (textLayerDiv) {
            textLayerDiv.innerHTML = ''; // Clear previous text
            
            // Strict styling to ensure overlap
            textLayerDiv.style.height = `${viewport.height}px`;
            textLayerDiv.style.width = `${viewport.width}px`;
            textLayerDiv.style.setProperty('--scale-factor', `${scale}`);
            textLayerDiv.style.position = 'absolute';
            textLayerDiv.style.top = '0';
            textLayerDiv.style.left = '0';
            textLayerDiv.style.zIndex = '10'; // Ensure it is above canvas

            const textContent = await page.getTextContent();
            const pdfjsLib = (window as any).pdfjsLib;
            
            // Use PDF.js helper to render spans
            if (pdfjsLib) {
              await pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
              }).promise;
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error('PDF Render Error:', error);
        }
      }
    };

    renderPage();
  }, [pdfDocument, pageNumber, scale]);

  const changePage = (delta: number) => {
    if (!pdfDocument) return;
    const newPage = pageNumber + delta;
    if (newPage >= 1 && newPage <= pdfDocument.numPages) {
      onPageChange(newPage);
    }
  };

  if (!pdfDocument) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-slate-400 p-8 text-center border-r border-slate-800">
        <FileText className="w-16 h-16 mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-slate-200 mb-2">Visuals Paused</h3>
        <p className="max-w-xs text-sm">
          You restored a previous session. The chat and analysis are active, but for security reasons, you must re-upload the PDF to see the pages.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-800/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-slate-700 shrink-0 z-10">
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" onClick={() => changePage(-1)} disabled={pageNumber <= 1}>
             <ChevronLeft size={16} />
           </Button>
           <span className="text-sm font-mono text-slate-300">
             Page {pageNumber} / {pdfDocument?.numPages || '-'}
           </span>
           <Button variant="ghost" size="sm" onClick={() => changePage(1)} disabled={pageNumber >= (pdfDocument?.numPages || 1)}>
             <ChevronRight size={16} />
           </Button>
        </div>
        
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
             <ZoomOut size={16} />
           </Button>
           <span className="text-xs text-slate-400 w-12 text-center">{Math.round(scale * 100)}%</span>
           <Button variant="ghost" size="sm" onClick={() => setScale(s => Math.min(3.0, s + 0.2))}>
             <ZoomIn size={16} />
           </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center p-8 custom-scrollbar bg-slate-500/10 relative"
        onMouseUp={(e) => onTextSelect && onTextSelect(e.nativeEvent)}
      >
        <div className="relative shadow-2xl inline-block">
          <canvas ref={canvasRef} className="bg-white rounded-sm block" />
          <div ref={textLayerRef} className="textLayer" />
        </div>
      </div>
    </div>
  );
};