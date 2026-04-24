import type {
  Case,
  ChatResponse,
  Customer,
  NewCustomerPayload,
  ToolCall,
} from "./types";
import { loadAuth } from "./auth";

function authHeader(): Record<string, string> {
  const a = loadAuth();
  return a ? { Authorization: `Bearer ${a.token}` } : {};
}

export type StreamEvent =
  | { type: "text"; chunk: string }
  | { type: "tool_start"; tool: string }
  | { type: "tool_result"; tool: string; input: Record<string, unknown>; output: string }
  | { type: "done"; reply: string; trace: ToolCall[] }
  | { type: "error"; message: string };

export interface StreamHandlers {
  onText: (chunk: string) => void;
  onToolStart?: (tool: string) => void;
  onToolResult?: (tool: string, input: Record<string, unknown>, output: string) => void;
  onDone: (reply: string, trace: ToolCall[]) => void;
  onError: (message: string) => void;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export interface AuthResponse {
  token: string;
  role: "customer" | "admin";
  customer_id: string | null;
  name: string | null;
}

export interface HealthResponse {
  status: string;
  model: string;
  region: string;
  memory: {
    configured: string;
    active: string;
    table?: string | null;
    region?: string | null;
  };
}

export const api = {
  health: () => req<HealthResponse>("/api/health"),

  requestOtp: (phone: string) =>
    req<{ success: boolean; masked_phone: string; demo_hint: string }>(
      "/api/auth/request-otp",
      { method: "POST", body: JSON.stringify({ phone }) }
    ),

  verifyOtp: (phone: string, otp: string) =>
    req<AuthResponse>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ phone, otp }),
    }),

  adminLogin: (email: string, password: string) =>
    req<AuthResponse>("/api/auth/admin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  listCustomers: () => req<Record<string, Customer>>("/api/customers"),

  createCustomer: (payload: NewCustomerPayload) =>
    req<Customer>("/api/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  customerCases: (id: string) => req<Case[]>(`/api/customers/${id}/cases`),

  customerMemory: (id: string) =>
    req<{
      customer_id: string;
      turns: { role: string; text: string; at?: string }[];
      facts: string[];
    }>(`/api/customers/${id}/memory`),

  resetMemory: (id: string) =>
    req<{ status: string }>(`/api/customers/${id}/memory/reset`, {
      method: "POST",
    }),

  chat: (customer_id: string, message: string) =>
    req<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({ customer_id, message }),
    }),

  chatStream: async (
    customer_id: string,
    message: string,
    handlers: StreamHandlers
  ): Promise<void> => {
    const res = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ customer_id, message }),
    });
    if (!res.ok || !res.body) {
      handlers.onError(`HTTP ${res.status}`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const json = line.slice(6);
        let evt: StreamEvent;
        try {
          evt = JSON.parse(json) as StreamEvent;
        } catch {
          continue;
        }
        switch (evt.type) {
          case "text":
            handlers.onText(evt.chunk);
            break;
          case "tool_start":
            handlers.onToolStart?.(evt.tool);
            break;
          case "tool_result":
            handlers.onToolResult?.(evt.tool, evt.input, evt.output);
            break;
          case "done":
            handlers.onDone(evt.reply, evt.trace);
            return;
          case "error":
            handlers.onError(evt.message);
            return;
        }
      }
    }
  },
};
