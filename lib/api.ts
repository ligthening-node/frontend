import type { Balances } from "@/lib/types/Balances";
import type { ChannelView } from "@/lib/types/ChannelView";
import type { CreatedInvoice } from "@/lib/types/CreatedInvoice";
import type { NodeStatus } from "@/lib/types/NodeStatus";
import type { PaymentView } from "@/lib/types/PaymentView";
import type { PeerView } from "@/lib/types/PeerView";
import type { SentPayment } from "@/lib/types/SentPayment";
import type { ValidationReport } from "@/lib/types/ValidationReport";

// === Errors

export class ApiError extends Error {
  readonly code: string;
  /** For `payment_refused`: the decoder's full report on the invoice. */
  readonly report: ValidationReport | null;

  constructor(code: string, message: string, report: ValidationReport | null = null) {
    super(message);
    this.code = code;
    this.report = report;
  }
}

interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const inner = (value as { error: unknown }).error;
  return typeof inner === "object" && inner !== null && "code" in inner && "message" in inner;
}

function isReport(value: unknown): value is ValidationReport {
  return typeof value === "object" && value !== null && "verdict" in value && "checks" in value;
}

export function toApiError(err: unknown): ApiError {
  return err instanceof ApiError ? err : new ApiError("unknown", "Unexpected error.");
}

async function request<T>(path: string, method: "GET" | "POST", body?: object): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("network", "Could not reach the web server.");
  }
  const parsed: unknown = await response.json().catch((): unknown => null);
  if (!response.ok) {
    if (isErrorEnvelope(parsed)) {
      const report = isReport(parsed.error.details) ? parsed.error.details : null;
      throw new ApiError(parsed.error.code, parsed.error.message, report);
    }
    throw new ApiError("unknown", `Request failed with status ${response.status}.`);
  }
  return parsed as T;
}

// === Node and wallet

export function getNodeStatus(): Promise<NodeStatus> {
  return request<NodeStatus>("node/status", "GET");
}

export async function syncNode(): Promise<void> {
  await request<{ ok: boolean }>("node/sync", "POST");
}

export function getBalances(): Promise<Balances> {
  return request<Balances>("wallet/balance", "GET");
}

export async function createAddress(): Promise<string> {
  const { address } = await request<{ address: string }>("wallet/address", "POST");
  return address;
}

export async function sendOnchain(address: string, amountSat: string): Promise<string> {
  const { txid } = await request<{ txid: string }>("wallet/send", "POST", { address, amount_sat: amountSat });
  return txid;
}

// === Peers and channels

/** Node id to name, for the nodes this setup runs. Empty when none are known. */
export function getNodeLabels(): Promise<Record<string, string>> {
  return request<Record<string, string>>("node-labels", "GET");
}

export function getPeers(): Promise<PeerView[]> {
  return request<PeerView[]>("peers", "GET");
}

export async function connectPeer(nodeId: string, address: string): Promise<void> {
  await request<{ ok: boolean }>("peers", "POST", { node_id: nodeId, address });
}

export async function disconnectPeer(nodeId: string): Promise<void> {
  await request<{ ok: boolean }>("peers/disconnect", "POST", { node_id: nodeId });
}

export function getChannels(): Promise<ChannelView[]> {
  return request<ChannelView[]>("channels", "GET");
}

export interface OpenChannelInput {
  nodeId: string;
  address: string;
  amountSat: string;
  pushMsat: string;
}

export async function openChannel(input: OpenChannelInput): Promise<string> {
  const { user_channel_id } = await request<{ user_channel_id: string }>("channels", "POST", {
    node_id: input.nodeId,
    address: input.address,
    amount_sat: input.amountSat,
    push_msat: input.pushMsat === "" ? null : input.pushMsat,
  });
  return user_channel_id;
}

export async function closeChannel(channel: ChannelView, force: boolean): Promise<void> {
  await request<{ ok: boolean }>("channels/close", "POST", {
    user_channel_id: channel.user_channel_id,
    counterparty_node_id: channel.counterparty_node_id,
    force,
  });
}

// === Invoices and payments

export interface InvoiceInput {
  amountMsat: string | null;
  description: string;
  expirySecs: number;
}

export function createInvoice(input: InvoiceInput): Promise<CreatedInvoice> {
  return request<CreatedInvoice>("invoices", "POST", {
    amount_msat: input.amountMsat,
    description: input.description,
    expiry_secs: input.expirySecs,
  });
}

export interface PayInput {
  invoice: string;
  amountMsat: string | null;
  expectedPayee: string | null;
}

export function payInvoice(input: PayInput): Promise<SentPayment> {
  return request<SentPayment>("payments", "POST", {
    invoice: input.invoice,
    amount_msat: input.amountMsat,
    expected_payee: input.expectedPayee,
  });
}

export function getPayments(): Promise<PaymentView[]> {
  return request<PaymentView[]>("payments", "GET");
}
