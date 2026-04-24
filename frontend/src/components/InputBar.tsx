import { useRef, useState } from "react";
import { useVoiceInput } from "../hooks/useVoiceInput";

interface Props {
  placeholder: string;
  disabled: boolean;
  lang: string;
  speaking: boolean;
  onStopSpeaking: () => void;
  onSubmit: (text: string) => void;
}

export function InputBar({
  placeholder,
  disabled,
  lang,
  speaking,
  onStopSpeaking,
  onSubmit,
}: Props) {
  const [text, setText] = useState("");
  const holdingRef = useRef(false);
  const { supported, listening, interim, start, stop } = useVoiceInput(lang);

  const send = (value?: string) => {
    const v = (value ?? text).trim();
    if (!v || disabled) return;
    onSubmit(v);
    setText("");
  };

  // Hold-to-speak: press + hold the mic, release to send.
  const beginHold = (e: React.PointerEvent) => {
    if (!supported || disabled) return;
    e.preventDefault();
    holdingRef.current = true;
    start((transcript) => {
      if (!holdingRef.current && transcript) {
        send(transcript);
      } else if (transcript) {
        setText((t) => (t ? t + " " : "") + transcript);
      }
    });
  };

  const endHold = (e: React.PointerEvent) => {
    if (!supported || !holdingRef.current) return;
    e.preventDefault();
    holdingRef.current = false;
    stop();
  };

  // Also allow a quick-tap toggle for users who prefer that.
  const togglePress = () => {
    if (!supported || disabled) return;
    if (listening) stop();
    else {
      holdingRef.current = false; // tap mode = don't auto-send
      start((transcript) => {
        if (transcript) setText((t) => (t ? t + " " : "") + transcript);
      });
    }
  };

  return (
    <div className="bg-white border-t border-slate-200 px-6 py-4 relative">
      {speaking && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={onStopSpeaking}
            className="flex items-center gap-2 bg-brand-900 text-white px-4 py-2 rounded-full shadow-pop hover:bg-brand-700 transition-colors text-sm font-semibold"
          >
            <span className="relative flex items-center justify-center w-4 h-4">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-300" />
            </span>
            Speaking… tap to stop (Esc)
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className={`flex items-center bg-slate-50 border-2 rounded-full pl-5 pr-2 py-1 transition-all ${
          listening
            ? "border-red-400 bg-red-50 shadow-[0_0_0_4px_rgba(239,68,68,0.08)]"
            : "border-slate-200 focus-within:border-brand-500 focus-within:bg-white"
        }`}
      >
        <input
          type="text"
          value={listening && interim ? `${text} ${interim}`.trim() : text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? "Listening…" : placeholder}
          disabled={disabled || listening}
          className="flex-1 bg-transparent outline-none text-[15px] text-brand-900 placeholder:text-slate-400 py-2"
        />

        {text && !listening && (
          <button
            type="submit"
            disabled={disabled}
            className="mr-1 text-brand-500 hover:text-brand-600 font-semibold px-3 py-2 rounded-full"
          >
            Send ↵
          </button>
        )}

        {supported && (
          <button
            type="button"
            onPointerDown={beginHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onClick={(e) => {
              // If the pointerdown/up never fired (e.g., keyboard activation), fall back to toggle.
              if (!holdingRef.current && !listening) {
                e.preventDefault();
                togglePress();
              }
            }}
            disabled={disabled}
            title={listening ? "Release to send" : "Hold to speak · tap to toggle"}
            className={`w-10 h-10 rounded-full grid place-items-center transition-all select-none ${
              listening
                ? "bg-red-500 text-white animate-pulse-mic"
                : "bg-brand-500 hover:bg-brand-600 text-white shadow-pop"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 0-2 0 3 3 0 0 1-6 0 1 1 0 1 0-2 0 5 5 0 0 0 4 4.9V19H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.1a5 5 0 0 0 4-4.9Z" />
            </svg>
          </button>
        )}
      </form>

      <div className="text-[11px] text-slate-400 mt-2 text-center">
        {listening
          ? `🔴 Listening… (${lang === "hi-IN" ? "हिन्दी" : "English"}) — release to send`
          : supported
            ? `💡 Hold the mic to speak in ${lang === "hi-IN" ? "हिन्दी" : "English"} · tap to toggle · Enter to send`
            : "Your browser doesn't support voice input — type to chat"}
      </div>
    </div>
  );
}
