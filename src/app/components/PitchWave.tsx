import { useEffect, useRef } from "react";
import { figma } from "./figma-theme";
import { noteToFreq, type MelodyNote } from "./songs";

const F_MIN = 130; // ~C3
const F_MAX = 660; // ~E5

// Map a frequency to a vertical position (0 = top/high, 1 = bottom/low).
// Higher frequency → smaller value → higher on screen.
function freqToNorm(f: number) {
  const v = (Math.log2(f) - Math.log2(F_MIN)) / (Math.log2(F_MAX) - Math.log2(F_MIN));
  return Math.max(0, Math.min(1, 1 - v)); // invert so high pitch = top of canvas
}

// Color for a note block based on whether it's past, current, or upcoming
function noteColor(state: "past" | "current" | "upcoming", alpha: number) {
  if (state === "current") return `rgba(26,188,254,${alpha})`; // blue
  if (state === "past") return `rgba(255,255,255,${alpha * 0.15})`;
  return `rgba(162,89,255,${alpha})`; // purple
}

interface Props {
  playing: boolean;
  micOn: boolean;
  targetFreq: number;
  getPitch: () => number;
  // Song melody data for rendering note blocks
  melody?: MelodyNote[];
  bpm?: number;
  elapsed?: number;
  // Reports whether the singer is currently on the target note.
  onNoteChange?: (onNote: boolean) => void;
}

