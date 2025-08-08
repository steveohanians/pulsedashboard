/**
 * Typewriter text animation component
 * Animates text character-by-character with bold markdown support
 */
import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  /** Text to animate */
  text: string;
  /** Animation speed in milliseconds per character */
  speed?: number;
  /** Callback fired when animation completes */
  onComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Creates a typewriter effect for text with markdown bold support
 * Supports **bold** syntax and animated cursor
 */
export function TypewriterText({ text, speed = 15, onComplete, className }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Reset state when text changes
    setDisplayedText('');
    setIsComplete(false);
    
    if (!text || text.length === 0) {
      // Call onComplete immediately for empty text so buttons show up
      setIsComplete(true);
      if (onComplete) {
        onComplete();
      }
      return;
    }
    
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
        if (onComplete) {
          onComplete();
        }
      }
    }, speed);

    return () => {
      clearInterval(interval);
    };
  }, [text, speed, onComplete]);

  // Function to render text with bold formatting
  function renderTextWithBold(text: string) {
    if (!text) return text;
    
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <strong key={index} className="font-semibold text-slate-800">
            {boldText}
          </strong>
        );
      }
      return part;
    });
  }

  return (
    <span className={className}>
      {renderTextWithBold(displayedText)}
      {!isComplete && (
        <span className="animate-pulse border-r-2 border-slate-400 ml-1"></span>
      )}
    </span>
  );
}