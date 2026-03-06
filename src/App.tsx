import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { Upload, FileText, ChevronLeft, ChevronRight, RotateCcw, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface PageData {
  url: string;
  width: number;
  height: number;
}

const Page = React.forwardRef<HTMLDivElement, { url: string; number: number }>((props, ref) => {
  return (
    <div className="bg-white shadow-lg overflow-hidden" ref={ref}>
      <div className="relative w-full h-full flex items-center justify-center">
        <img 
          src={props.url} 
          alt={`Page ${props.number}`} 
          className="max-w-full max-h-full object-contain pointer-events-none"
          referrerPolicy="no-referrer"
        />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs font-mono">
          {props.number}
        </div>
      </div>
    </div>
  );
});

Page.displayName = 'Page';

export default function App() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageInputValue, setPageInputValue] = useState('1');
  const flipBookRef = useRef<any>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/pdf') {
      const mockEvent = { target: { files: [file] } } as any;
      onFileChange(mockEvent);
    }
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const loadedPages: PageData[] = [];

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // Balanced quality/performance
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
          
          loadedPages.push({
            url: canvas.toDataURL('image/webp', 0.8),
            width: viewport.width,
            height: viewport.height
          });
        }
      }

      setPages(loadedPages);
      setTotalPages(numPages);
      setCurrentPage(0);
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Failed to process PDF. Please try another file.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPages([]);
    setTotalPages(0);
    setCurrentPage(0);
  };

  const onFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
    setPageInputValue((e.data + 1).toString());
  }, []);

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(pageInputValue);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      flipBookRef.current?.pageFlip()?.turnToPage(pageNum - 1);
    } else {
      setPageInputValue((currentPage + 1).toString());
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-black/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <FileText className="text-white w-5 h-5" />
          </div>
          <h1 className="font-serif italic text-xl tracking-tight">Flipbook.</h1>
        </div>
        
        {pages.length > 0 && (
          <button 
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-black/10 hover:bg-black hover:text-white transition-all duration-300 text-sm font-medium"
          >
            <RotateCcw className="w-4 h-4" />
            New File
          </button>
        )}
      </header>

      <main className="pt-24 pb-12 px-6 flex flex-col items-center justify-center min-h-screen">
        <AnimatePresence mode="wait">
          {pages.length === 0 ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className={`bg-white rounded-3xl p-12 shadow-xl shadow-black/5 border-2 transition-all duration-300 text-center ${isDragging ? 'border-black border-dashed bg-black/5 scale-[1.02]' : 'border-black/5'}`}>
                <div className="w-20 h-20 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-8">
                  {loading ? (
                    <Loader2 className="w-10 h-10 text-black animate-spin" />
                  ) : (
                    <Upload className={`w-10 h-10 text-black transition-transform duration-300 ${isDragging ? 'scale-125' : ''}`} />
                  )}
                </div>
                
                <h2 className="text-3xl font-serif italic mb-4">
                  {loading ? 'Processing your PDF...' : isDragging ? 'Drop it here!' : 'Turn your PDF into a Flipbook'}
                </h2>
                <p className="text-black/50 mb-8 max-w-sm mx-auto">
                  {loading 
                    ? 'We are converting your pages into high-quality images for a smooth flipping experience.' 
                    : 'Drag and drop your PDF file here, or click the button below to select one.'}
                </p>

                {!loading && (
                  <label className="inline-flex items-center gap-3 bg-black text-white px-8 py-4 rounded-2xl font-medium cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-black/20">
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      onChange={onFileChange} 
                      className="hidden" 
                    />
                    Select PDF File
                  </label>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="flipbook"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-5xl flex flex-col items-center gap-8"
            >
              <div className="relative group w-full flex justify-center">
                {/* @ts-ignore */}
                <HTMLFlipBook
                  width={550}
                  height={733}
                  size="stretch"
                  minWidth={275}
                  maxWidth={1100}
                  minHeight={400}
                  maxHeight={1533}
                  maxShadowOpacity={0.5}
                  showCover={true}
                  mobileScrollSupport={true}
                  onFlip={onFlip}
                  className="shadow-2xl shadow-black/20"
                  ref={flipBookRef}
                  useMouseEvents={true}
                  clickEventForward={true}
                  display="double"
                  flippingTime={1000}
                  drawShadow={true}
                >
                  {pages.map((page, index) => (
                    <Page key={index} url={page.url} number={index + 1} />
                  ))}
                </HTMLFlipBook>
              </div>

              {/* Controls & Info */}
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-6 bg-white px-6 py-3 rounded-full shadow-md border border-black/5">
                  <form onSubmit={handlePageJump} className="flex items-center gap-2 font-mono text-sm">
                    <input
                      type="text"
                      value={pageInputValue}
                      onChange={(e) => setPageInputValue(e.target.value)}
                      onBlur={handlePageJump}
                      className="w-12 bg-black/5 border-none rounded px-2 py-1 text-center font-bold focus:ring-1 focus:ring-black outline-none"
                    />
                    <span className="text-black/20">/</span>
                    <span className="text-black/50">{totalPages}</span>
                  </form>
                </div>
                
                <p className="text-xs text-black/40 uppercase tracking-widest font-medium">
                  Click or drag corners to flip pages
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 flex justify-center pointer-events-none">
        <div className="bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-black/5 text-[10px] uppercase tracking-tighter text-black/30 font-medium">
          Client-side conversion • No data stored • PDF to Flipbook
        </div>
      </footer>
    </div>
  );
}
