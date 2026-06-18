import { figma } from "./figma-theme";

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  color: string;
  // SpeechSynthesis voice tuning
  voice: { pitch: number; rate: number; match: string[] };
  Illustration: (props: { size?: number }) => JSX.Element;
}

// Notion-doodle style: thick rounded outlines, flat pastel fills, simple friendly faces.
const stroke = "#2b2b3a";

function Face({ cx, cy, mood = "happy" }: { cx: number; cy: number; mood?: "happy" | "wink" | "sing" }) {
  return (
    <g stroke={stroke} strokeWidth={2.2} strokeLinecap="round" fill={stroke}>
      <circle cx={cx - 8} cy={cy} r={2.4} stroke="none" />
      {mood === "wink" ? (
        <path d={`M ${cx + 4} ${cy} q 4 0 8 0`} fill="none" />
      ) : (
        <circle cx={cx + 8} cy={cy} r={2.4} stroke="none" />
      )}
      {mood === "sing" ? (
        <ellipse cx={cx} cy={cy + 11} rx={4} ry={5} fill={stroke} stroke="none" />
      ) : (
        <path d={`M ${cx - 6} ${cy + 9} q 6 6 12 0`} fill="none" />
      )}
    </g>
  );
}

export const personas: Persona[] = [
  {
    id: "nova",
    name: "Nova",
    tagline: "Bright & encouraging",
    color: figma.blue,
    // Bright, higher female voice.
    voice: { pitch: 1.5, rate: 1.08, match: ["samantha", "zira", "google us english", "female"] },
    Illustration: ({ size = 96 }) => (
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <path d="M50 8 L60 38 L92 40 L66 60 L74 92 L50 73 L26 92 L34 60 L8 40 L40 38 Z"
          fill={figma.blue} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
        <Face cx={50} cy={48} mood="happy" />
      </svg>
    ),
  },
  {
    id: "ember",
    name: "Ember",
    tagline: "Warm & playful",
    color: figma.orange,
    // Deep male voice.
    voice: { pitch: 0.7, rate: 1.0, match: ["daniel", "fred", "alex", "google uk english male", "male"] },
    Illustration: ({ size = 96 }) => (
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <path d="M50 6 C66 28 78 38 70 64 C66 84 58 92 50 92 C42 92 30 86 28 66 C26 50 40 46 38 30 C44 40 52 36 50 6 Z"
          fill={figma.orange} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
        <Face cx={50} cy={58} mood="sing" />
      </svg>
    ),
  },
  {
    id: "fern",
    name: "Fern",
    tagline: "Calm & breathy",
    color: figma.green,
    // Lower, slower female voice — clearly distinct from Nova.
    voice: { pitch: 1.05, rate: 0.82, match: ["moira", "tessa", "fiona", "female", "google uk english female"] },
    Illustration: ({ size = 96 }) => (
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <path d="M50 92 C50 60 40 30 70 10 C78 44 70 70 50 92 Z"
          fill={figma.green} stroke={stroke} strokeWidth={3} strokeLinejoin="round" />
        <path d="M50 60 C50 46 56 36 68 26" fill="none" stroke={stroke} strokeWidth={2} />
        <Face cx={56} cy={44} mood="happy" />
      </svg>
    ),
  },
];

// Speak text in the active persona's voice.
let cachedVoices: SpeechSynthesisVoice[] = [];
export function loadVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

export function speakAs(persona: Persona, text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (!cachedVoices.length) cachedVoices = window.speechSynthesis.getVoices();
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.pitch = persona.voice.pitch;
  u.rate = persona.voice.rate;
  const found = cachedVoices.find((v) =>
    persona.voice.match.some((m) => v.name.toLowerCase().includes(m))
  );
  if (found) u.voice = found;
  window.speechSynthesis.speak(u);
}
