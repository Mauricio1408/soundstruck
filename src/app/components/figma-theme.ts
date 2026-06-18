// Official Figma brand colors used across the app for accents & gradients
export const figma = {
  red: "#F24E1E",
  orange: "#FF7262",
  purple: "#A259FF",
  blue: "#1ABCFE",
  green: "#0ACF83",
};

export const voiceProfiles = [
  { id: "nova", name: "Nova", color: figma.blue },
  { id: "ember", name: "Ember", color: figma.orange },
  { id: "violet", name: "Violet", color: figma.purple },
  { id: "fern", name: "Fern", color: figma.green },
  { id: "ruby", name: "Ruby", color: figma.red },
];

export interface Lesson {
  id: number;
  name: string;
  focus: string; // short label of the skill
  song: string; // recommended song id from songs.ts
  description: string; // what the lesson is about
  tips: string[]; // actionable coaching tips
}

export const lessons: Lesson[] = [
  {
    id: 1,
    name: "Prototype Pitch",
    focus: "Pitch accuracy",
    song: "twinkle",
    description:
      "Train your ear to land exactly on each note. Match the dashed target line as closely as you can.",
    tips: [
      "Hum the note first, then open into the vowel.",
      "Watch the wave — nudge up or down toward the dashed line.",
      "Aim for the line to glow green and hold it there.",
    ],
  },
  {
    id: 2,
    name: "Auto-Layout Breathing",
    focus: "Breath control",
    song: "happy-birthday",
    description:
      "Build steady breath support so your tone stays even from the first note to the last.",
    tips: [
      "Breathe low into your belly, not your shoulders.",
      "Exhale slowly and evenly — imagine cooling soup.",
      "Take a quick breath at the end of each phrase, not mid-word.",
    ],
  },
  {
    id: 3,
    name: "Component Harmony",
    focus: "Tone & blending",
    song: "twinkle",
    description:
      "Find a warm, blended tone by matching pitch cleanly and keeping your vowels consistent.",
    tips: [
      "Keep the same vowel shape across the whole word.",
      "Relax your jaw — let the sound stay round and open.",
      "Sing slightly softer to hear yourself blend with the guide.",
    ],
  },
  {
    id: 4,
    name: "Vector Vocalise",
    focus: "Agility",
    song: "mary",
    description:
      "Move quickly and cleanly between notes without sliding or smudging the pitches.",
    tips: [
      "Sing on an 'ah' to keep notes light and nimble.",
      "Start slow, then match the tempo as it feels easy.",
      "Place each note distinctly — think dots, not a smear.",
    ],
  },
  {
    id: 5,
    name: "Frame Falsetto",
    focus: "Head voice",
    song: "twinkle",
    description:
      "Reach the higher notes comfortably using a light, airy head voice instead of straining.",
    tips: [
      "Let high notes feel light and forward, never pushed.",
      "Imagine the note spinning up and over, not lifting your chin.",
      "If it strains, back off the volume and stay relaxed.",
    ],
  },
  {
    id: 6,
    name: "Constraint Crescendo",
    focus: "Dynamics",
    song: "ode-to-joy",
    description:
      "Practice controlling volume — grow louder and softer smoothly while staying on pitch.",
    tips: [
      "Start a phrase soft and swell gently toward its peak.",
      "Keep breath support constant as you get louder.",
      "Don't let pitch rise just because volume does.",
    ],
  },
  {
    id: 7,
    name: "Variant Vibrato",
    focus: "Vibrato",
    song: "ode-to-joy",
    description:
      "Add a natural, gentle vibrato to sustained notes by keeping the larynx relaxed.",
    tips: [
      "First hold a perfectly straight, steady tone.",
      "Relax your throat and let a slow, even wave appear.",
      "Keep airflow constant — vibrato comes from ease, not force.",
    ],
  },
  {
    id: 8,
    name: "Boolean Belting",
    focus: "Power & support",
    song: "happy-birthday",
    description:
      "Sing with confident power on the bigger notes while staying healthy and supported.",
    tips: [
      "Engage your core — power comes from breath, not the throat.",
      "Keep an open, tall posture with shoulders down.",
      "Stop immediately if you feel any strain or scratch.",
    ],
  },
  {
    id: 9,
    name: "Plugin Portamento",
    focus: "Smooth glides",
    song: "ode-to-joy",
    description:
      "Connect notes with smooth, controlled glides for an expressive, legato line.",
    tips: [
      "Keep airflow continuous as you move between notes.",
      "Glide just before the next note, then settle on its center.",
      "Sing the phrase as one connected line, not separate notes.",
    ],
  },
];

export const songChoices = [
  "Gradient Glow",
  "Pixel Perfect Ballad",
  "Drop Shadow Serenade",
];
