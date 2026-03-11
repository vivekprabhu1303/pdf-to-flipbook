import React, { useState, useCallback, useRef, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { Upload, FileText, ChevronLeft, ChevronRight, RotateCcw, Loader2, ZoomIn, ZoomOut, Maximize, Minimize } from 'lucide-react';
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
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const flipBookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      
      // If total pages is odd, add a blank page so the book "closes" properly in double mode
      if (numPages % 2 !== 0) {
        const lastPage = loadedPages[loadedPages.length - 1];
        loadedPages.push({
          url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', // 1x1 white pixel
          width: lastPage.width,
          height: lastPage.height
        });
      }

      setTotalPages(loadedPages.length);
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

  const nextPage = () => {
    flipBookRef.current?.pageFlip()?.flipNext();
  };

  const prevPage = () => {
    flipBookRef.current?.pageFlip()?.flipPrev();
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const zoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));

  return (
    <div ref={containerRef} className="min-h-screen bg-[#F5F5F0] text-[#141414] font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-3 flex items-center">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 w-1/4">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shrink-0">
            <FileText className="text-white w-5 h-5" />
          </div>
          <h1 className="font-serif italic text-xl tracking-tight hidden sm:block truncate">Flipbook.</h1>
        </div>
        
        {/* Center: Controls */}
        <div className="flex-1 flex justify-center items-center gap-2 sm:gap-4">
          {pages.length > 0 && (
            <>
              {/* Zoom Controls */}
              <div className="hidden md:flex items-center gap-1 bg-black/5 rounded-full px-2 py-1">
                <button 
                  onClick={zoomOut}
                  className="p-1.5 hover:bg-black/10 rounded-full transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-mono font-bold w-10 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button 
                  onClick={zoomIn}
                  className="p-1.5 hover:bg-black/10 rounded-full transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-black/5">
                <button 
                  onClick={prevPage}
                  disabled={currentPage === 0}
                  className="p-1.5 hover:bg-black/5 rounded-full disabled:opacity-20 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <form onSubmit={handlePageJump} className="flex items-center gap-1 font-mono text-xs border-x border-black/5 px-3">
                  <input
                    type="text"
                    value={pageInputValue}
                    onChange={(e) => setPageInputValue(e.target.value)}
                    onBlur={handlePageJump}
                    className="w-10 bg-black/5 border-none rounded px-1 py-0.5 text-center font-bold focus:ring-1 focus:ring-black outline-none"
                  />
                  <span className="text-black/20">/</span>
                  <span className="text-black/50">{totalPages}</span>
                </form>

                <button 
                  onClick={nextPage}
                  disabled={currentPage >= totalPages - 1}
                  className="p-1.5 hover:bg-black/5 rounded-full disabled:opacity-20 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Actions moved to center */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleFullscreen}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-black/5 rounded-full transition-colors text-xs font-medium"
                  title={isFullscreen ? "Exit Fullscreen Mode" : "Enter Fullscreen Mode"}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isFullscreen ? "Exit Full Screen Mode" : "Full Screen Mode"}</span>
                </button>
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/10 hover:bg-black hover:text-white transition-all duration-300 text-xs font-medium shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>New File</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Actions (Empty or minimal) */}
        <div className="w-1/4 flex justify-end items-center gap-2">
          {/* Right side is now mostly empty as controls moved to center */}
        </div>
      </header>

      <main className={`flex flex-col items-center w-full ${isFullscreen ? 'h-[calc(100vh-56px)] mt-[56px] overflow-hidden' : `min-h-screen pt-24 pb-12 px-6 ${pages.length === 0 ? 'justify-center' : 'justify-start'}`}`}>
        <AnimatePresence mode="wait">
          {pages.length === 0 ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl px-6"
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
              className={`w-full flex flex-col items-center ${isFullscreen ? 'h-full' : 'max-w-screen-2xl'}`}
            >
              <div 
                className={`w-full flex items-center justify-center ${isFullscreen ? 'flex-1 overflow-auto p-4 sm:p-8 custom-scrollbar' : 'py-8 sm:py-12'}`}
              >
                {/* Scaled Wrapper: This div takes up the actual space of the scaled content */}
                <div 
                  style={{ 
                    width: 1100 * zoom, // 550 * 2
                    height: 733 * zoom,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  <div 
                    className="transition-transform duration-300 ease-out shadow-2xl shadow-black/20"
                    style={{ 
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center center',
                      width: 1100,
                      height: 733,
                      position: 'absolute'
                    }}
                  >
                    {/* @ts-ignore */}
                    <HTMLFlipBook
                      width={550}
                      height={733}
                      size="fixed"
                      minWidth={275}
                      maxWidth={1100}
                      minHeight={400}
                      maxHeight={1533}
                      maxShadowOpacity={0.5}
                      showCover={true}
                      mobileScrollSupport={true}
                      onFlip={onFlip}
                      className=""
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
                </div>
              </div>

              {/* Controls Info */}
              {!isFullscreen && (
                <div className="flex flex-col items-center gap-2 pb-8">
                  <p className="text-[10px] text-black/40 uppercase tracking-widest font-medium">
                    Click or drag corners to flip pages
                  </p>
                </div>
              )}
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
