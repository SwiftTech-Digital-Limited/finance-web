"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CircleDot, FolderInput, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import type { Account, Bucket, FinancialEvent, Transaction } from "@/lib/api/types";
import { MoneyAmount, ArchivedBadge } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

export function refName(value: unknown, fallback = "Unavailable") {
  if (value && typeof value === "object") {
    const ref = value as { name?: string; label?: string };
    return ref.name || ref.label || fallback;
  }
  return fallback;
}

export function AccountCard({ account }: { account: Account }) {
  return (
    <Link className="account-card" href={`/accounts/${account._id}`}>
      <div className="resource-card-top"><span className="account-symbol">{account.name.slice(0, 2).toUpperCase()}</span>{account.isArchived && <ArchivedBadge />}</div>
      <div><p className="resource-kicker">{account.institutionName || account.type}</p><h3>{account.name}</h3></div>
      <div className="resource-balance"><span>Physical balance</span><MoneyAmount value={account.currentBalanceMinor ?? account.openingBalanceMinor ?? 0} currency={account.currency} /></div>
    </Link>
  );
}

export function BucketCard({ bucket }: { bucket: Bucket }) {
  const balance = bucket.availableBalanceMinor ?? bucket.currentBalanceMinor ?? 0;
  return (
    <Link className="bucket-card" href={`/buckets/${bucket._id}`}>
      <div className="resource-card-top"><span className={cn("bucket-symbol", `bucket-${bucket.type || "custom"}`)}><CircleDot /></span>{bucket.isArchived && <ArchivedBadge />}</div>
      <div><p className="resource-kicker">{bucket.type || "Purpose"}</p><h3>{bucket.name}</h3></div>
      <div className="resource-balance"><span>Available</span><MoneyAmount value={balance} /></div>
    </Link>
  );
}

export function TransactionRow({ event, linked = true }: { event: FinancialEvent | Transaction; linked?: boolean }) {
  const reallocation = event.eventKind === "reallocation" || Boolean(event.reallocation);
  const transfer = event.displayType === "transfer" || event.type === "transfer" || event.type === "transfer_out" || event.type === "transfer_in";
  const expense = event.type === "expense";
  const income = event.type === "income";
  const title = reallocation
    ? "Bucket reallocation"
    : transfer
      ? `${refName(event.account || event.accountId, "Account")} to ${refName(event.counterpartAccount, "Account")}`
      : event.description || (income ? refName(event.incomeSource || event.incomeSourceId, "Income") : expense ? refName(event.category || event.categoryId, "Expense") : "Adjustment");
  const subtitle = reallocation
    ? "Purpose changed; physical money stayed put"
    : transfer
      ? "Account transfer - not spending"
      : income
        ? `Into ${refName(event.account || event.accountId, "account")}`
        : expense
          ? `From ${refName(event.bucket || event.bucketId, "bucket")}`
          : event.status || "Posted";
  const date = event.transactionDate || event.createdAt || event.reallocation?.date || event.reallocation?.createdAt;
  const amount = event.amountMinor ?? event.reallocation?.amountMinor ?? 0;
  const Icon = reallocation ? FolderInput : transfer ? ArrowLeftRight : income ? ArrowDownLeft : expense ? ArrowUpRight : RotateCcw;
  const body = (
    <div className={cn("transaction-row", event.status === "void" && "void-row")}>
      <span className={cn("activity-icon", reallocation ? "purpose" : transfer ? "transfer" : income ? "income" : expense ? "expense" : "neutral")}><Icon /></span>
      <span className="transaction-main"><b>{title}</b><small>{subtitle}{date ? ` · ${format(new Date(date), "d MMM yyyy")}` : ""}</small></span>
      <span className={cn("transaction-amount", income && "positive", expense && "negative")}><MoneyAmount value={amount} /></span>
      {event.status === "void" && <span className="void-badge">Void</span>}
    </div>
  );
  return linked && event._id ? <Link href={`/transactions/${event._id}`}>{body}</Link> : body;
}

export function AllocationBreakdown({ preview }: { preview: { amountMinor: number; matchedRule?: { name?: string } | null; matchReason?: string; fixedAllocations: { bucketId: unknown; bucketName?: string; amountMinor?: number }[]; percentageAllocations: { bucketId: unknown; bucketName?: string; amountMinor?: number; percentageBps?: number }[]; distributableAmountMinor: number; totalAllocatedMinor: number; unallocatedAmountMinor: number; warnings?: string[] } }) {
  return (
    <section className="allocation-breakdown">
      <header><div><p className="eyebrow">Server preview</p><h3>{preview.matchedRule?.name || "No allocation rule matched"}</h3><p>{preview.matchReason || "This income will remain unallocated until you assign it."}</p></div><MoneyAmount value={preview.amountMinor} /></header>
      {preview.fixedAllocations.length > 0 && <div className="allocation-group"><p>First, set aside</p>{preview.fixedAllocations.map((item, index) => <div key={index}><span>{item.bucketName || refName(item.bucketId, "Bucket")} <small>fixed</small></span><MoneyAmount value={item.amountMinor || 0} /></div>)}</div>}
      {preview.percentageAllocations.length > 0 && <div className="allocation-group"><p>Then divide the remaining <MoneyAmount value={preview.distributableAmountMinor} /></p>{preview.percentageAllocations.map((item, index) => <div key={index}><span>{item.bucketName || refName(item.bucketId, "Bucket")} <small>{(item.percentageBps || 0) / 100}%</small></span><MoneyAmount value={item.amountMinor || 0} /></div>)}</div>}
      <footer><div><span>Assigned</span><MoneyAmount value={preview.totalAllocatedMinor} /></div><div><span>Unallocated</span><MoneyAmount value={preview.unallocatedAmountMinor} /></div></footer>
      {preview.warnings?.map((warning) => <p className="preview-warning" key={warning}>{warning}</p>)}
    </section>
  );
}
