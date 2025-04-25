import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";

interface CarouselProps {
  slides: ReactNode[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showDots?: boolean;
  showArrows?: boolean;
  className?: string;
  slideHeight?: string;
  initialPadding?: string;
}

const Carousel = ({
  slides,
  autoPlay = true,
  autoPlayInterval = 5000,
  showDots = true,
  showArrows = true,
  className = "",
  slideHeight = "auto",
  initialPadding = "200px",
}: CarouselProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const [carouselHeight, setCarouselHeight] = useState<string>(initialPadding);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [slidesHeights, setSlidesHeights] = useState<{ [key: number]: number }>({});
  const [initialized, setInitialized] = useState(false);

  const totalSlides = slides.length;

  // Calculate and store all slide heights after initial mount
  useEffect(() => {
    const calculateAllHeights = () => {
      const heights: { [key: number]: number } = {};

      slideRefs.current.forEach((slideRef, index) => {
        if (slideRef) {
          // Add a small buffer to prevent scrollbars
          heights[index] = slideRef.scrollHeight + 4;
        }
      });

      setSlidesHeights(heights);

      // Set carousel to height of current slide
      if (heights[currentSlide]) {
        setCarouselHeight(`${heights[currentSlide]}px`);
      }

      setInitialized(true);
    };

    // Initial calculation
    calculateAllHeights();

    // Also calculate after a short delay to handle any async rendering
    const timer = setTimeout(() => {
      calculateAllHeights();
    }, 300);

    // Recalculate on window resize
    window.addEventListener("resize", calculateAllHeights);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculateAllHeights);
    };
  }, []);

  // Update height when switching slides
  useEffect(() => {
    if (initialized && slidesHeights[currentSlide]) {
      setCarouselHeight(`${slidesHeights[currentSlide]}px`);
    }
  }, [currentSlide, initialized, slidesHeights]);

  const handleTransitionEnd = () => {
    setIsTransitioning(false);
  };

  const goToNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % totalSlides);

    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
    }
  };

  const goToPrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);

    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
    }
  };

  const goToSlide = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isTransitioning || index === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(index);

    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
    }
  };

  return (
    <div
      className={`transition-height relative w-full overflow-hidden duration-300 ease-out ${className}`}
      style={{ height: carouselHeight }}>
      {/* Slides */}
      {slides.map((slide, index) => (
        <div
          key={`slide-${index}`}
          ref={(el) => (slideRefs.current[index] = el)}
          className="absolute left-0 top-0 w-full transition-opacity duration-300 ease-out"
          style={{
            opacity: index === currentSlide ? 1 : 0,
            zIndex: index === currentSlide ? 1 : 0,
            pointerEvents: index === currentSlide ? "auto" : "none",
            // Initially set all slides to visible but off-screen to get proper height
            position: initialized ? "absolute" : "relative",
            transform: initialized && index !== currentSlide ? "translateX(-9999px)" : "none",
            visibility: initialized ? (index === currentSlide ? "visible" : "hidden") : "visible",
          }}
          onTransitionEnd={index === currentSlide ? handleTransitionEnd : undefined}>
          {slide}
        </div>
      ))}

      {showArrows && totalSlides > 1 && (
        <>
          <button
            onClick={goToPrev}
            type="button"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-gray-900 bg-opacity-60 p-2 text-white transition-all hover:bg-opacity-80 focus:outline-none"
            aria-label="Previous slide">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            type="button"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-gray-900 bg-opacity-60 p-2 text-white transition-all hover:bg-opacity-80 focus:outline-none"
            aria-label="Next slide">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Dots/Indicators */}
      {showDots && totalSlides > 1 && (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 transform space-x-2">
          {slides.map((_, index) => (
            <button
              key={`dot-${index}`}
              onClick={(e) => goToSlide(index, e)}
              type="button"
              className={`h-3 w-3 rounded-full transition-all focus:outline-none ${
                index === currentSlide ? "bg-white" : "bg-gray-500 bg-opacity-50 hover:bg-opacity-70"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Carousel;
