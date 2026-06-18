// Note → frequency helpers and real song melodies.
// MIDI number for a note name like "C4", then standard equal-temperament Hz.
const NOTE_INDEX: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

export function noteToFreq(note: string): number {
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return 0;
  const midi = NOTE_INDEX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface MelodyNote {
  note: string; // e.g. "C4"
  beats: number; // duration in beats
  lyric?: string;
}

export interface Song {
  id: string;
  title: string;
  bpm: number;
  melody: MelodyNote[];
}

// A few familiar, public-domain melodies.
export const songs: Song[] = [
  {
    id: "happy-birthday",
    title: "Happy Birthday",
    bpm: 110,
    melody: [
      { note: "C4", beats: 0.75, lyric: "Hap" },
      { note: "C4", beats: 0.25, lyric: "py" },
      { note: "D4", beats: 1, lyric: "birth" },
      { note: "C4", beats: 1, lyric: "day" },
      { note: "F4", beats: 1, lyric: "to" },
      { note: "E4", beats: 2, lyric: "you" },
      { note: "C4", beats: 0.75, lyric: "Hap" },
      { note: "C4", beats: 0.25, lyric: "py" },
      { note: "D4", beats: 1, lyric: "birth" },
      { note: "C4", beats: 1, lyric: "day" },
      { note: "G4", beats: 1, lyric: "to" },
      { note: "F4", beats: 2, lyric: "you" },
      { note: "C4", beats: 0.75, lyric: "Hap" },
      { note: "C4", beats: 0.25, lyric: "py" },
      { note: "C5", beats: 1, lyric: "birth" },
      { note: "A4", beats: 1, lyric: "day" },
      { note: "F4", beats: 1, lyric: "dear" },
      { note: "E4", beats: 1, lyric: "one" },
      { note: "D4", beats: 2, lyric: "" },
      { note: "A#4", beats: 0.75, lyric: "Hap" },
      { note: "A#4", beats: 0.25, lyric: "py" },
      { note: "A4", beats: 1, lyric: "birth" },
      { note: "F4", beats: 1, lyric: "day" },
      { note: "G4", beats: 1, lyric: "to" },
      { note: "F4", beats: 2, lyric: "you" },
    ],
  },
  {
    id: "twinkle",
    title: "Twinkle Twinkle Little Star",
    bpm: 100,
    melody: [
      { note: "C4", beats: 1, lyric: "Twin" },
      { note: "C4", beats: 1, lyric: "kle" },
      { note: "G4", beats: 1, lyric: "twin" },
      { note: "G4", beats: 1, lyric: "kle" },
      { note: "A4", beats: 1, lyric: "lit" },
      { note: "A4", beats: 1, lyric: "tle" },
      { note: "G4", beats: 2, lyric: "star" },
      { note: "F4", beats: 1, lyric: "How" },
      { note: "F4", beats: 1, lyric: "I" },
      { note: "E4", beats: 1, lyric: "won" },
      { note: "E4", beats: 1, lyric: "der" },
      { note: "D4", beats: 1, lyric: "what" },
      { note: "D4", beats: 1, lyric: "you" },
      { note: "C4", beats: 2, lyric: "are" },
    ],
  },
  {
    id: "mary",
    title: "Mary Had a Little Lamb",
    bpm: 110,
    melody: [
      { note: "E4", beats: 1, lyric: "Ma" },
      { note: "D4", beats: 1, lyric: "ry" },
      { note: "C4", beats: 1, lyric: "had" },
      { note: "D4", beats: 1, lyric: "a" },
      { note: "E4", beats: 1, lyric: "lit" },
      { note: "E4", beats: 1, lyric: "tle" },
      { note: "E4", beats: 2, lyric: "lamb" },
      { note: "D4", beats: 1, lyric: "lit" },
      { note: "D4", beats: 1, lyric: "tle" },
      { note: "D4", beats: 2, lyric: "lamb" },
      { note: "E4", beats: 1, lyric: "lit" },
      { note: "G4", beats: 1, lyric: "tle" },
      { note: "G4", beats: 2, lyric: "lamb" },
    ],
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy",
    bpm: 120,
    melody: [
      { note: "E4", beats: 1, lyric: "Joy" },
      { note: "E4", beats: 1, lyric: "ful" },
      { note: "F4", beats: 1, lyric: "joy" },
      { note: "G4", beats: 1, lyric: "ful" },
      { note: "G4", beats: 1, lyric: "we" },
      { note: "F4", beats: 1, lyric: "a" },
      { note: "E4", beats: 1, lyric: "dore" },
      { note: "D4", beats: 1, lyric: "thee" },
      { note: "C4", beats: 1, lyric: "God" },
      { note: "C4", beats: 1, lyric: "of" },
      { note: "D4", beats: 1, lyric: "glo" },
      { note: "E4", beats: 1, lyric: "ry" },
      { note: "E4", beats: 1.5, lyric: "Lord" },
      { note: "D4", beats: 0.5, lyric: "of" },
      { note: "D4", beats: 2, lyric: "love" },
    ],
  },
];

// Total duration of a song in seconds.
export function songDuration(song: Song): number {
  const beats = song.melody.reduce((a, n) => a + n.beats, 0);
  return (beats / song.bpm) * 60;
}

// Which melody note is active at time `t` (seconds), plus its start offset.
export function noteAtTime(song: Song, t: number): { index: number; note: MelodyNote } {
  const secPerBeat = 60 / song.bpm;
  let acc = 0;
  for (let i = 0; i < song.melody.length; i++) {
    const dur = song.melody[i].beats * secPerBeat;
    if (t < acc + dur) return { index: i, note: song.melody[i] };
    acc += dur;
  }
  const last = song.melody.length - 1;
  return { index: last, note: song.melody[last] };
}
