import { useState, useEffect } from 'react';

export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const [displayText, setDisplayText] = useState(text);

  useEffect(() => {
    let iteration = 0;
    let interval: any = null;
    let timeout: any = null;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!';

    const startAnimation = () => {
      iteration = 0;
      interval = setInterval(() => {
        setDisplayText(() =>
          text
            .split('')
            .map((char, index) => {
              if (char === ' ') return ' ';
              if (index < iteration) return text[index];
              return chars[Math.floor(Math.random() * chars.length)];
            })
            .join('')
        );
        if (iteration >= text.length) {
          clearInterval(interval);
          timeout = setTimeout(startAnimation, 4000);
        }
        iteration += 1 / 3;
      }, 30);
    };

    startAnimation();

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [text]);

  return <span className={className}>{displayText}</span>;
}
