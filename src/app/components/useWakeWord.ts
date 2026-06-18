import { useCallback, useRef, useState } from "react";

// Listens for the wake phrase "hey coach" via the Web Speech API and fires a
// callback. Auto-restarts so it keeps listening continuously.
export function useWakeWord(onWake: () => void) {
  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const wantRef = useRef(false); // whether we intend to keep listening
  const lastFireRef = useRef(0);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  const clearRestart = () => {
    if (restartTimer.current) {
      clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
  };

  const restart = useCallback((rec: any) => {
    clearRestart();
    if (!wantRef.current) {
      setListening(false);
      return;
    }
    // Small delay before restarting to avoid rapid start/stop thrashing
    restartTimer.current = setTimeout(() => {
      if (!wantRef.current) return;
      try {
        rec.start();
      } catch {
        // If this fails, try creating a new instance
        try {
          const fresh = new SR();
          fresh.continuous = true;
          fresh.interimResults = true;
          fresh.lang = "en-US";
          fresh.onresult = rec.onresult;
          fresh.onend = rec.onend;
          fresh.onerror = rec.onerror;
          recRef.current = fresh;
          fresh.start();
        } catch {
          setListening(false);
          setError("Speech recognition failed to restart.");
        }
      }
    }, 200);
  }, [SR]);

  const start = useCallback(() => {
    if (!SR) return;
    wantRef.current = true;
    setError(null);
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript.toLowerCase().trim();
        setHeard(txt);
        const match = /hey,?\s*coach|hi,?\s*coach|okay\s*coach/.test(txt);
        const now = Date.now();
        if (match && now - lastFireRef.current > 2500) {
          lastFireRef.current = now;
          onWakeRef.current();
        }
      }
    };
    rec.onend = () => {
      // Chrome stops periodically — restart while the user still wants it.
      restart(rec);
    };
    rec.onerror = (e: any) => {
      const errType = e?.error ?? "";
      // "no-speech" is normal — just means silence, keep listening
      if (errType === "no-speech" || errType === "aborted") return;
      if (errType === "not-allowed" || errType === "service-not-allowed") {
        setError("Microphone permission needed for \"Hey Coach\".");
        wantRef.current = false;
        setListening(false);
        return;
      }
      if (errType === "network") {
        setError("Network error — please use Google Chrome or check your connection.");
        wantRef.current = false;
        setListening(false);
        return;
      }
      // For other transient errors, let onend handle restart
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Could not start speech recognition.");
    }
  }, [SR, restart]);

  const stop = useCallback(() => {
    wantRef.current = false;
    clearRestart();
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    recRef.current = null;
    setListening(false);
    setHeard("");
    setError(null);
  }, []);

  return { supported: !!SR, listening, heard, error, start, stop };
}

