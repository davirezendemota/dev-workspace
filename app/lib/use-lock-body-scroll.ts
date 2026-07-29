import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';

function lockBodyScroll() {
  if (typeof document === 'undefined') return;

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [locked]);
}
