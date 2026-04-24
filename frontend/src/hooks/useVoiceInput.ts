import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API typing (TS doesn't ship these).
interface SpeechRecognitionEvent extends Event {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (e: SpeechRecognitionEvent) => void;
  onerror: (e: unknown) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceInput(lang = "en-IN") {
  const [supported] = useState(() => getRecognitionCtor() !== null);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef("");
  const onFinalRef = useRef<((t: string) => void) | null>(null);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (event) => {
      let final = "";
      let partial = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const isFinal = (result as unknown as { isFinal?: boolean }).isFinal;
        const transcript = result[0].transcript;
        if (isFinal) final += transcript;
        else partial += transcript;
      }
      if (final) finalTranscriptRef.current += final;
      setInterim(partial);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      if (text && onFinalRef.current) onFinalRef.current(text);
    };
    recognitionRef.current = rec;
    return () => rec.abort();
  }, [lang]);

  const start = useCallback((onFinal: (t: string) => void) => {
    if (!recognitionRef.current) return;
    onFinalRef.current = onFinal;
    finalTranscriptRef.current = "";
    setInterim("");
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  return { supported, listening, interim, start, stop };
}
