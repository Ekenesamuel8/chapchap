import { apiRequest } from "@/lib/api/client";
import {
  ConfidentialHistoryItem,
  ConfidentialParsePayload,
  ConfidentialProofResponse,
  ConfidentialSavingsPosition,
  ConfidentialSavingsWithdrawResponse,
  ConfidentialTxRecordResponse,
} from "@/lib/types";

export function parseConfidentialPrompt(message: string, token?: string | null) {
  return apiRequest<ConfidentialParsePayload>("/api/confidential/parse/", {
    method: "POST",
    body: { message },
    token,
  });
}

export function fetchConfidentialHistory(token?: string | null) {
  return apiRequest<ConfidentialHistoryItem[]>("/api/confidential/history/", {
    method: "GET",
    token,
  });
}

export function fetchConfidentialSavings(token?: string | null) {
  return apiRequest<ConfidentialSavingsPosition[]>("/api/confidential/savings/", {
    method: "GET",
    token,
  });
}

export function submitAgreementProof(
  agreementId: number,
  proofText: string,
  proofLink?: string,
  token?: string | null,
) {
  return apiRequest<ConfidentialProofResponse>(
    `/api/confidential/agreements/${agreementId}/proof/`,
    {
      method: "POST",
      body: {
        proof_text: proofText,
        proof_link: proofLink || undefined,
      },
      token,
    },
  );
}

export function recordConfidentialTx(
  actionId: number,
  input: {
    tx_hash: string;
    status: string;
    contract_address?: string | null;
    intent?: string;
  },
  token?: string | null,
) {
  return apiRequest<ConfidentialTxRecordResponse>(
    `/api/confidential/actions/${actionId}/tx/`,
    {
      method: "POST",
      body: input,
      token,
    },
  );
}

export function requestSavingsWithdrawal(
  savingsId: number,
  input?: {
    withdraw_tx_hash?: string;
  },
  token?: string | null,
) {
  return apiRequest<ConfidentialSavingsWithdrawResponse>(
    `/api/confidential/savings/${savingsId}/withdraw/`,
    {
      method: "POST",
      body: input ?? {},
      token,
    },
  );
}
