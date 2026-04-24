import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import type {
  Case,
  ChatMessage,
  Customer,
  NewCustomerPayload,
  ToolCall,
} from "./types";
import { Banner } from "./components/Banner";
import { MetricsStrip } from "./components/MetricsStrip";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { InputBar } from "./components/InputBar";
import { Login } from "./components/Login";
import { useVoiceOutput } from "./hooks/useVoiceOutput";
import { clearAuth, loadAuth, saveAuth, type AuthState } from "./auth";

export default function App() {
  const [auth, setAuthState] = useState<AuthState | null>(() => loadAuth());
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [selectedId, setSelectedId] = useState<string>("");
  const [cases, setCases] = useState<Case[]>([]);
  const [messagesByCustomer, setMessagesByCustomer] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [thinking, setThinking] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [inputLang, setInputLang] = useState("en-IN");
  const [error, setError] = useState<string | null>(null);
  const [memoryInfo, setMemoryInfo] = useState<{
    active: string;
    table?: string | null;
  } | null>(null);

  const {
    speak,
    enqueue: enqueueSpeech,
    cancel: cancelSpeech,
    speaking,
    backend: voiceBackend,
  } = useVoiceOutput(voiceOut, voiceRate);
  // keep the unused-when-streaming `speak` ref to avoid linter complaints
  void speak;

  // ESC to stop speech
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && speaking) cancelSpeech();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speaking, cancelSpeech]);

  useEffect(() => {
    if (!auth) return;
    api
      .listCustomers()
      .then((data) => {
        setCustomers(data);
        // Customer users are locked to their own id; admins pick from dropdown
        if (auth.role === "customer" && auth.customer_id) {
          setSelectedId(auth.customer_id);
        } else {
          const first = Object.keys(data)[0];
          if (first) setSelectedId(first);
        }
      })
      .catch((e) => setError(String(e)));
    api
      .health()
      .then((h) => setMemoryInfo({ active: h.memory.active, table: h.memory.table }))
      .catch(() => {});
  }, [auth]);

  const handleLogin = useCallback((state: AuthState) => {
    saveAuth(state);
    setAuthState(state);
  }, []);

  const handleLogout = useCallback(() => {
    cancelSpeech();
    clearAuth();
    setAuthState(null);
    setCustomers({});
    setSelectedId("");
    setMessagesByCustomer({});
    setCases([]);
  }, [cancelSpeech]);

  useEffect(() => {
    if (!selectedId) return;
    api
      .customerCases(selectedId)
      .then(setCases)
      .catch((e) => setError(String(e)));
  }, [selectedId]);

  const handleSelect = useCallback((id: string) => {
    cancelSpeech();
    setSelectedId(id);
  }, [cancelSpeech]);

  const handleCreate = useCallback(async (payload: NewCustomerPayload) => {
    const created = await api.createCustomer(payload);
    setCustomers((prev) => ({ ...prev, [created.customer_id]: created }));
    setSelectedId(created.customer_id);
  }, []);

  const handleResetMemory = useCallback(async () => {
    if (!selectedId) return;
    cancelSpeech();
    await api.resetMemory(selectedId);
    setMessagesByCustomer((prev) => ({ ...prev, [selectedId]: [] }));
  }, [selectedId, cancelSpeech]);

  const handleSubmit = useCallback(
    async (text: string) => {
      if (!selectedId || !text.trim()) return;
      cancelSpeech();
      const userMsg: ChatMessage = { role: "user", content: text };
      const placeholder: ChatMessage = { role: "assistant", content: "", trace: [] };
      setMessagesByCustomer((prev) => ({
        ...prev,
        [selectedId]: [...(prev[selectedId] ?? []), userMsg, placeholder],
      }));
      setThinking(true);

      let streamed = "";
      let speechBuffer = "";
      const trace: ToolCall[] = [];

      // Flush speech on sentence boundaries (., !, ?, ।). 30-char minimum
      // keeps tiny fragments like "OK." from becoming their own utterances.
      const flushSentences = (isFinal: boolean) => {
        while (true) {
          const match = speechBuffer.match(/^([\s\S]*?[.!?।])(\s+|$)/);
          if (!match) break;
          const sentence = match[1].trim();
          speechBuffer = speechBuffer.slice(match[0].length);
          if (sentence.length >= 8) {
            enqueueSpeech(sentence);
          }
        }
        if (isFinal && speechBuffer.trim().length > 0) {
          enqueueSpeech(speechBuffer.trim());
          speechBuffer = "";
        }
      };

      const updateLastMessage = (updater: (m: ChatMessage) => ChatMessage) => {
        setMessagesByCustomer((prev) => {
          const list = [...(prev[selectedId] ?? [])];
          if (list.length === 0) return prev;
          list[list.length - 1] = updater(list[list.length - 1]);
          return { ...prev, [selectedId]: list };
        });
      };

      try {
        await api.chatStream(selectedId, text, {
          onText: (chunk) => {
            streamed += chunk;
            speechBuffer += chunk;
            updateLastMessage((m) => ({ ...m, content: streamed }));
            flushSentences(false);
          },
          onToolResult: (tool, input, output) => {
            trace.push({ tool, input, output });
            updateLastMessage((m) => ({ ...m, trace: [...trace] }));
          },
          onDone: (reply, finalTrace) => {
            flushSentences(true);
            updateLastMessage(() => ({
              role: "assistant",
              content: reply || streamed,
              trace: finalTrace.length ? finalTrace : trace,
            }));
            api.customerCases(selectedId).then(setCases).catch(() => {});
          },
          onError: (msg) => {
            setError(msg);
          },
        });
      } catch (e) {
        setError(String(e));
      } finally {
        setThinking(false);
      }
    },
    [selectedId, cancelSpeech, enqueueSpeech]
  );

  if (!auth) {
    return <Login onLogin={handleLogin} />;
  }

  const selected = customers[selectedId];
  const messages = messagesByCustomer[selectedId] ?? [];

  return (
    <div className="h-screen flex flex-col">
      <div className="px-6 pt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1"><Banner /></div>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-soft">
            <div className="text-right">
              <div className="text-xs text-slate-500">Signed in as</div>
              <div className="text-sm font-semibold text-brand-900">
                {auth.name ?? auth.customer_id}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-brand-500">
                {auth.role === "admin" ? "CX Admin" : "Customer"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg px-3 py-2 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        <MetricsStrip />
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
            {error}{" "}
            <button
              className="underline ml-2"
              onClick={() => setError(null)}
            >
              dismiss
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex mt-4 overflow-hidden border-t border-slate-200">
        <Sidebar
          customers={customers}
          selectedId={selectedId}
          cases={cases}
          voiceOut={voiceOut}
          voiceRate={voiceRate}
          inputLang={inputLang}
          voiceBackend={voiceBackend}
          memoryInfo={memoryInfo}
          isAdmin={auth.role === "admin"}
          onSelect={handleSelect}
          onCreate={handleCreate}
          onResetMemory={handleResetMemory}
          onVoiceOutChange={setVoiceOut}
          onVoiceRateChange={setVoiceRate}
          onInputLangChange={setInputLang}
        />

        <main className="flex-1 flex flex-col bg-slate-50">
          {selected ? (
            <>
              <ChatArea
                customer={selected}
                messages={messages}
                thinking={thinking}
              />
              <InputBar
                placeholder={`Type a message as ${selected.name}…`}
                disabled={thinking}
                lang={inputLang}
                speaking={speaking}
                onStopSpeaking={cancelSpeech}
                onSubmit={handleSubmit}
              />
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-slate-400">
              Loading customers…
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
