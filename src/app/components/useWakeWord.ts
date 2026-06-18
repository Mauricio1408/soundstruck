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
  const recRef = useRef<any>(null);
  const wantRef = useRef(false); // whether we intend to keep listening
  const lastFireRef = useRef(0);
  const onWakeRef = useRef(onWake);
  onWakeRef.current = onWake;

  const start = useCallback(() => {
    if (!SR) return;
    wantRef.current = true;
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
      if (wantRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore overlap errors */
        }
      } else {
        setListening(false);
      }
    };
    rec.onerror = () => {};

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, [SR]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
    setHeard("");
  }, []);

  return { supported: !!SR, listening, heard, start, stop };
}
