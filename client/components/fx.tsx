'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { playClick, unlockAudio } from '../lib/sound';

export default function Fx() {
  const [hasMouse, setHasMouse] = useState(false);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    setHasMouse(fine);

    // iOS: разблокируем звук по первому касанию в любом месте
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock);

    // клик-звук (на таче — по touchend, чтобы не было задержки 300мс)
    const onTap = () => playClick();
    window.addEventListener('click', onTap);
    window.addEventListener('touchend', onTap, { passive: true });

    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('click', onTap);
      window.removeEventListener('touchend', onTap);
    };
  }, []);

  useGSAP(() => {
    if (!hasMouse) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const xDot = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power2.out' });
    const yDot = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power2.out' });
    const xRing = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power2.out' });
    const yRing = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power2.out' });

    const move = (e: MouseEvent) => {
      xDot(e.clientX);
      yDot(e.clientY);
      xRing(e.clientX);
      yRing(e.clientY);
    };
    const over = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('button, a, input, select, textarea')) {
        gsap.to(ring, { scale: 1.7, duration: 0.25 });
      } else {
        gsap.to(ring, { scale: 1, duration: 0.25 });
      }
    };
    window.addEventListener('mousemove', move);
    document.addEventListener('mouseover', over);
    return () => {
      window.removeEventListener('mousemove', move);
      document.removeEventListener('mouseover', over);
    };
  }, { dependencies: [hasMouse] });

  if (!hasMouse) return null;

  return (
    <>
      <div
        ref={dotRef}
        className="fixed top-0 left-0 z-[200] w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-[#d9ff43] pointer-events-none"
      />
      <div
        ref={ringRef}
        className="fixed top-0 left-0 z-[200] w-8 h-8 -ml-4 -mt-4 rounded-full border border-[#d9ff43]/50 pointer-events-none"
      />
    </>
  );
}