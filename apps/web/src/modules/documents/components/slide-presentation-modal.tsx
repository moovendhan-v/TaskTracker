import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  Minimize2Icon,
  PresentationIcon,
  XIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { MarkdownPreview } from './markdown-preview';

interface SlidePresentationModalProps {
  open: boolean;
  onClose: () => void;
  documentTitle: string;
  content: string;
}

interface Slide {
  id: number;
  content: string;
  title: string;
}

const DEFAULT_SLIDE: Slide = {
  id: 0,
  content: '# Presentation\n\nNo slides found.',
  title: 'Presentation',
};

export function SlidePresentationModal({ open, onClose, documentTitle, content }: SlidePresentationModalProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Parse slides separated by '---' or headings
  const slides: Slide[] = useMemo(() => {
    const rawChunks = content
      .split(/(?:^|\n)---\s*(?:\n|$)/)
      .map((chunk) => chunk.trim())
      .filter((chunk): chunk is string => Boolean(chunk));

    if (rawChunks.length === 0) {
      return [{ id: 0, content: `# ${documentTitle || 'Untitled'}\n\nNo presentation slides yet.`, title: documentTitle || 'Title' }];
    }

    return rawChunks.map((chunk, idx) => {
      // Find the first heading to use as slide title
      const titleMatch = chunk.match(/^#{1,3}\s+(.+)$/m);
      const title = (titleMatch && titleMatch[1]) ? titleMatch[1] : `Slide ${idx + 1}`;
      return {
        id: idx,
        content: chunk,
        title,
      };
    });
  }, [content, documentTitle]);

  const currentSlide: Slide = slides[currentSlideIndex] ?? slides[0] ?? DEFAULT_SLIDE;

  const nextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, nextSlide, prevSlide, onClose]);

  if (!open) return null;

  const openMd2Slides = () => {
    navigator.clipboard.writeText(content).then(
      () => {
        toast.success('Slide content copied! Opening md2slides studio…');
        window.open('https://md2slides.cybertechmind.com/app', '_blank', 'noopener,noreferrer');
      },
      () => toast.error("Couldn't copy the slides. Check the browser's clipboard permission."),
    );
  };

  const progressPercent = ((currentSlideIndex + 1) / Math.max(1, slides.length)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 antialiased select-none">
      {/* Top Presentation Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <PresentationIcon className="size-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">{documentTitle || 'Untitled Presentation'}</h1>
            <p className="text-xs text-slate-400">
              Slide {currentSlideIndex + 1} of {slides.length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={openMd2Slides}
            className="h-8 gap-1.5 border-slate-700 bg-slate-800/80 text-xs text-slate-200 hover:bg-slate-700"
            title="Open in md2slides.cybertechmind.com"
          >
            <span>md2slides Studio</span>
            <ExternalLinkIcon className="size-3 text-slate-400" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleFullscreen}
            className="size-8 text-slate-300 hover:bg-slate-800 hover:text-white"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2Icon className="size-4" /> : <Maximize2Icon className="size-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="size-8 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Close presentation (Esc)"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </header>

      {/* Main Slide Stage */}
      <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6 sm:p-12">
        <div className="relative flex aspect-[16/9] w-full max-w-5xl flex-col justify-center rounded-2xl border border-slate-800/90 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950 p-8 shadow-2xl backdrop-blur sm:p-14">
          <div className="h-full w-full overflow-y-auto pr-2">
            <MarkdownPreview
              content={currentSlide.content}
              className="prose-invert prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 max-w-none text-base sm:text-lg"
            />
          </div>
        </div>

        {/* Slide floating arrows */}
        <button
          type="button"
          onClick={prevSlide}
          disabled={currentSlideIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-800 bg-slate-900/80 p-3 text-slate-300 shadow-lg backdrop-blur transition hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-20 sm:left-8"
          title="Previous slide (Left Arrow)"
          aria-label="Previous slide"
        >
          <ChevronLeftIcon className="size-6" />
        </button>

        <button
          type="button"
          onClick={nextSlide}
          disabled={currentSlideIndex === slides.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-slate-800 bg-slate-900/80 p-3 text-slate-300 shadow-lg backdrop-blur transition hover:bg-slate-800 hover:text-white disabled:pointer-events-none disabled:opacity-20 sm:right-8"
          title="Next slide (Right Arrow or Space)"
          aria-label="Next slide"
        >
          <ChevronRightIcon className="size-6" />
        </button>
      </main>

      {/* Bottom Progress Bar & Navigation Footer */}
      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-slate-800/80 bg-slate-900/60 px-6 backdrop-blur">
        <div className="flex items-center gap-1">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentSlideIndex ? 'w-6 bg-primary' : 'w-2 bg-slate-700 hover:bg-slate-600'
              }`}
              title={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Use ← / → or Space to navigate</span>
          <span>·</span>
          <span>Slide {currentSlideIndex + 1} / {slides.length}</span>
        </div>
      </footer>

      {/* Thin animated progress indicator */}
      <div className="h-0.5 w-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
