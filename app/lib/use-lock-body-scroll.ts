import { useEffect } from 'react';

let lockCount = 0;

type HtmlStyleSnapshot = {
  overflow: string;
  paddingRight: string;
};

let previousHtmlStyles: HtmlStyleSnapshot | null = null;

function getScrollbarWidth() {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function lockBodyScroll() {
  if (typeof document === 'undefined') return;

  if (lockCount === 0) {
    const scrollbarWidth = getScrollbarWidth();

    previousHtmlStyles = {
      overflow: document.documentElement.style.overflow,
      paddingRight: document.documentElement.style.paddingRight,
    };

    document.documentElement.style.setProperty(
      '--scrollbar-compensation',
      `${scrollbarWidth}px`,
    );
    document.documentElement.classList.add('body-scroll-locked');
    document.documentElement.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      document.documentElement.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount !== 0 || !previousHtmlStyles) return;

  document.documentElement.style.overflow = previousHtmlStyles.overflow;
  document.documentElement.style.paddingRight = previousHtmlStyles.paddingRight;
  document.documentElement.classList.remove('body-scroll-locked');
  document.documentElement.style.removeProperty('--scrollbar-compensation');

  previousHtmlStyles = null;
}

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [locked]);
}
