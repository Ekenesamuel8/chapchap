import { apiRequest } from "@/lib/api/client";
import {
  AgentChatResponse,
  ExecuteResponse,
  ParseResponse,
  PaymentSubmissionResponse,
  SourceType,
} from "@/lib/types";

export function chatWithAgent(message: string, token?: string | null) {
  return apiRequest<AgentChatResponse>("/api/agent/chat/", {
    method: "POST",
    body: { message },
    token,
  });
}

export function parsePrompt(prompt: string, sourceType: SourceType, token?: string | null) {
  return apiRequest<ParseResponse>("/api/agent/parse/", {
    method: "POST",
    body: {
      prompt,
      source_type: sourceType,
    },
    token,
  });
}

export function executeParsedIntent(parsedIntentId: number, token?: string | null) {
  return apiRequest<ExecuteResponse>("/api/agent/execute/", {
    method: "POST",
    body: {
      parsed_intent_id: parsedIntentId,
    },
    token,
  });
}

export function submitPaymentIntent(paymentIntentId: number, token?: string | null) {
  return apiRequest<PaymentSubmissionResponse>(`/api/payments/${paymentIntentId}/submit/`, {
    method: "POST",
    body: {},
    token,
  });
}