export function PitchWave({
  playing, micOn, targetFreq, getPitch, onNoteChange,
  melody, bpm = 120, elapsed = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const histRef = useRef<number[]>([]); // recent normalized pitch positions (-1 = none)
  const tRef = useRef(0);
  const onNoteRef = useRef(false);

  // keep latest props without restarting the loop
  const propsRef = useRef({ playing, micOn, targetFreq, getPitch, onNoteChange, melody, bpm, elapsed });
  propsRef.current = { playing, micOn, targetFreq, getPitch, onNoteChange, melody, bpm, elapsed };

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
      const { playing, micOn, targetFreq, getPitch, onNoteChange, melody, bpm, elapsed } = propsRef.current;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);
      tRef.current += 0.05;

      const secPerBeat = 60 / bpm;
      const WINDOW = 6; // seconds visible in the view (look-ahead)
      const PAD_TOP = 6;
      const PAD_BOT = 6;
      const drawH = h - PAD_TOP - PAD_BOT;

      // --- Draw melody note blocks (scrolling piano-roll style) ---
      if (melody && melody.length > 0) {
        let noteStart = 0;
        melody.forEach((n, i) => {
          const dur = n.beats * secPerBeat;
          const noteEnd = noteStart + dur;

          // Position notes: current time is at left edge, future scrolls from right
          // Show a window from (elapsed - 1) to (elapsed + WINDOW)
          const viewStart = elapsed - 1;
          const viewEnd = elapsed + WINDOW;

          if (noteEnd > viewStart && noteStart < viewEnd) {
            const freq = noteToFreq(n.note);
            const normY = freqToNorm(freq);
            const y = PAD_TOP + normY * drawH;

            // X position based on time offset from current elapsed
            const x1 = ((noteStart - viewStart) / (viewEnd - viewStart)) * w;
            const x2 = ((noteEnd - viewStart) / (viewEnd - viewStart)) * w;
            const blockW = Math.max(2, x2 - x1 - 2);

            // Determine state
            let state: "past" | "current" | "upcoming" = "upcoming";
            if (noteEnd <= elapsed) state = "past";
            else if (noteStart <= elapsed && noteEnd > elapsed) state = "current";

            // Draw note block with rounded corners
            const blockH = 14;
            const radius = Math.min(4, blockW / 2);
            ctx.fillStyle = noteColor(state, state === "current" ? 0.5 : 0.3);
            ctx.beginPath();
            ctx.roundRect(x1 + 1, y - blockH / 2, blockW, blockH, radius);
            ctx.fill();

            // Border for current note
            if (state === "current") {
              ctx.strokeStyle = figma.blue;
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.roundRect(x1 + 1, y - blockH / 2, blockW, blockH, radius);
              ctx.stroke();
            }

            // Note label on wider blocks
            if (blockW > 28) {
              ctx.fillStyle = state === "current" ? "#fff" : "rgba(255,255,255,0.4)";
              ctx.font = "500 9px Inter, sans-serif";
              ctx.textAlign = "left";
              ctx.textBaseline = "middle";
              const label = n.lyric?.trim() || n.note;
              ctx.fillText(label, x1 + 6, y + 1);
            }
          }
          noteStart = noteEnd;
        });

        // --- Draw the playhead (current time vertical line) ---
        if (playing) {
          const playheadX = (1 / (WINDOW + 1)) * w; // 1 second from left
          ctx.strokeStyle = "rgba(255,255,255,0.2)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(playheadX, 0);
          ctx.lineTo(playheadX, h);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // --- Draw target note band (dashed horizontal line) ---
      const targetNorm = targetFreq ? freqToNorm(targetFreq) : 0.5;
      const targetY = PAD_TOP + targetNorm * drawH;

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(0, targetY - 12, w, 24);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1;
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
      } else if (micOn) {
        // Show pitch even when not playing (warmup)
        const f = getPitch();
        sample = f > 0 ? freqToNorm(f) : -1;
      }
      histRef.current.push(sample);
      if (histRef.current.length > MAX) histRef.current.shift();

      // --- detect "on note" (only meaningful with a live mic during playback) ---
      let onNote = false;
      if (micOn && playing && sample >= 0 && targetFreq) {
        onNote = Math.abs(sample - targetNorm) < 0.06; // ~within semitone range
      }
      if (onNote !== onNoteRef.current) {
        onNoteRef.current = onNote;
        onNoteChange?.(onNote);
      }

      // --- draw scrolling pitch trace ---
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `${figma.blue}44`);
      grad.addColorStop(0.6, figma.purple);
      grad.addColorStop(1, onNote ? figma.green : figma.blue);
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = grad;
      ctx.beginPath();
      let started = false;
      histRef.current.forEach((s, i) => {
        const x = (i / (MAX - 1)) * w;
        if (s < 0) {
          started = false;
          return;
        }
        const y = PAD_TOP + s * drawH;
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      });
      ctx.shadowColor = onNote ? figma.green : figma.purple;
      ctx.shadowBlur = onNote ? 14 : 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // --- current pitch dot + direction cue ---
      if (sample >= 0) {
        const y = PAD_TOP + sample * drawH;

        // Glow ring when on note
        if (onNote) {
          ctx.beginPath();
          ctx.arc(w - 6, y, 12, 0, Math.PI * 2);
          ctx.fillStyle = `${figma.green}33`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(w - 6, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = onNote ? figma.green : "#fff";
        ctx.fill();

        if (!onNote && targetFreq && playing) {
          // sample < targetNorm means the dot is above the target → pitch is too high → sing lower (↓)
          // sample > targetNorm means the dot is below the target → pitch is too low → sing higher (↑)
          const tooHigh = sample < targetNorm;
          ctx.fillStyle = tooHigh ? figma.red : figma.blue;
          ctx.font = "bold 18px Inter, sans-serif";
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(tooHigh ? "↓" : "↑", w - 20, y);
        }
      }

      // --- Idle hint: note names on left edge ---
      if (!playing && !micOn) {
        const notes = ["C5", "A4", "G4", "E4", "C4", "A3"];
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.font = "500 9px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        notes.forEach((n) => {
          const freq = noteToFreq(n);
          if (freq > 0) {
            const y = PAD_TOP + freqToNorm(freq) * drawH;
            ctx.fillText(n, 4, y);
            // faint gridline
            ctx.strokeStyle = "rgba(255,255,255,0.04)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(26, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }
        });
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
