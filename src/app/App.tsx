import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Video,
  Square,
  Download,
  Music2,
  Mic2,
  GraduationCap,
  SlidersHorizontal,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Trophy,
  ImageDown,
  Check,
  Ear,
  Layers,
  Share2,
  ChevronDown,
  X,
  FileAudio,
  FileVideo,
} from "lucide-react";
import { VoiceBlob } from "./components/VoiceBlob";
import { PitchWave } from "./components/PitchWave";
import { figma, lessons } from "./components/figma-theme";
import { songs, songDuration, noteAtTime, noteToFreq } from "./components/songs";
import { personas, speakAs, loadVoices, type Persona } from "./components/personas";
import { useAudioEngine } from "./components/useAudioEngine";
import { useWakeWord } from "./components/useWakeWord";

const PRAISE = [
  "Perfect pitch on that note! 🎯",
  "Gorgeous tone — right on key!",
  "Beautiful! You nailed it!",
  "Locked in. Stunning!",
  "Yes! That's the note!",
];

// Keeps a runtime error from blanking the whole preview.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="size-full flex items-center justify-center p-8 text-white" style={{ background: "#0a0a0f" }}>
          <div className="max-w-md rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
            <p className="mt-2 text-white/60" style={{ fontSize: 13 }}>{this.state.error.message}</p>
            <button onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-lg px-4 py-2" style={{ background: figma.blue, fontSize: 13 }}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Studio />
    </ErrorBoundary>
  );
}

