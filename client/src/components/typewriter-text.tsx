import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export default function TypewriterText({ text, speed = 30, onComplete, className }: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
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

    return () => clearInterval(interval);
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