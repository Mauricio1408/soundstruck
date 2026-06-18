import { useCallback, useRef, useState } from "react";
import { noteToFreq, type Song } from "./songs";

// Centralized media engine: microphone, camera, recording, and live pitch detection.
export function useAudioEngine() {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>("audio/webm");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufRef = useRef<Float32Array | null>(null);
  const pitchRef = useRef<number>(0); // latest detected fundamental in Hz (0 = silence)
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);

  // Attach the live camera feed to a <video> element.
  const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && camStreamRef.current) {
      el.srcObject = camStreamRef.current;
      el.play().catch(() => {});
    }
  }, []);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);
      setMicOn(true);
      setError(null);
    } catch (e) {
      setError("Microphone access denied. Enable it in your browser to sing along.");
    }
  }, []);

  const stopMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    pitchRef.current = 0;
    setMicOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      camStreamRef.current = stream;
      if (videoElRef.current) {
        videoElRef.current.srcObject = stream;
        videoElRef.current.play().catch(() => {});
      }
      setCameraStream(stream);
      setCameraOn(true);
      setError(null);
    } catch (e) {
      setError("Camera access denied. Enable it in your browser to use video.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCameraStream(null);
    setCameraOn(false);
  }, []);

  // Autocorrelation pitch detection — call each animation frame.
  const detectPitch = useCallback((): number => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    const ctx = audioCtxRef.current;
    if (!analyser || !buf || !ctx) return 0;
    analyser.getFloatTimeDomainData(buf);

    let rms = 0;
    for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / buf.length);
    if (rms < 0.01) {
      pitchRef.current = 0;
      return 0; // too quiet
    }

    const SIZE = buf.length;
    let bestOffset = -1;
    let bestCorr = 0;
    let lastCorr = 1;
    const minOffset = Math.floor(ctx.sampleRate / 1000); // ~1000 Hz max
    const maxOffset = Math.floor(ctx.sampleRate / 80); // ~80 Hz min
    for (let offset = minOffset; offset < maxOffset; offset++) {
      let corr = 0;
      for (let i = 0; i < SIZE - offset; i++) corr += buf[i] * buf[i + offset];
      corr /= SIZE - offset;
      if (corr > 0.9 && corr > lastCorr && corr > bestCorr) {
        bestCorr = corr;
        bestOffset = offset;
      }
      lastCorr = corr;
    }
    if (bestOffset > 0) {
      const freq = ctx.sampleRate / bestOffset;
      pitchRef.current = freq;
      return freq;
    }
    pitchRef.current = 0;
    return 0;
  }, []);

  const startRecording = useCallback(() => {
    const tracks: MediaStreamTrack[] = [];
    if (micStreamRef.current) tracks.push(...micStreamRef.current.getAudioTracks());
    if (camStreamRef.current) tracks.push(...camStreamRef.current.getVideoTracks());
    if (tracks.length === 0) {
      setError("Turn on the microphone or camera before recording.");
      return;
    }
    const stream = new MediaStream(tracks);
    const hasVideo = stream.getVideoTracks().length > 0;
    const mime = hasVideo ? "video/webm" : "audio/webm";
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(URL.createObjectURL(blob));
      setRecordedMime(mime);
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
  }, [recordedUrl]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // Grab a still frame from the camera (returns a data URL or null).
  const captureFrame = useCallback((): string | null => {
    const v = videoElRef.current;
    if (!v || !camStreamRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }, []);

  // Synthesize the song melody, perfectly aligned to the target pitch notes.
  const playMelody = useCallback((song: Song, fromSec = 0) => {
    stopMelody();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    playbackCtxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const secPerBeat = 60 / song.bpm;
    const base = ctx.currentTime + 0.06;
    let noteStart = 0;
    song.melody.forEach((n) => {
      const dur = n.beats * secPerBeat;
      const noteEnd = noteStart + dur;
      if (noteEnd > fromSec) {
        const startAt = base + Math.max(0, noteStart - fromSec);
        const playDur = noteEnd - Math.max(noteStart, fromSec);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = noteToFreq(n.note);
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.22, startAt + 0.02);
        gain.gain.setValueAtTime(0.22, startAt + playDur * 0.75);
        gain.gain.linearRampToValueAtTime(0.0001, startAt + playDur * 0.98);
        osc.connect(gain).connect(master);
        osc.start(startAt);
        osc.stop(startAt + playDur);
      }
      noteStart = noteEnd;
    });
  }, []);

  const stopMelody = useCallback(() => {
    playbackCtxRef.current?.close().catch(() => {});
    playbackCtxRef.current = null;
  }, []);

  return {
    micOn, cameraOn, recording, recordedUrl, recordedMime, cameraStream, error,
    pitchRef, setVideoEl,
    startMic, stopMic, startCamera, stopCamera,
    startRecording, stopRecording, detectPitch, captureFrame,
    playMelody, stopMelody,
  };
}
