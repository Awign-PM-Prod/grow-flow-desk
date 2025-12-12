import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { Loader2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Set up the worker for pdfjs - use local worker file from public folder
// Files in public folder are served from root in Vite
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfPath: string;
  pages?: number[]; // Array of page numbers to display. If empty or [0], shows all pages
  startPage?: number; // Page number to start at (1-indexed)
}

export function PDFGuideDialog({ open, onOpenChange, pdfPath, pages = [], startPage }: PDFGuideDialogProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [numPages, setNumPages] = useState<number>(0);
  const [pagesToShow, setPagesToShow] = useState<number[]>(pages);
  const hasScrolledToStartPage = useRef(false);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError(null);
    // If pages prop is empty, show all pages
    if (pages.length === 0) {
      const allPages = Array.from({ length: numPages }, (_, i) => i + 1);
      setPagesToShow(allPages);
    } else {
      setPagesToShow(pages);
    }
    // Set loading to false after pagesToShow is set
    setLoading(false);
  }

  function onDocumentLoadError(error: Error) {
    console.error("Error loading PDF:", error);
    setError("Failed to load PDF. Please try again.");
    setLoading(false);
  }

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(null);
      setCurrentPageIndex(0);
      setApi(undefined); // Reset API when dialog opens
      hasScrolledToStartPage.current = false; // Reset the flag when dialog opens
      // Only set pagesToShow if pages prop is provided, otherwise wait for document load
      if (pages.length > 0) {
        setPagesToShow(pages);
      } else {
        setPagesToShow([]);
      }
    }
  }, [open]); // Removed pages from dependencies to avoid infinite loop

  // Update current page index when carousel changes
  useEffect(() => {
    if (!api) {
      return;
    }

    setCurrentPageIndex(api.selectedScrollSnap());

    const handleSelect = () => {
      setCurrentPageIndex(api.selectedScrollSnap());
    };

    api.on("select", handleSelect);

    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  // Scroll to start page when carousel is ready and pages are loaded (only once)
  useEffect(() => {
    if (!api || loading || pagesToShow.length === 0 || !startPage || !open || hasScrolledToStartPage.current) {
      return;
    }

    // Use setTimeout to ensure carousel is fully rendered and items are mounted
    const timeoutId = setTimeout(() => {
      try {
        // Find the index of the start page in pagesToShow array
        const startPageIndex = pagesToShow.findIndex((pageNum) => pageNum === startPage);
        if (startPageIndex !== -1) {
          api.scrollTo(startPageIndex, false); // false = instant scroll, no animation
          setCurrentPageIndex(startPageIndex);
          hasScrolledToStartPage.current = true; // Mark that we've scrolled to start page
        }
      } catch (error) {
        console.error("Error scrolling to start page:", error);
      }
    }, 300); // Increased timeout to ensure carousel items are rendered

    return () => clearTimeout(timeoutId);
  }, [api, loading, pagesToShow, startPage, open]); // Removed currentPageIndex to prevent re-triggering

  if (!open) return null;

  const content = (
    <div 
      className="fixed inset-0 bg-background flex items-center justify-center"
      style={{ zIndex: 99999 }}
      onClick={(e) => {
        // Close if clicking on the background (not on PDF or arrows)
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onOpenChange(false)}
        className="fixed top-4 right-4 h-12 w-12 text-white bg-black/70 border-2 border-white/30 hover:bg-black/90 hover:border-white/50 shadow-xl rounded-full"
        style={{ zIndex: 100000 }}
      >
        <X className="h-6 w-6" />
        <span className="sr-only">Close</span>
      </Button>

      {/* Left Arrow Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => api?.scrollPrev()}
        disabled={!api?.canScrollPrev()}
        className="fixed left-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white bg-black/70 border-2 border-white/30 hover:bg-black/90 hover:border-white/50 shadow-xl rounded-full"
        style={{ zIndex: 100000 }}
      >
        <ChevronLeft className="h-6 w-6" />
        <span className="sr-only">Previous page</span>
      </Button>

      {/* Right Arrow Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => api?.scrollNext()}
        disabled={!api?.canScrollNext()}
        className="fixed right-4 top-1/2 -translate-y-1/2 h-12 w-12 text-white bg-black/70 border-2 border-white/30 hover:bg-black/90 hover:border-white/50 shadow-xl rounded-full"
        style={{ zIndex: 100000 }}
      >
        <ChevronRight className="h-6 w-6" />
        <span className="sr-only">Next page</span>
      </Button>

      {/* PDF Content */}
      <div className="w-full h-full overflow-hidden flex items-center justify-center relative" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-destructive text-lg">{error}</p>
          </div>
        ) : (
          <Document
            file={pdfPath}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            {pagesToShow.length > 0 ? (
              <Carousel className="w-full h-full relative" setApi={setApi}>
                <CarouselContent className="-ml-0 h-full">
                  {pagesToShow.map((pageNum) => (
                    <CarouselItem key={pageNum} className="pl-0 h-full">
                      <div className="flex items-center justify-center w-full h-full">
                        <div className="border rounded bg-gray-50" style={{ maxWidth: '100%', maxHeight: '100%' }}>
                          <Page
                            pageNumber={pageNum}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            width={typeof window !== 'undefined' ? Math.min(1400, window.innerWidth - 100) : 1400}
                            className="max-w-full"
                          />
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

