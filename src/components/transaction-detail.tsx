"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CircleDollarSign, GitBranch, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { financeApi, listResource, queryKeys } from "@/lib/api";
import type { Allocation, RuleAllocation } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { createIdempotencyKey } from "@/lib/idempotency";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { refName, TransactionRow } from "@/components/financial";
import { ArchivedBadge, ErrorState, Field, LoadingBlock, Modal, MoneyAmount, PageHeader } from "@/components/ui-kit";

export function TransactionDetail({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const [voidOpen, setVoidOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [assignments, setAssignments] = useState([{ bucketId: "", amount: "" }]);
  const voidKey = useRef<string | null>(null); const assignKey = useRef<string | null>(null);
  const transactionQuery = useQuery({ queryKey: queryKeys.detail("transaction", id), queryFn: () => financeApi.transaction(id) });
  const transaction = transactionQuery.data;
  const lineageQuery = useQuery({ queryKey: queryKeys.detail("lineage", id), queryFn: () => financeApi.lineage(id), enabled: transaction?.type === "income" });
  const bucketsQuery = useQuery({ queryKey: queryKeys.resource("buckets", { limit: 100 }), queryFn: () => listResource("buckets", { limit: 100 }), enabled: assignOpen });
  const voidMutation = useMutation({
    mutationFn: () => financeApi.voidTransaction(id, reason.trim(), voidKey.current ?? (voidKey.current = createIdempotencyKey())),
    onSuccess: async () => { setVoidOpen(false); voidKey.current = null; await queryClient.invalidateQueries({ queryKey: queryKeys.all }); },
  });
  const assignMutation = useMutation({
    mutationFn: async () => {
      const parsed = assignments.map((item) => {
        const money = parseMoneyInput(item.amount);
        if (!item.bucketId || !money.ok) throw new Error("Complete every assignment.");
        return { bucketId: item.bucketId, amountMinor: money.amountMinor };
      });
      if (new Set(parsed.map((item) => item.bucketId)).size !== parsed.length) throw new Error("Choose each bucket only once.");
      return financeApi.assignIncome(id, parsed, assignKey.current ?? (assignKey.current = createIdempotencyKey()));
    },
    onSuccess: async () => { setAssignOpen(false); assignKey.current = null; await queryClient.invalidateQueries({ queryKey: queryKeys.all }); },
  });
  if (transactionQuery.isLoading) return <><PageHeader title="Transaction details" /><LoadingBlock rows={5} /></>;
  if (transactionQuery.error || !transaction) return <ErrorState error={errorMessage(transactionQuery.error)} retry={() => void transactionQuery.refetch()} />;
  const transfer = transaction.displayType === "transfer" || transaction.type.startsWith("transfer");
  const unallocated = lineageQuery.data?.unallocatedAmountMinor || 0;
  return (
    <>
      <Link className="back-link" href="/transactions"><ArrowLeft />Back to activity</Link>
      <PageHeader eyebrow={transaction.status === "void" ? "Voided transaction" : transfer ? "Account movement" : transaction.type} title={transaction.description || (transfer ? "Money transfer" : transaction.type === "income" ? "Income" : transaction.type === "expense" ? "Expense" : "Adjustment")} description={transfer ? "This moved physical money between accounts and did not count as income or spending." : undefined} action={<div className="detail-actions">{transaction.type === "income" && <Link className="button-secondary" href={`/transactions/${id}/lineage`}><GitBranch />View lineage</Link>}{transaction.type === "income" && unallocated > 0 && transaction.status !== "void" && <button className="button-primary" onClick={() => setAssignOpen(true)}>Assign money</button>}{transaction.status !== "void" && <button className="button-danger-outline" onClick={() => setVoidOpen(true)}>Void transaction</button>}</div>} />
      <div className="detail-grid">
        <section className="detail-card transaction-detail-card">
          <TransactionRow event={transaction} linked={false} />
          <dl>
            <Detail label="Amount"><MoneyAmount value={transaction.amountMinor} /></Detail>
            <Detail label="Date">{transaction.transactionDate ? format(new Date(transaction.transactionDate), "d MMMM yyyy, h:mm a") : "Not provided"}</Detail>
            <Detail label={transfer ? "From account" : "Account"}>{refName(transaction.account || transaction.accountId)}{isArchived(transaction.account || transaction.accountId) && <ArchivedBadge />}</Detail>
            {transfer && <Detail label="To account">{refName(transaction.counterpartAccount)}{transaction.counterpartAccount?.isArchived && <ArchivedBadge />}</Detail>}
            {transaction.incomeSourceId && <Detail label="Income source">{refName(transaction.incomeSource || transaction.incomeSourceId)}</Detail>}
            {transaction.categoryId && <Detail label="Category">{refName(transaction.category || transaction.categoryId)}</Detail>}
            {transaction.bucketId && <Detail label="Bucket">{refName(transaction.bucket || transaction.bucketId)}</Detail>}
            {transaction.status === "void" && <><Detail label="Voided on">{transaction.voidedAt ? format(new Date(transaction.voidedAt), "d MMMM yyyy") : "Voided"}</Detail><Detail label="Reason">{transaction.voidReason || "No reason available"}</Detail></>}
          </dl>
        </section>
        <aside className="detail-side">
          {transaction.bucketSplits?.length ? <section className="detail-card"><h2>Bucket impact</h2>{transaction.bucketSplits.map((split, index) => <div className="impact-row" key={index}><span>{refName(split.bucketId, "Bucket")}</span><MoneyAmount value={split.amountMinor} /></div>)}</section> : null}
          {transaction.type === "income" && <section className="detail-card"><h2>Allocation status</h2>{lineageQuery.isLoading ? <LoadingBlock rows={2} /> : <><div className="impact-row"><span>Assigned</span><MoneyAmount value={lineageQuery.data?.allocatedTotalMinor || 0} /></div><div className="impact-row warning"><span>Unallocated</span><MoneyAmount value={unallocated} /></div>{transaction.allocationRuleSnapshot?.name && <p className="snapshot-note">Rule snapshot: <b>{transaction.allocationRuleSnapshot.name}</b></p>}</>}</section>}
        </aside>
      </div>
      <Modal open={voidOpen} title="Void transaction?" description={transaction.type === "income" ? "The physical income and its allocations will stop contributing to current balances. The server will block this if later bucket activity depends on it." : transfer ? "Both linked transfer legs will be voided together." : "The account and all bucket effects will be reversed while preserving the record."} onClose={() => setVoidOpen(false)}><form onSubmit={(event) => { event.preventDefault(); if (reason.trim()) voidMutation.mutate(); }}><div className="warning-callout"><ShieldAlert /><p>This is not deletion. The event remains visible in history as void.</p></div><Field label="Reason" hint="Required"><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this being voided?" /></Field>{voidMutation.error && <p className="form-error-box">{errorMessage(voidMutation.error)}</p>}<button className="button-danger submit-button" disabled={!reason.trim() || voidMutation.isPending}>{voidMutation.isPending ? "Voiding..." : "Void transaction"}</button></form></Modal>
      <Modal open={assignOpen} title="Assign this income" description={`${formatMoney(unallocated)} remains unallocated. Assign purpose without moving the receiving account money.`} onClose={() => setAssignOpen(false)}>{assignments.map((item, index) => <div className="assignment-row" key={index}><select value={item.bucketId} onChange={(event) => setAssignments((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, bucketId: event.target.value } : value))}><option value="">Choose bucket</option>{bucketsQuery.data?.items.map((bucket) => <option value={bucket._id} key={bucket._id}>{bucket.name}</option>)}</select><input inputMode="decimal" placeholder="Amount" value={item.amount} onChange={(event) => setAssignments((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, amount: event.target.value } : value))} /><button disabled={assignments.length === 1} onClick={() => setAssignments((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove assignment"><Trash2 /></button></div>)}<button className="add-split" onClick={() => setAssignments((items) => [...items, { bucketId: "", amount: "" }])}><Plus />Add bucket</button>{assignMutation.error && <p className="form-error-box">{errorMessage(assignMutation.error)}</p>}<button className="button-primary submit-button" disabled={assignMutation.isPending} onClick={() => assignMutation.mutate()}>{assignMutation.isPending ? "Assigning..." : "Assign money"}</button></Modal>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt>{label}</dt><dd>{children}</dd></div>; }
function isArchived(value: unknown) { return Boolean(value && typeof value === "object" && (value as { isArchived?: boolean }).isArchived); }

export function IncomeLineage({ id }: { id: string }) {
  const query = useQuery({ queryKey: queryKeys.detail("lineage", id), queryFn: () => financeApi.lineage(id) });
  if (query.isLoading) return <><PageHeader title="Income lineage" /><LoadingBlock rows={4} /></>;
  if (query.error || !query.data) return <ErrorState error={errorMessage(query.error)} />;
  const data = query.data; const transaction = data.incomeTransaction || data.transaction;
  const snapshot = data.allocationRuleSnapshot || transaction?.allocationRuleSnapshot;
  return <><Link className="back-link" href={`/transactions/${id}`}><ArrowLeft />Back to income</Link><PageHeader eyebrow="Income lineage" title="Where this income went" description="This uses the immutable rule snapshot and recorded allocations, so later rule changes cannot rewrite history." /><section className="lineage-tree"><div className="lineage-root"><span><CircleDollarSign /></span><div><b><MoneyAmount value={transaction?.amountMinor || 0} /> {refName(transaction?.incomeSource || transaction?.incomeSourceId, "Income")}</b><small>Received into {refName(transaction?.account || transaction?.accountId, "account")}</small></div></div><div className="lineage-rule"><div><span><GitBranch /></span><div><b>{snapshot?.name || "Manual assignment"}</b><small>{snapshot?.name ? "Rule snapshot at posting" : "No rule matched when posted"}</small></div></div><ul>{data.allocations.map((allocation, index) => <LineageAllocation allocation={allocation} snapshot={snapshot} index={index} key={allocation._id || index} />)}</ul></div><footer><span>Assigned <b>{formatMoney(data.allocatedTotalMinor)}</b></span><span>Unallocated <b>{formatMoney(data.unallocatedAmountMinor)}</b></span></footer></section></>;
}
function LineageAllocation({ allocation, snapshot, index }: { allocation: Allocation; snapshot?: { fixedAllocations?: RuleAllocation[]; percentageAllocations?: RuleAllocation[] }; index: number }) {
  const snapshotItem = [...(snapshot?.fixedAllocations || []), ...(snapshot?.percentageAllocations || [])].find((item) => typeof item.bucketId === "string" ? item.bucketId === (typeof allocation.bucketId === "string" ? allocation.bucketId : allocation.bucketId._id) : item.bucketId._id === (typeof allocation.bucketId === "string" ? allocation.bucketId : allocation.bucketId._id));
  return <li><span>{index + 1}</span><div><b>{refName(allocation.bucketId, "Bucket")}</b><small>{allocation.allocationType}{allocation.percentageBps || snapshotItem?.percentageBps ? ` · ${(allocation.percentageBps || snapshotItem?.percentageBps || 0) / 100}%` : ""}</small></div><MoneyAmount value={allocation.amountMinor} /></li>;
}
