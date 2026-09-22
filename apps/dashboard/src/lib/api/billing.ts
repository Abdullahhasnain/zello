import "server-only";
import type { CommissionLedgerEntry, Invoice, Subscription } from "@zello-ai/types";
import { apiFetch } from "@/lib/api-client";

export async function getSubscription(): Promise<Subscription | null> {
  return apiFetch<Subscription | null>("/billing/subscription");
}

export async function listPendingCommission(): Promise<CommissionLedgerEntry[]> {
  return apiFetch<CommissionLedgerEntry[]>("/billing/commission");
}

export async function listInvoices(): Promise<Invoice[]> {
  return apiFetch<Invoice[]>("/billing/invoices");
}
