export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  summary?: string;
  summarizedMessageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AISettings {
  apiKey?: string;
  selectedModel?: string;
  maxResponseTokens: number;
}

export const CLAUDE_MODELS = [
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5', contextWindow: 200000 },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', contextWindow: 200000 },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4', contextWindow: 200000 },
];

export const DEFAULT_AI_SETTINGS: AISettings = { maxResponseTokens: 4096 };
