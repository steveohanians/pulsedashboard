import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export default function TypewriterText({ text, speed = 15, onComplete, className }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    console.debug('🎭 TypewriterText useEffect triggered for text:', text.slice(0, 30) + '...');
    // Reset state when text changes
    setDisplayedText('');
    setIsComplete(false);
    
    if (!text || text.length === 0) {
      console.debug('🎭 TypewriterText: Empty text, skipping animation');
      return;
    }
    
    let currentIndex = 0;
    console.debug('🎭 TypewriterText: Starting animation with speed:', speed);
    
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        console.debug('🎭 TypewriterText: Animation complete');
        setIsComplete(true);
        clearInterval(interval);
        if (onComplete) {
          onComplete();
        }
      }
    }, speed);

    return () => {
      console.debug('🎭 TypewriterText: Cleaning up interval');
      clearInterval(interval);
    };
  }, [text, speed]); // Removed onComplete from dependencies to prevent restart

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