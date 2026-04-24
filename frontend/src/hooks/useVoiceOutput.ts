import { useCallback, useEffect, useRef, useState } from "react";

type TargetLang = "hi" | "en";

function detectLang(text: string): TargetLang {
  return /[ऀ-ॿ]/.test(text) ? "hi" : "en";
}

function pickBestVoice(
  voices: SpeechSynthesisVoice[],
  target: TargetLang
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const rank = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    let score = 0;
    if (target === "hi") {
      if (lang.startsWith("hi-in") || lang.startsWith("hi_in")) score += 200;
      else if (lang.startsWith("hi")) score += 150;
      else if (lang.startsWith("en-in")) score += 30;
      if (name.includes("google")) score += 100;
      if (
        name.includes("microsoft") &&
        (name.includes("neural") ||
          name.includes("madhur") ||
          name.includes("swara"))
      )
        score += 90;
      if (name.includes("lekha")) score += 80;
      if (name.includes("kiran")) score += 70;
      if (name.includes("natural")) score += 60;
    } else {
      if (lang.startsWith("en-in")) score += 100;
      else if (lang.startsWith("en-gb")) score += 40;
      else if (lang.startsWith("en-us")) score += 25;
      else if (lang.startsWith("en")) score += 10;
      if (name.includes("google")) score += 100;
      if (name.includes("microsoft") && name.includes("neural")) score += 90;
      if (name.includes("natural")) score += 80;
      if (
        name.includes("rishi") ||
        name.includes("veena") ||
        name.includes("ravi") ||
        name.includes("aditi")
      )
        score += 70;
      if (name.includes("samantha")) score += 40;
      if (name.includes("daniel")) score += 35;
    }
    if (!v.localService) score += 20;
    return score;
  };
  return [...voices].sort((a, b) => rank(b) - rank(a))[0];
}

export function cleanForSpeech(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{2300}-\u{23FF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
}

export function useVoiceOutput(enabled: boolean, rate = 1.0) {
  const [speaking, setSpeaking] = useState(false);
  const [backend, setBackend] = useState<"polly" | "browser" | "unknown">(
    "unknown"
  );
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const generationRef = useRef(0); // bumped on cancel to invalidate in-flight work

  useEffect(() => {
    fetch("/api/tts/status")
      .then((r) => r.json())
      .then((data: { available: boolean }) => {
        setBackend(data.available ? "polly" : "browser");
      })
      .catch(() => setBackend("browser"));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const playPollyChunk = useCallback(
    async (text: string, gen: number): Promise<boolean> => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return false;
        if (gen !== generationRef.current) return true; // cancelled
        const blob = await res.blob();
        if (gen !== generationRef.current) return true;
        const url = URL.createObjectURL(blob);
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.src = url;
        audio.playbackRate = rate;
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          audio.play().catch(() => resolve());
        });
        return true;
      } catch {
        return false;
      }
    },
    [rate]
  );

  const playBrowserChunk = useCallback(
    (text: string, gen: number): Promise<void> => {
      return new Promise<void>((resolve) => {
        if (!window.speechSynthesis || gen !== generationRef.current) {
          resolve();
          return;
        }
        const target = detectLang(text);
        const voice = pickBestVoice(voicesRef.current, target);
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = rate;
        utter.pitch = 1.0;
        utter.volume = 1.0;
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang;
        } else {
          utter.lang = target === "hi" ? "hi-IN" : "en-IN";
        }
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        window.speechSynthesis.speak(utter);
      });
    },
    [rate]
  );

  const pump = useCallback(async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    setSpeaking(true);

    while (queueRef.current.length > 0) {
      const gen = generationRef.current;
      const text = queueRef.current.shift()!;
      const cleaned = cleanForSpeech(text);
      if (!cleaned) continue;

      if (backend === "polly") {
        const ok = await playPollyChunk(cleaned, gen);
        if (!ok) {
          setBackend("browser");
          await playBrowserChunk(cleaned, gen);
        }
      } else {
        await playBrowserChunk(cleaned, gen);
      }

      if (gen !== generationRef.current) break; // cancelled mid-queue
    }

    playingRef.current = false;
    setSpeaking(false);
  }, [backend, playBrowserChunk, playPollyChunk]);

  /** Queue a chunk (sentence or short paragraph) for playback. */
  const enqueue = useCallback(
    (text: string) => {
      if (!enabled || !text.trim()) return;
      queueRef.current.push(text);
      pump();
    },
    [enabled, pump]
  );

  /** Speak the full text now (replaces any queued speech). */
  const speak = useCallback(
    (text: string) => {
      if (!enabled) return;
      // cancel anything in-flight
      generationRef.current += 1;
      queueRef.current = [];
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
      playingRef.current = false;
      queueRef.current.push(text);
      pump();
    },
    [enabled, pump]
  );

  const cancel = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    playingRef.current = false;
    setSpeaking(false);
  }, []);

  return { speak, enqueue, cancel, speaking, backend };
}
