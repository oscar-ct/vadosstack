"use client";

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

type Point = { x: number; y: number };

function deformArc(points: Point[], amplitude: number, phase: number, angleStep: number, passes: number) {
  let deformedPoints = points;

  for (let pass = 0; pass < passes; pass += 1) {
    deformedPoints = deformedPoints.map((point, index) => {
      const nextPoint = deformedPoints[(index + 1) % deformedPoints.length];
      const deltaX = nextPoint.x - point.x;
      const deltaY = nextPoint.y - point.y;
      const length = Math.hypot(deltaX, deltaY) || 1;
      const displacement = amplitude * Math.sin(phase + angleStep * index);

      return {
        x: point.x + (deltaY / length) * displacement,
        y: point.y - (deltaX / length) * displacement,
      };
    });
  }

  return deformedPoints;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  center: Point,
  hue: number,
  baseSaturation: number,
  baseLightness: number,
  extension: number,
  elapsedSeconds: number,
) {
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const progress = index / (points.length - 1);
    const edgeFade = Math.sin(progress * Math.PI);
    const colorFlow =
      Math.sin(progress * TAU * 2.1 - elapsedSeconds * 0.72) * 0.55 +
      Math.sin(progress * TAU * 5.3 + elapsedSeconds * 0.38) * 0.25;
    const alpha = Math.max(0.025, edgeFade * (0.2 + colorFlow * 0.09));
    const saturation = baseSaturation === 0 ? 0 : Math.max(0, baseSaturation + colorFlow * 10);
    const lightness = baseLightness + colorFlow * 7;
    const endX = point.x + (point.x - center.x) * extension;
    const endY = point.y + (point.y - center.y) * extension;

    ctx.strokeStyle = `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }
}

function drawWave(ctx: CanvasRenderingContext2D, width: number, height: number, elapsedSeconds: number) {
  ctx.clearRect(0, 0, width, height);

  const compact = width < 520;
  const lineCount = compact ? 154 : 186;
  const scale = Math.min(width, height);
  const center = {
    x: width * (compact ? 0.3 : 0.34),
    y: height * (compact ? 0.58 : 0.55),
  };
  const radius = scale * (compact ? 0.31 : 0.29);
  const rotation = -Math.PI / 2 - 0.58;
  const basePoints = Array.from({ length: lineCount }, (_, index) => {
    const angle = (Math.PI / lineCount) * index + rotation;
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });
  const amplitude = (radius / 30) * 0.82 * Math.sin(Math.PI * 0.6 + elapsedSeconds * 0.94);
  const phase = Math.PI * 0.8 + TAU * Math.sin(elapsedSeconds * 0.52);
  const angleStep = (TAU / lineCount) * 4;
  const deformedPoints = deformArc(basePoints, amplitude, phase, angleStep, 6);

  ctx.lineCap = "square";
  ctx.lineWidth = compact ? 0.72 : 0.82;
  drawLayer(ctx, deformedPoints, center, 218, 92, 70, 1.62, elapsedSeconds);
  drawLayer(ctx, deformedPoints, center, 0, 0, 94, 1.22, elapsedSeconds + 0.7);
  drawLayer(ctx, deformedPoints, center, 0, 88, 61, 0.86, elapsedSeconds + 1.4);
}

export function OverviewWaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const activeCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let lastFrame = 0;
    let width = 0;
    let height = 0;

    function resize() {
      const bounds = activeCanvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      activeCanvas.width = Math.max(1, Math.round(width * pixelRatio));
      activeCanvas.height = Math.max(1, Math.round(height * pixelRatio));
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawWave(drawingContext, width, height, reducedMotionQuery.matches ? 2.4 : performance.now() / 1000);
    }

    function animate(timestamp: number) {
      if (timestamp - lastFrame >= 1000 / 30) {
        drawWave(drawingContext, width, height, timestamp / 1000);
        lastFrame = timestamp;
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    function updateMotionPreference() {
      window.cancelAnimationFrame(animationFrame);
      if (reducedMotionQuery.matches) {
        drawWave(drawingContext, width, height, 2.4);
        return;
      }
      animationFrame = window.requestAnimationFrame(animate);
    }

    function updateVisibility() {
      window.cancelAnimationFrame(animationFrame);
      if (document.hidden || reducedMotionQuery.matches) return;
      animationFrame = window.requestAnimationFrame(animate);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(activeCanvas);
    reducedMotionQuery.addEventListener("change", updateMotionPreference);
    document.addEventListener("visibilitychange", updateVisibility);
    resize();
    updateMotionPreference();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      reducedMotionQuery.removeEventListener("change", updateMotionPreference);
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <canvas ref={canvasRef} className="size-full" />
    </div>
  );
}
