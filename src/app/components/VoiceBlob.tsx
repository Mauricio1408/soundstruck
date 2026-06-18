import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { figma } from "./figma-theme";

// Siri-style liquid blob: colorful Figma-gradient bubbles that merge via a
// gooey SVG filter — and now play with your cursor.
export function VoiceBlob({ active = true }: { active?: boolean }) {
  const gooId = useId().replace(/:/g, "");
  const rootRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  // pointer offset relative to blob center, normalized to [-1, 1]
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  // absolute targets for the bubble that "reaches" toward the cursor
  const reachTX = useMotionValue(0);
  const reachTY = useMotionValue(0);

  const STAGE = 300;
  const center = STAGE / 2;
  const energy = active ? 1 : 0.35;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = (e.clientX - cx) / (r.width / 2);
      const dy = (e.clientY - cy) / (r.height / 2);
      px.set(Math.max(-1.5, Math.min(1.5, dx)));
      py.set(Math.max(-1.5, Math.min(1.5, dy)));
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
      const maxR = r.width * 1.1;
      const amp = Math.max(0, 1 - dist / maxR);
      setNear(dist < r.width * 0.8);
      reachTX.set(dx * 95 * amp);
      reachTY.set(dy * 95 * amp);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [px, py, reachTX, reachTY]);

  const spring = { stiffness: 140, damping: 15, mass: 0.6 };
  const leanX = useSpring(useTransform(px, (v) => v * 20), spring);
  const leanY = useSpring(useTransform(py, (v) => v * 20), spring);
  const reachX = useSpring(reachTX, { stiffness: 200, damping: 18 });
  const reachY = useSpring(reachTY, { stiffness: 200, damping: 18 });

  const poke = (e: React.PointerEvent) => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = Date.now();
    setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples((rs) => rs.filter((p) => p.id !== id)), 700);
  };

  const bubbles = [
    { color: figma.purple, size: 130, r: 42, dur: 6, phase: 0 },
    { color: figma.blue, size: 120, r: 50, dur: 7.5, phase: 1.1 },
    { color: figma.green, size: 95, r: 46, dur: 8.5, phase: 2.3 },
    { color: figma.orange, size: 85, r: 54, dur: 6.8, phase: 3.4 },
    { color: figma.red, size: 80, r: 40, dur: 9.2, phase: 4.5 },
    { color: figma.blue, size: 100, r: 30, dur: 7.0, phase: 5.6 },
  ];

  return (
    <motion.div
      ref={rootRef}
      className="relative cursor-pointer"
      style={{ width: STAGE, height: STAGE, x: leanX, y: leanY }}
      onPointerDown={poke}
      whileTap={{ scale: 0.94 }}
      animate={{ scale: near ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
    >
      {/* gooey filter definition */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter id={gooId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* soft outer halo */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{
          inset: -20,
          background: `radial-gradient(circle, ${figma.purple}66, ${figma.blue}33, transparent 70%)`,
        }}
        animate={active ? { scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] } : { scale: 1, opacity: 0.35 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* slow-rotating gradient ring backdrop */}
      <motion.div
        className="absolute rounded-full opacity-40 blur-md"
        style={{
          inset: 24,
          background: `conic-gradient(from 0deg, ${figma.red}, ${figma.orange}, ${figma.purple}, ${figma.blue}, ${figma.green}, ${figma.red})`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
      />

      {/* the liquid bubbles, merged by the goo filter */}
      <motion.div
        className="absolute inset-0"
        style={{ filter: `url(#${gooId})` }}
        animate={active ? { scale: [1, 1.04, 0.99, 1] } : { scale: 1 }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        {bubbles.map((b, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: b.size,
              height: b.size,
              left: center - b.size / 2,
              top: center - b.size / 2,
              background: `radial-gradient(circle at 35% 30%, #ffffffcc, ${b.color} 55%, ${b.color})`,
            }}
            animate={{
              x: [
                Math.cos(b.phase) * b.r * energy,
                Math.cos(b.phase + 2) * b.r * 1.2 * energy,
                Math.cos(b.phase + 4) * b.r * energy,
                Math.cos(b.phase) * b.r * energy,
              ],
              y: [
                Math.sin(b.phase) * b.r * energy,
                Math.sin(b.phase + 2) * b.r * 1.2 * energy,
                Math.sin(b.phase + 4) * b.r * energy,
                Math.sin(b.phase) * b.r * energy,
              ],
              scale: active ? [1, 1.15, 0.9, 1] : [1, 1.03, 1],
            }}
            transition={{ duration: b.dur, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}

        {/* liquid droplet that reaches toward the cursor */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: 86,
            height: 86,
            left: center - 43,
            top: center - 43,
            x: reachX,
            y: reachY,
            background: `radial-gradient(circle at 35% 30%, #ffffffdd, ${figma.blue} 55%, ${figma.purple})`,
          }}
        />
      </motion.div>

      {/* glassy highlight on top */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 70,
          height: 40,
          left: center - 55,
          top: center - 60,
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.55), transparent 70%)",
          filter: "blur(4px)",
        }}
        animate={{ opacity: active ? [0.4, 0.7, 0.4] : 0.3 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* click ripples */}
      <AnimatePresence>
        {ripples.map((rp) => (
          <motion.div
            key={rp.id}
            className="pointer-events-none absolute rounded-full"
            style={{ left: rp.x, top: rp.y, border: `2px solid ${figma.blue}` }}
            initial={{ width: 0, height: 0, x: 0, y: 0, opacity: 0.8 }}
            animate={{ width: 180, height: 180, x: -90, y: -90, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
