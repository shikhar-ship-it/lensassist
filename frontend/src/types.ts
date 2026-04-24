export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  gold_member: boolean;
  lifetime_value: number;
  preferred_language: string;
  last_rx: { right_sph: string; left_sph: string; date: string };
}

export interface Case {
  case_id: string;
  customer_id: string;
  order_id: string;
  subject: string;
  status: "Open" | "Resolved" | "Escalated" | "Awaiting Customer" | string;
  priority: "High" | "Medium" | "Low" | string;
  created: string;
  last_update: string;
  channel: string;
  product: string;
  description: string;
  messages: { role: string; text: string; at?: string }[];
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  output: string;
}

export interface ChatResponse {
  reply: string;
  trace: ToolCall[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  trace?: ToolCall[];
}

export interface NewCustomerPayload {
  name: string;
  phone?: string;
  email?: string;
  city?: string;
  gold_member?: boolean;
  lifetime_value?: number;
  right_sph?: string;
  left_sph?: string;
}
