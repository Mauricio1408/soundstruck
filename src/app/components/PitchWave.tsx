import { useEffect, useRef } from "react";
import { figma } from "./figma-theme";

const F_MIN = 130; // ~C3
const F_MAX = 660; // ~E5

// Map a frequency to a vertical position (0 = top/high, 1 = bottom/low).
function freqToNorm(f: number) {
  const v = (Math.log2(f) - Math.log2(F_MIN)) / (Math.log2(F_MAX) - Math.log2(F_MIN));
  return Math.max(0, Math.min(1, v));
}

interface Props {
  playing: boolean;
  micOn: boolean;
  targetFreq: number;
  getPitch: () => number;
  // Reports whether the singer is currently on the target note.
  onNoteChange?: (onNote: boolean) => void;
}

export function PitchWave({ playing, micOn, targetFreq, getPitch, onNoteChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const histRef = useRef<number[]>([]); // recent normalized pitch positions (-1 = none)
  const tRef = useRef(0);
  const onNoteRef = useRef(false);

  // keep latest props without restarting the loop
  const propsRef = useRef({ playing, micOn, targetFreq, getPitch, onNoteChange });
  propsRef.current = { playing, micOn, targetFreq, getPitch, onNoteChange };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const MAX = 160;

    const render = () => {
      const { playing, micOn, targetFreq, getPitch, onNoteChange } = propsRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      tRef.current += 0.05;

      const targetNorm = targetFreq ? freqToNorm(targetFreq) : 0.5;
      const targetY = targetNorm * h;

      // --- target note band (the line you should hit) ---
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, targetY - 10, w, 20);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, targetY);
      ctx.lineTo(w, targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // --- sample current pitch ---
      let sample = -1;
      if (playing) {
        if (micOn) {
          const f = getPitch();
          sample = f > 0 ? freqToNorm(f) : -1;
        } else {
          // no mic: gentle simulated trace hovering near the target
          sample = targetNorm + Math.sin(tRef.current * 3) * 0.04;
        }
      }
      histRef.current.push(sample);
      if (histRef.current.length > MAX) histRef.current.shift();

      // --- detect "on note" (only meaningful with a live mic) ---
      let onNote = false;
      if (micOn && sample >= 0 && targetFreq) {
        onNote = Math.abs(sample - targetNorm) < 0.045; // ~within range
      }
      if (onNote !== onNoteRef.current) {
        onNoteRef.current = onNote;
        onNoteChange?.(onNote);
      }

      // --- draw scrolling pitch trace ---
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, figma.blue);
      grad.addColorStop(0.5, figma.purple);
      grad.addColorStop(1, figma.green);
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeStyle = grad;
      ctx.beginPath();
      let started = false;
      histRef.current.forEach((s, i) => {
        const x = (i / (MAX - 1)) * w;
        if (s < 0) {
          started = false;
          return;
        }
        const y = s * h;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      });
      ctx.shadowColor = figma.purple;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- current pitch dot + direction cue ---
      if (sample >= 0) {
        const y = sample * h;
        ctx.beginPath();
        ctx.arc(w - 6, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = onNote ? figma.green : "#fff";
        ctx.fill();

        if (!onNote && targetFreq) {
          const higher = sample > targetNorm; // lower on screen = lower pitch → sing higher
          ctx.fillStyle = higher ? figma.blue : figma.red;
          ctx.font = "bold 22px Inter, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(higher ? "↑" : "↓", w - 22, y + 8);
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
