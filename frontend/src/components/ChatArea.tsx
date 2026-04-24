import { useEffect, useRef } from "react";
import type { ChatMessage, Customer } from "../types";
import { ToolTrace } from "./ToolTrace";

interface Props {
  customer: Customer;
  messages: ChatMessage[];
  thinking: boolean;
}

export function ChatArea({ customer, messages, thinking }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  return (
    <div className="flex-1 overflow-y-auto chat-scroll px-6 py-4">
      {messages.length === 0 && (
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 text-sm text-brand-900">
          👋 You're chatting as <strong>{customer.name}</strong>{" "}
          ({customer.gold_member ? "Gold member" : "Standard customer"}, {customer.city}).
          Try: <em>"My blu-cut coating is peeling"</em>,{" "}
          <em>"Where is my order?"</em>, or tap the 🎙️ mic button.
        </div>
      )}

      <div className="space-y-4 mt-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={m.role === "user" ? "max-w-[75%]" : "max-w-[85%]"}>
              <div
                className={
                  m.role === "user"
                    ? "bg-brand-500 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-soft"
                    : "bg-white text-brand-900 rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 shadow-soft"
                }
              >
                <div className="whitespace-pre-wrap leading-relaxed text-[15px]">
                  {m.content}
                </div>
                {m.role === "assistant" && m.trace && m.trace.length > 0 && (
                  <ToolTrace trace={m.trace} />
                )}
              </div>
            </div>
          </div>
        ))}

        {thinking && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 border border-slate-200 shadow-soft">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-brand-500 rounded-full animate-bounce" />
                </div>
                LensAssist is reasoning…
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>
    </div>
  );
}
