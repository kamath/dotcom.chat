'use client';

import { useEffect } from 'react';

export default function ViewportHeightInitializer() {
  useEffect(() => {
    // Set CSS custom property for real viewport height
    function setVH() {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    // Set initial value
    setVH();

    // Update on resize and orientationchange for mobile
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', () => {
      setTimeout(setVH, 100); // Small delay for iOS
    });

    // Cleanup
    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', () => {
        setTimeout(setVH, 100);
      });
    };
  }, []);

  return null;
}