function Studio() {
  const eng = useAudioEngine();
  const [songIdx, setSongIdx] = useState(0);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [personaId, setPersonaId] = useState(personas[2].id);
  const [feedback, setFeedback] = useState("Pick a song and press play 🎤");
  const [onNote, setOnNote] = useState(false);
  const [hits, setHits] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [doneLessons, setDoneLessons] = useState<Set<number>>(new Set());
  const [expandedLesson, setExpandedLesson] = useState<number | null>(0);
  const [coachReplying, setCoachReplying] = useState(false);
  const [cameraAsBackground, setCameraAsBackground] = useState(false);
  const [recClock, setRecClock] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach the live camera stream to the stage-background video
  useEffect(() => {
    const v = bgVideoRef.current;
    if (v && eng.cameraStream) {
      v.srcObject = eng.cameraStream;
      v.play().catch(() => {});
    }
  }, [eng.cameraStream, cameraAsBackground]);

  const persona = personas.find((p) => p.id === personaId)!;
  const song = songs[songIdx];
  const duration = useMemo(() => songDuration(song), [song]);
  const { note, index: noteIndex } = noteAtTime(song, elapsed);
  const targetFreq = noteToFreq(note.note);
  const progress = Math.min(100, (elapsed / duration) * 100);
  const score = Math.min(100, 40 + hits * 3);

  useEffect(() => { loadVoices(); }, []);

  // Advance playback clock
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setElapsed((t) => {
        if (t >= duration) {
          setPlaying(false);
          eng.stopMelody();
          return duration;
        }
        return t + 0.1;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, duration]);

  // Advance recording clock
  useEffect(() => {
    if (!eng.recording || !eng.recStartTime) {
      setRecClock(0);
      return;
    }
    const id = setInterval(() => {
      setRecClock(Math.floor((Date.now() - eng.recStartTime!) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, [eng.recording, eng.recStartTime]);

  // 3-2-1 countdown, then start the music aligned to the pitch notes
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      setCountdown(null);
      setPlaying(true);
      eng.playMelody(song, elapsed);
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  // Confetti + praise only when the singer actually hits the target note
  const handleNoteChange = useCallback(
    (hit: boolean) => {
      setOnNote(hit);
      if (!hit) return;
      setHits((h) => h + 1);
      const el = stageRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        confetti({
          particleCount: 36,
          spread: 75,
          startVelocity: 34,
          scalar: 0.9,
          origin: {
            x: (r.left + r.width / 2) / window.innerWidth,
            y: (r.top + r.height * 0.42) / window.innerHeight,
          },
          colors: [figma.red, figma.orange, figma.purple, figma.blue, figma.green],
          disableForReducedMotion: true,
        });
      }
      const line = PRAISE[Math.floor(Math.random() * PRAISE.length)];
      setFeedback(line);
    },
    []
  );

  // "Hey Coach" wake word → coach perks up and replies in its own voice
  const WAKE_REPLIES = [
    "Hey there! I'm listening. Ready to sing?",
    "Yes? I'm right here. Let's warm up!",
    "Hi! Pick a song and I'll guide you.",
    "I'm all ears! What shall we practice?",
  ];
  const handleWake = useCallback(() => {
    const line = WAKE_REPLIES[Math.floor(Math.random() * WAKE_REPLIES.length)];
    setFeedback(line);
    setCoachReplying(true);
    speakAs(persona, line);
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => setCoachReplying(false), 4000);
  }, [persona]);
  const wake = useWakeWord(handleWake);

  // Coach greets in its own voice when switched
  const pickPersona = (p: Persona) => {
    setPersonaId(p.id);
    setFeedback(`Hi, I'm ${p.name}! Let's make some music.`);
    speakAs(p, `Hi, I'm ${p.name}. Let's sing ${song.title}!`);
  };

  // Media toggles
  const toggleMic = () => (eng.micOn ? eng.stopMic() : eng.startMic());
  const toggleCamera = () => (eng.cameraOn ? eng.stopCamera() : eng.startCamera());
  const toggleRecord = () => (eng.recording ? eng.stopRecording() : eng.startRecording());

  // Share the recording — uses the native share sheet (lets the user pick
  // Instagram / Facebook on supported devices), falling back to opening the site.
  const shareRecording = async (platform: "instagram" | "facebook" | "any") => {
    if (!eng.recordedUrl) return;
    try {
      const res = await fetch(eng.recordedUrl);
      const blob = await res.blob();
      const file = new File([blob], `soundstruck.${recExt}`, { type: eng.recordedMime });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "My SOUNDSTRUCK performance",
          text: `I just sang ${song.title} on SOUNDSTRUCK! 🎤`,
        });
        return;
      }
    } catch {
      /* user cancelled or sharing unsupported */
    }
    // Fallback: download then open the platform so the user can post manually
    const a = document.createElement("a");
    a.href = eng.recordedUrl;
    a.download = `soundstruck.${recExt}`;
    a.click();
    if (platform === "instagram") window.open("https://www.instagram.com", "_blank");
    else if (platform === "facebook") window.open("https://www.facebook.com", "_blank");
  };

  const togglePlay = () => {
    if (countdown !== null) return; // already counting down
    if (playing) {
      setPlaying(false);
      eng.stopMelody();
      window.speechSynthesis?.cancel();
      return;
    }
    if (elapsed >= duration) {
      setElapsed(0);
      setHits(0);
    }
    setCountdown(3);
    setFeedback("Get ready... 🎶");
    speakAs(persona, `Get ready to sing ${song.title}`);
  };

  const selectSong = (i: number) => {
    setSongIdx(i);
    setElapsed(0);
    setHits(0);
    setPlaying(false);
    setCountdown(null);
    eng.stopMelody();
    setFeedback(`"${songs[i].title}" loaded. Ready when you are!`);
  };

  // Selecting a lesson loads its recommended song and the coach introduces it
  const selectLesson = (i: number) => {
    // Toggle the accordion; collapse if tapping the already-open lesson
    setExpandedLesson((prev) => (prev === i ? null : i));
    setLessonIdx(i);
    const l = lessons[i];
    const si = songs.findIndex((s) => s.id === l.song);
    if (si >= 0 && si !== songIdx) selectSong(si);
    setFeedback(`${l.name} — ${l.focus}. ${l.tips[0]}`);
    speakAs(persona, `Let's work on ${l.focus}. ${l.description}`);
  };

  const toggleLessonDone = (i: number) => {
    setDoneLessons((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // Lyric tokens for the current song (fall back to note names when no words)
  const lyricTokens = song.melody.map((n, i) => ({ i, text: n.lyric?.trim() || n.note }));

  // Compose a shareable photo: camera frame (or gradient) + score card overlay
  const takeScorePhoto = () => {
    const W = 720, H = 900;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const frame = eng.captureFrame();
    const draw = (img?: HTMLImageElement) => {
      if (img) {
        const ratio = Math.max(W / img.width, (H * 0.62) / img.height);
        const dw = img.width * ratio, dh = img.height * ratio;
        ctx.drawImage(img, (W - dw) / 2, 0, dw, dh);
      } else {
        const g = ctx.createLinearGradient(0, 0, W, H * 0.62);
        g.addColorStop(0, figma.purple); g.addColorStop(1, figma.blue);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.62);
      }
      // card
      ctx.fillStyle = "#0a0a0f"; ctx.fillRect(0, H * 0.6, W, H * 0.4);
      const g2 = ctx.createLinearGradient(0, 0, W, 0);
      g2.addColorStop(0, figma.green); g2.addColorStop(1, figma.blue);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "600 26px Inter, sans-serif";
      ctx.fillText("SOUNDSTRUCK", W / 2, H * 0.6 + 56);
      ctx.font = "500 30px Inter, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(song.title, W / 2, H * 0.6 + 104);
      ctx.fillStyle = g2;
      ctx.font = "700 150px Inter, sans-serif";
      ctx.fillText(String(score), W / 2, H * 0.6 + 250);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "500 28px Inter, sans-serif";
      ctx.fillText(`out of 100  ·  ${hits} perfect notes`, W / 2, H * 0.6 + 300);
      setPhoto(canvas.toDataURL("image/png"));
    };
    if (frame) {
      const img = new Image();
      img.onload = () => draw(img);
      img.src = frame;
    } else draw();
  };

  const hasVideo = eng.recordedMime.includes("video");
  const recExt = hasVideo ? "webm" : "weba";

  return (
    <div className="size-full overflow-hidden text-white"
      style={{ background: "#0a0a0f", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(60% 50% at 20% 10%, ${figma.purple}1f, transparent), radial-gradient(50% 50% at 90% 90%, ${figma.blue}1a, transparent)` }} />

      <div className="relative flex h-full flex-col p-4 gap-4">
        {/* Top bar — logo + settings/ai removed, persona swatches kept */}
        <header className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <img src="/soundstruck-favicon.svg" alt="SoundStruck Logo" className="h-10 w-10" />
            <div>
              <div style={{ fontWeight: 600, letterSpacing: "0.04em", fontSize: 18 }}>SOUNDSTRUCK</div>
              <div className="text-white/40" style={{ fontSize: 12 }}>Vocal coaching studio</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-white/40" style={{ fontSize: 12 }}>Coach</span>
            {personas.map((p) => (
              <button key={p.id} onClick={() => pickPersona(p)} title={`${p.name} — ${p.tagline}`}
                className="rounded-full transition-transform hover:scale-110"
                style={{ width: 26, height: 26, background: p.color,
                  outline: personaId === p.id ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2 }} />
            ))}
          </div>
        </header>

        {eng.error && (
          <div className="mx-2 flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: `${figma.red}22`, fontSize: 13 }}>
            <span className="flex-1">{eng.error}</span>
            <button onClick={() => eng.clearError()} className="shrink-0 rounded-md p-1 hover:bg-white/10" title="Dismiss">
              <X className="h-4 w-4 text-white/50" />
            </button>
          </div>
        )}

        <div className="flex flex-1 gap-4 min-h-0">
          {/* LEFT SIDEBAR */}
          <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto pr-1" style={scrollStyle}>
            <Panel>
              <SectionTitle icon={<Music2 className="h-4 w-4" />}>Song Choices</SectionTitle>
              <div className="flex flex-col gap-1">
                {songs.map((s, i) => (
                  <button key={s.id} onClick={() => selectSong(i)} className="text-left">
                    <RowItem active={i === songIdx} dot={figma.blue}>
                      <span className="flex-1 truncate">{s.title}</span>
                    </RowItem>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel>
              <SectionTitle icon={<GraduationCap className="h-4 w-4" />}>
                Vocal Lessons ({doneLessons.size}/{lessons.length} done)
              </SectionTitle>
              <div className="flex flex-col gap-1.5">
                {lessons.map((l, i) => {
                  const done = doneLessons.has(i);
                  const open = expandedLesson === i;
                  const practice = songs.find((s) => s.id === l.song)?.title ?? "";
                  return (
                    <div key={l.id} className="overflow-hidden rounded-xl transition-colors"
                      style={{ background: open ? "rgba(255,255,255,0.06)" : "transparent",
                        border: `1px solid ${open ? "rgba(255,255,255,0.1)" : "transparent"}` }}>
                      <div className="flex items-center gap-2 px-1">
                        <button onClick={() => selectLesson(i)} className="flex flex-1 min-w-0 items-center gap-3 px-2 py-2 text-left">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: figma.purple, opacity: i === lessonIdx ? 1 : 0.4 }} />
                          <span className="flex-1 truncate" style={{ fontSize: 14,
                            color: done ? "rgba(255,255,255,0.4)" : open || i === lessonIdx ? "#fff" : "rgba(255,255,255,0.65)",
                            textDecoration: done ? "line-through" : "none" }}>{l.name}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-white/40 transition-transform"
                            style={{ transform: open ? "rotate(180deg)" : "none" }} />
                        </button>
                        <button onClick={() => toggleLessonDone(i)} title="Mark complete"
                          className="grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors"
                          style={{ background: done ? figma.green : "transparent",
                            border: done ? "none" : "1.5px solid rgba(255,255,255,0.3)" }}>
                          {done && <Check className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {open && (
                        <div className="px-3 pb-3 pt-1">
                          <span className="inline-block rounded-full px-2 py-0.5" style={{ fontSize: 11, background: `${figma.purple}22`, color: figma.purple }}>
                            {l.focus}
                          </span>
                          <p className="mt-2 text-white/55" style={{ fontSize: 13 }}>{l.description}</p>
                          <div className="mt-3 flex flex-col gap-2">
                            {l.tips.map((tip, ti) => (
                              <div key={ti} className="flex items-start gap-2">
                                <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full"
                                  style={{ background: figma.green, fontSize: 10, fontWeight: 700, color: "#0a0a0f" }}>
                                  {ti + 1}
                                </span>
                                <span className="text-white/70" style={{ fontSize: 12 }}>{tip}</span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <Music2 className="h-3.5 w-3.5 text-white/40" />
                            <span className="text-white/50" style={{ fontSize: 12 }}>Practice song: {practice}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel>
              <SectionTitle icon={<Trophy className="h-4 w-4" />}>Score</SectionTitle>
              <div className="flex items-end gap-2">
                <span style={{ fontSize: 40, fontWeight: 700,
                  background: `linear-gradient(135deg, ${figma.green}, ${figma.blue})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{score}</span>
                <span className="mb-2 text-white/40">/ 100</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${score}%`, background: `linear-gradient(90deg, ${figma.green}, ${figma.blue})` }} />
              </div>
              <button onClick={takeScorePhoto}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 transition-transform hover:scale-[1.02]"
                style={{ background: figma.blue, fontSize: 13 }}>
                <ImageDown className="h-4 w-4" /> Take Score Photo
              </button>
            </Panel>
          </aside>

          {/* CENTER STAGE */}
          <main ref={stageRef} className="relative flex flex-1 flex-col overflow-hidden rounded-3xl"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-7 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white/40" style={{ fontSize: 12, letterSpacing: "0.08em" }}>NOW SINGING</div>
                  <div style={{ fontSize: 22, fontWeight: 600 }}>{song.title}</div>
                </div>
                <span className="rounded-full px-3 py-1"
                  style={{ fontSize: 12, background: `${onNote ? figma.green : figma.purple}22`, color: onNote ? figma.green : figma.purple }}>
                  {onNote ? "● On pitch" : "● Live"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="text-white/40" style={{ fontSize: 12 }}>{fmtTime(elapsed)}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full"
                    style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${figma.blue}, ${figma.purple}, ${figma.red})` }} />
                </div>
                <span className="text-white/40" style={{ fontSize: 12 }}>{fmtTime(duration)}</span>
              </div>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden">
              {/* background layer: dispersed blob OR live camera feed */}
              <div className="absolute inset-0 flex items-center justify-center">
                {cameraAsBackground && eng.cameraOn ? (
                  <>
                    <video ref={bgVideoRef} muted playsInline className="h-full w-full object-cover" />
                    <div className="absolute inset-0" style={{ background: "rgba(10,10,15,0.6)" }} />
                  </>
                ) : (
                  <motion.div
                    animate={{ opacity: playing ? 0.28 : 1, scale: playing ? 1.45 : 1,
                      filter: playing ? "blur(10px)" : "blur(0px)" }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}>
                    <VoiceBlob active={playing || coachReplying} />
                  </motion.div>
                )}
              </div>

              {/* active persona badge */}
              <motion.div className="absolute z-10" style={{ bottom: "7%", left: "6%" }}
                animate={{ opacity: playing ? 0.7 : 1, y: playing ? [0, -6, 0] : 0 }}
                transition={{ duration: 1.8, repeat: playing ? Infinity : 0 }}>
                <div className="flex items-center gap-2 rounded-2xl p-2 pr-3 backdrop-blur-md"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <persona.Illustration size={44} />
                  <span style={{ fontSize: 13 }}>{persona.name}</span>
                </div>
              </motion.div>

              {/* MAIN FOCUS: big karaoke lyrics while singing */}
              {playing && (
                <div className="relative z-10 px-10 text-center">
                  <div className="mb-3 text-white/50" style={{ fontSize: 12, letterSpacing: "0.12em" }}>
                    ♪ TARGET NOTE · {note.note}
                  </div>
                  <AnimatePresence mode="popLayout">
                    <motion.div key={noteIndex}
                      initial={{ opacity: 0, y: 24, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -24, scale: 0.8 }}
                      transition={{ duration: 0.3 }}
                      style={{ fontSize: 80, fontWeight: 700, lineHeight: 1,
                        color: onNote ? figma.green : "#fff",
                        textShadow: `0 0 36px ${onNote ? figma.green : figma.purple}` }}>
                      {lyricTokens[noteIndex]?.text}
                    </motion.div>
                  </AnimatePresence>
                  <div className="mt-6 flex items-center justify-center gap-3">
                    {lyricTokens.slice(noteIndex + 1, noteIndex + 5).map((t) => (
                      <span key={t.i} className="text-white/35" style={{ fontSize: 22 }}>{t.text}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Idle state: song title sits below the blob so it doesn't clash */}
              {!playing && (
                <div className="absolute inset-x-0 z-10 text-center" style={{ bottom: "8%" }}>
                  <div style={{ fontSize: 30, fontWeight: 600 }}>{song.title}</div>
                  <div className="mt-2 text-white/50" style={{ fontSize: 14 }}>Press play to start singing</div>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div key={feedback} initial={{ opacity: 0, y: 12, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.9 }}
                  transition={{ duration: 0.35 }} className="absolute z-10" style={{ top: "22%", right: "10%" }}>
                  <div className="rounded-2xl rounded-br-sm px-4 py-3 backdrop-blur-md"
                    style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                      maxWidth: 220, boxShadow: `0 8px 30px ${persona.color}44` }}>
                    <div className="text-white/50" style={{ fontSize: 11 }}>{persona.name} · AI Coach</div>
                    <div style={{ fontSize: 14 }}>{feedback}</div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* 3-2-1 countdown overlay */}
              <AnimatePresence>
                {countdown !== null && countdown > 0 && (
                  <motion.div key={countdown} className="absolute inset-0 z-10 flex items-center justify-center"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ background: "rgba(10,10,15,0.55)", backdropFilter: "blur(2px)" }}>
                    <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.5 }}
                      style={{ fontSize: 120, fontWeight: 700,
                        background: `linear-gradient(135deg, ${figma.purple}, ${figma.blue})`,
                        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      {countdown}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mx-6 mb-3 h-28 rounded-2xl relative"
              style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <PitchWave playing={playing} micOn={eng.micOn} targetFreq={targetFreq}
                getPitch={eng.detectPitch} onNoteChange={handleNoteChange} />
              {!eng.micOn && (
                <div className="absolute bottom-1 left-3 text-white/40" style={{ fontSize: 11 }}>
                  Turn on the mic to sing — dashed line is your target pitch
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 py-6">
              <button onClick={() => selectSong((songIdx - 1 + songs.length) % songs.length)}
                className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
                <SkipBack className="h-5 w-5" /><span style={{ fontSize: 11 }}>previous</span>
              </button>
              <button onClick={togglePlay} disabled={countdown !== null}
                className="grid h-16 w-16 place-items-center rounded-full transition-transform hover:scale-105"
                style={{ background: figma.blue, boxShadow: `0 0 30px ${figma.blue}66` }}>
                {countdown !== null ? (
                  <span style={{ fontSize: 24, fontWeight: 700 }}>{countdown}</span>
                ) : playing ? (
                  <Pause className="h-7 w-7" />
                ) : (
                  <Play className="h-7 w-7 translate-x-0.5" />
                )}
              </button>
              <button onClick={() => selectSong((songIdx + 1) % songs.length)}
                className="flex flex-col items-center gap-1 text-white/60 hover:text-white">
                <SkipForward className="h-5 w-5" /><span style={{ fontSize: 11 }}>next</span>
              </button>
            </div>
          </main>

          {/* RIGHT SIDEBAR */}
          <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto pr-1" style={scrollStyle}>
            <Panel>
              <SectionTitle icon={<SlidersHorizontal className="h-4 w-4" />}>Controls</SectionTitle>
              <Toggle icon={eng.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                label="Microphone" color={figma.green} on={eng.micOn} onClick={toggleMic} />
              <Toggle icon={eng.cameraOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                label="Camera" color={figma.blue} on={eng.cameraOn} onClick={toggleCamera} />
              <Toggle icon={eng.recording ? <Square className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                label={eng.recording ? `Stop Recording (${fmtTime(recClock)})` : "Record Audio/Video"} color={figma.red}
                on={eng.recording} onClick={toggleRecord} />

              {/* "Hey Coach" wake word */}
              {wake.supported && (
                <Toggle icon={<Ear className="h-4 w-4" />}
                  label={'Say "Hey Coach"'} color={figma.purple}
                  on={wake.listening} onClick={() => (wake.listening ? wake.stop() : wake.start())} />
              )}
              {wake.listening && (
                <div className="mb-1 flex items-center gap-2 px-3 text-white/40" style={{ fontSize: 11 }}>
                  <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: figma.purple }} />
                  Listening… {wake.heard && <span className="truncate italic">“{wake.heard}”</span>}
                </div>
              )}
              {wake.error && (
                <div className="mb-1 px-3 text-white/50" style={{ fontSize: 11, color: figma.orange }}>
                  {wake.error}
                </div>
              )}

              {/* recording results: download + share */}
              {eng.recordedUrl && !eng.recording && (
                <div className="mt-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="mb-2 text-white/50" style={{ fontSize: 12 }}>Your performance is ready! 🎉</div>
                  {hasVideo ? (
                    <video src={eng.recordedUrl} controls className="mb-2 w-full rounded-lg" />
                  ) : (
                    <audio src={eng.recordedUrl} controls className="mb-2 w-full" />
                  )}
                  {/* Download buttons — separate video and audio options */}
                  <div className="flex flex-col gap-2">
                    {hasVideo && (
                      <button onClick={() => eng.downloadAs("video")}
                        className="flex items-center justify-center gap-2 rounded-lg py-2 transition-transform hover:scale-[1.02]"
                        style={{ background: figma.blue, fontSize: 13 }}>
                        <FileVideo className="h-4 w-4" /> Download as Video
                      </button>
                    )}
                    <button onClick={() => eng.downloadAs("audio")}
                      className="flex items-center justify-center gap-2 rounded-lg py-2 transition-transform hover:scale-[1.02]"
                      style={{ background: hasVideo ? "rgba(255,255,255,0.1)" : figma.blue, fontSize: 13 }}>
                      <FileAudio className="h-4 w-4" /> Download as Audio
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button onClick={() => shareRecording("instagram")}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 transition-transform hover:scale-[1.02]"
                      style={{ background: `linear-gradient(135deg, ${figma.purple}, ${figma.red})`, fontSize: 12 }}>
                      <Share2 className="h-3.5 w-3.5" /> Instagram
                    </button>
                    <button onClick={() => shareRecording("facebook")}
                      className="flex items-center justify-center gap-1.5 rounded-lg py-2 transition-transform hover:scale-[1.02]"
                      style={{ background: figma.blue, fontSize: 12 }}>
                      <Share2 className="h-3.5 w-3.5" /> Facebook
                    </button>
                  </div>
                </div>
              )}
            </Panel>

            {/* Camera output */}
            <Panel>
              <SectionTitle icon={<Camera className="h-4 w-4" />}>Camera</SectionTitle>
              <div className="relative overflow-hidden rounded-xl bg-black/50" style={{ aspectRatio: "16/10" }}>
                <video ref={eng.setVideoEl} muted playsInline
                  className="h-full w-full object-cover"
                  style={{ display: eng.cameraOn ? "block" : "none" }} />
                {!eng.cameraOn && (
                  <button onClick={toggleCamera}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/40">
                    <CameraOff className="h-6 w-6" />
                    <span style={{ fontSize: 12 }}>Tap to turn on camera</span>
                  </button>
                )}
              </div>
              <button onClick={() => setCameraAsBackground((b) => !b)} disabled={!eng.cameraOn}
                className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5 disabled:opacity-40"
                title="Sing with your camera as the stage background">
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  <span style={{ fontSize: 13 }}>Use camera as stage background</span>
                </span>
                <span className="relative h-5 w-9 shrink-0 rounded-full transition-colors"
                  style={{ background: cameraAsBackground && eng.cameraOn ? figma.blue : "rgba(255,255,255,0.15)" }}>
                  <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: cameraAsBackground && eng.cameraOn ? 18 : 2 }} />
                </span>
              </button>
            </Panel>

            <Panel>
              <SectionTitle icon={<Mic2 className="h-4 w-4" />}>Coach Voice Changer</SectionTitle>
              <div className="flex flex-col gap-1">
                {personas.map((p) => (
                  <button key={p.id} onClick={() => pickPersona(p)}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors"
                    style={{ background: personaId === p.id ? "rgba(255,255,255,0.08)" : "transparent" }}>
                    <div className="rounded-xl p-1" style={{ background: `${p.color}22` }}>
                      <p.Illustration size={40} />
                    </div>
                    <div className="flex-1">
                      <div style={{ fontSize: 14 }}>{p.name}</div>
                      <div className="text-white/40" style={{ fontSize: 11 }}>{p.tagline}</div>
                    </div>
                    {personaId === p.id && (
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                    )}
                  </button>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      </div>

      {/* Score photo modal */}
      <AnimatePresence>
        {photo && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPhoto(null)}>
            <motion.div onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative rounded-2xl p-3" style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)" }}>
              <button onClick={() => setPhoto(null)} className="absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1">
                <X className="h-5 w-5" />
              </button>
              <img src={photo} alt="Your score" className="max-h-[70vh] rounded-xl" />
              <a href={photo} download="soundstruck-score.png"
                className="mt-3 flex items-center justify-center gap-2 rounded-lg py-2.5 transition-transform hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${figma.green}, ${figma.blue})`, fontSize: 14 }}>
                <Download className="h-4 w-4" /> Download photo
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- helpers ---------- */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {children}
    </section>
  );
}
function SectionTitle({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-white/50" style={{ fontSize: 12, letterSpacing: "0.06em" }}>
      {icon}<span style={{ textTransform: "uppercase" }}>{children}</span>
    </div>
  );
}
function RowItem({ children, active, dot }: { children: React.ReactNode; active?: boolean; dot?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
      style={{ background: active ? "rgba(255,255,255,0.08)" : "transparent" }}>
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot, opacity: active ? 1 : 0.4 }} />
      <span className="flex flex-1 items-center gap-2" style={{ fontSize: 14, color: active ? "#fff" : "rgba(255,255,255,0.65)" }}>
        {children}
      </span>
    </div>
  );
}
function Toggle({ icon, label, color, on, onClick }: {
  icon: React.ReactNode; label: string; color: string; on: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5">
      <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: on ? color : "rgba(255,255,255,0.08)" }}>{icon}</span>
      <span className="flex-1 text-left" style={{ fontSize: 14 }}>{label}</span>
      <span className="relative h-5 w-9 rounded-full transition-colors" style={{ background: on ? color : "rgba(255,255,255,0.15)" }}>
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
      </span>
    </button>
  );
}
const scrollStyle: React.CSSProperties = {
  scrollbarWidth: "thin",
  scrollbarColor: "rgba(255,255,255,0.35) transparent",
  scrollbarGutter: "stable",
};
function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
