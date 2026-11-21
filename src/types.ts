export type MessageRole = "user" | "assistant" | "system";

export interface FileAttachment {
  name: string;
  type: string;
  url: string;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  files?: FileAttachment[];
}

export interface Chat {
  id: number;
  title: string;
  messages: ChatMessage[];
}

export interface ModelOption {
  id: string;
  label: string;
}

export type MessageBlock =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
