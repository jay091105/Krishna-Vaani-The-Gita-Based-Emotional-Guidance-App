import React, { useEffect, useRef } from 'react';

function buildDotGrid(width, height, targetCount = 84) {
  if (width <= 0 || height <= 0) return [];

  const clampedTarget = Math.max(50, Math.min(100, targetCount));
  const spacing = Math.sqrt((width * height) / clampedTarget);
  const cols = Math.max(6, Math.floor(width / spacing));
  const rows = Math.max(6, Math.floor(height / spacing));
  const cellW = width / cols;
  const cellH = height / rows;
  const dots = [];

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const jitterX = (Math.random() - 0.5) * cellW * 0.28;
      const jitterY = (Math.random() - 0.5) * cellH * 0.28;
      dots.push({
        x: x * cellW + cellW * 0.5 + jitterX,
        y: y * cellH + cellH * 0.5 + jitterY,
        glow: 0,
        seed: Math.random(),
      });
    }
  }

  if (dots.length <= 100) return dots;

  const stride = Math.ceil(dots.length / 96);
  return dots.filter((_, idx) => idx % stride === 0).slice(0, 100);
}

function InteractiveBackground({ children, className = '' }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const host = containerRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    let width = 0;
    let height = 0;
    let dots = [];
    let animationId = null;
    let pointerFrame = null;

    const cursor = { x: -9999, y: -9999, active: false };
    const targetCursor = { x: -9999, y: -9999 };
    const radius = 165;

    const resize = () => {
      width = host.clientWidth;
      height = host.clientHeight;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = buildDotGrid(width, height);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      cursor.x += (targetCursor.x - cursor.x) * 0.2;
      cursor.y += (targetCursor.y - cursor.y) * 0.2;

      for (let i = 0; i < dots.length; i += 1) {
        const dot = dots[i];
        const dx = dot.x - cursor.x;
        const dy = dot.y - cursor.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const targetGlow = cursor.active ? Math.max(0, 1 - distance / radius) : 0;
        dot.glow += (targetGlow - dot.glow) * 0.095;

        const hueMix = (Math.sin(dot.seed * 10.8) + 1) * 0.5;
        const r = Math.round(34 + (99 - 34) * hueMix);
        const g = Math.round(211 + (102 - 211) * hueMix);
        const b = Math.round(238 + (241 - 238) * hueMix);

        const alpha = 0.06 + dot.glow * 0.52;
        const size = 1 + dot.glow * 2.15;

        ctx.beginPath();
        ctx.shadowBlur = 14 * dot.glow;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${0.55 * dot.glow})`;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.arc(dot.x, dot.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    const updateCursorStyle = () => {
      host.style.setProperty('--ib-x', `${targetCursor.x}px`);
      host.style.setProperty('--ib-y', `${targetCursor.y}px`);
      host.style.setProperty('--ib-opacity', cursor.active ? '1' : '0');
    };

    const handleMove = (event) => {
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        const rect = host.getBoundingClientRect();
        targetCursor.x = event.clientX - rect.left;
        targetCursor.y = event.clientY - rect.top;
        cursor.active = true;
        updateCursorStyle();
        pointerFrame = null;
      });
    };

    const handleLeave = () => {
      cursor.active = false;
      updateCursorStyle();
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);

    resize();
    draw();

    host.addEventListener('mousemove', handleMove, { passive: true });
    host.addEventListener('mouseleave', handleLeave, { passive: true });

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      resizeObserver.disconnect();
      host.removeEventListener('mousemove', handleMove);
      host.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <div ref={containerRef} className={`interactive-background ${className}`}>
      <canvas ref={canvasRef} className="interactive-background-canvas" />
      <div className="interactive-background-cursor" />
      <div className="interactive-background-blobs" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default InteractiveBackground;
