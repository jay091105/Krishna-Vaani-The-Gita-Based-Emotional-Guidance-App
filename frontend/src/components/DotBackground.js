import React, { useEffect, useRef } from 'react';

function createDots(width, height, spacing = 40) {
  const dots = [];
  const step = Math.max(30, Math.min(50, spacing));

  for (let y = step * 0.5; y < height; y += step) {
    for (let x = step * 0.5; x < width; x += step) {
      dots.push({
        x,
        y,
        intensity: 0,
        hueMix: Math.random(),
      });
    }
  }

  return dots;
}

function DotBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let dots = [];
    let animationId = null;
    let pointerUpdateId = null;

    const radius = 210;
    const mouse = { x: -9999, y: -9999, active: false };
    const target = { x: -9999, y: -9999 };

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = createDots(width, height, 40);
    };

    const onMouseMove = (event) => {
      if (pointerUpdateId) return;
      pointerUpdateId = requestAnimationFrame(() => {
        target.x = event.clientX;
        target.y = event.clientY;
        mouse.active = true;
        pointerUpdateId = null;
      });
    };

    const onMouseLeave = () => {
      mouse.active = false;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      mouse.x += (target.x - mouse.x) * 0.2;
      mouse.y += (target.y - mouse.y) * 0.2;

      for (let i = 0; i < dots.length; i += 1) {
        const dot = dots[i];
        const dx = dot.x - mouse.x;
        const dy = dot.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const nextIntensity = mouse.active ? Math.max(0, 1 - dist / radius) : 0;
        dot.intensity += (nextIntensity - dot.intensity) * 0.1;

        const cyan = { r: 34, g: 211, b: 238 };
        const indigo = { r: 99, g: 102, b: 241 };
        const mix = dot.hueMix;

        const r = Math.round(cyan.r * (1 - mix) + indigo.r * mix);
        const g = Math.round(cyan.g * (1 - mix) + indigo.g * mix);
        const b = Math.round(cyan.b * (1 - mix) + indigo.b * mix);

        const baseAlpha = 0.12;
        const alpha = Math.min(0.92, baseAlpha + dot.intensity * 0.72);
        const size = 1 + dot.intensity * 2.2;

        ctx.beginPath();
        ctx.shadowBlur = 26 * dot.intensity;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.9 * dot.intensity})`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
        ctx.fill();

        if (dot.intensity > 0.08) {
          ctx.beginPath();
          ctx.shadowBlur = 0;
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.12 * dot.intensity})`;
          ctx.arc(dot.x, dot.y, size * 2.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseout', onMouseLeave, { passive: true });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (pointerUpdateId) cancelAnimationFrame(pointerUpdateId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseout', onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  );
}

export default DotBackground;
