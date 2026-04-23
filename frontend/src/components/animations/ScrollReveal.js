import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * ScrollReveal — wraps children and animates them into view on scroll.
 * Props:
 *   delay   — stagger delay in seconds (default 0)
 *   y       — slide distance in px (default 30)
 *   once    — only animate once (default true)
 */
function ScrollReveal({ children, delay = 0, y = 30, once = true, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: once ? 'play none none none' : 'play none none reverse',
        },
      }
    );

    return () => ScrollTrigger.getAll().forEach(t => t.kill());
  }, [delay, y, once]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}

export default ScrollReveal;
