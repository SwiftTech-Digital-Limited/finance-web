"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Archive, Beaker, Edit3, Plus, Power, Trash2 } from "lucide-react";
import { archiveResource, createResource, financeApi, getResource, listResource, queryKeys, updateResource } from "@/lib/api";
import type { AllocationPreview, AllocationRule, Bucket, IncomeSource, RuleAllocation } from "@/lib/api/types";
import { errorMessage } from "@/lib/errors";
import { formatMoney, parseMoneyInput } from "@/lib/money";
import { formatPercentage, parsePercentageInput } from "@/lib/percentage";
import { AllocationBreakdown, refName } from "@/components/financial";
import { ArchivedBadge, EmptyState, ErrorState, Field, LoadingBlock, Modal, PageHeader } from "@/components/ui-kit";

type RuleFormState = {
  name: string; description: string; sourceId: string; condition: "any" | "more" | "less" | "between";
  minimum: string; maximum: string; priority: string; isDefault: boolean; isActive: boolean;
  fixed: { bucketId: string; amount: string }[]; percentages: { bucketId: string; percentage: string }[];
};
const blankRule: RuleFormState = { name: "", description: "", sourceId: "", condition: "any", minimum: "", maximum: "", priority: "0", isDefault: false, isActive: true, fixed: [], percentages: [{ bucketId: "", percentage: "" }] };

export function RulesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AllocationRule | "new" | null>(null);
  const [testing, setTesting] = useState<AllocationRule | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<AllocationRule | null>(null);
  const results = useQueries({ queries: [
    { queryKey: queryKeys.resource("allocation-rules", { limit: 100, includeArchived: true }), queryFn: () => listResource("allocation-rules", { limit: 100, includeArchived: true }) },
    { queryKey: queryKeys.resource("buckets", { limit: 100 }), queryFn: () => listResource("buckets", { limit: 100 }) },
    { queryKey: queryKeys.resource("income-sources", { limit: 100 }), queryFn: () => listResource("income-sources", { limit: 100 }) },
  ] });
  const rules = results[0].data?.items as AllocationRule[] | undefined;
  const buckets = (results[1].data?.items || []) as Bucket[];
  const sources = (results[2].data?.items || []) as IncomeSource[];
  const mutate = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: unknown }) => id ? updateResource("allocation-rules", id, payload) : createResource("allocation-rules", payload),
    onSuccess: async () => { setEditing(null); await queryClient.invalidateQueries({ queryKey: ["finance", "allocation-rules"] }); },
  });
  const toggle = useMutation({
    mutationFn: (rule: AllocationRule) => updateResource("allocation-rules", rule._id, { isActive: !rule.isActive }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["finance", "allocation-rules"] }); },
  });
  const archive = useMutation({
    mutationFn: (id: string) => archiveResource("allocation-rules", id),
    onSuccess: async () => { setArchiveTarget(null); await queryClient.invalidateQueries({ queryKey: ["finance", "allocation-rules"] }); },
  });
  const loading = results.some((result) => result.isLoading);
  const loadError = results.find((result) => result.error)?.error;
  return (
    <>
      <PageHeader eyebrow="Planning" title="Allocation rules" description="Teach the app what should happen when different kinds of income arrive. The server chooses, calculates, rounds, and confirms every allocation." action={<button className="button-primary" onClick={() => setEditing("new")}><Plus />Create rule</button>} />
      {loading ? <LoadingBlock rows={5} /> : loadError ? <ErrorState error={errorMessage(loadError)} /> : !rules?.length ? <EmptyState title="No allocation rules yet" description="Teach the app what should happen when money arrives." action={{ href: "#new", label: "Create your first rule" }} /> : <div className="rules-list">{rules.map((rule) => <article className="rule-card" key={rule._id}><header><div><p className="resource-kicker">{rule.isDefault ? "Default rule" : refName(rule.incomeSourceId, "Any source")}</p><h2><Link href={`/rules/${rule._id}`}>{rule.name}</Link>{rule.isArchived && <ArchivedBadge />}</h2></div><span className={rule.isActive && !rule.isArchived ? "status-active" : "status-inactive"}>{rule.isActive && !rule.isArchived ? "Active" : "Inactive"}</span></header><p className="rule-sentence">{ruleSentence(rule)}</p><div className="rule-splits"><span>{rule.fixedAllocations.length} fixed</span><span>{rule.percentageAllocations.length} percentage</span><span>Priority {rule.priority || 0}</span></div><footer><button onClick={() => setTesting(rule)}><Beaker />Test</button><button onClick={() => setEditing(rule)}><Edit3 />Edit</button><button disabled={rule.isArchived || toggle.isPending} onClick={() => toggle.mutate(rule)}><Power />{rule.isActive ? "Deactivate" : "Activate"}</button><button disabled={rule.isArchived} onClick={() => setArchiveTarget(rule)}><Archive />Archive</button></footer></article>)}</div>}
      <RuleEditor open={Boolean(editing)} rule={editing} buckets={buckets} sources={sources} busy={mutate.isPending} error={mutate.error ? errorMessage(mutate.error) : ""} onClose={() => setEditing(null)} onSave={(id, payload) => mutate.mutate({ id, payload })} />
      <RuleTester rule={testing} sources={sources} onClose={() => setTesting(null)} />
      <Modal open={Boolean(archiveTarget)} title="Archive this rule?" description="Posted income keeps its immutable snapshot. Only future income stops using this rule." onClose={() => setArchiveTarget(null)}><div className="confirm-actions"><button className="button-secondary" onClick={() => setArchiveTarget(null)}>Keep rule</button><button className="button-danger" disabled={archive.isPending} onClick={() => archiveTarget && archive.mutate(archiveTarget._id)}>Archive rule</button></div>{archive.error && <p className="form-error-box">{errorMessage(archive.error)}</p>}</Modal>
    </>
  );
}

function ruleSentence(rule: AllocationRule) {
  const source = rule.isDefault ? "any unmatched income" : refName(rule.incomeSourceId, "matching income");
  const threshold = rule.minimumAmountMinor != null && rule.maximumAmountMinor != null ? ` between ${formatMoney(rule.minimumAmountMinor)} and ${formatMoney(rule.maximumAmountMinor)}` : rule.minimumAmountMinor != null ? ` above ${formatMoney(rule.minimumAmountMinor)}` : rule.maximumAmountMinor != null ? ` below ${formatMoney(rule.maximumAmountMinor)}` : "";
  return `When I receive ${source}${threshold}, first set aside ${rule.fixedAllocations.length} commitment${rule.fixedAllocations.length === 1 ? "" : "s"}, then divide the rest across ${rule.percentageAllocations.length} bucket${rule.percentageAllocations.length === 1 ? "" : "s"}.`;
}

function initialState(rule: AllocationRule | "new" | null): RuleFormState {
  if (!rule || rule === "new") return blankRule;
  const condition = rule.minimumAmountMinor != null && rule.maximumAmountMinor != null ? "between" : rule.minimumAmountMinor != null ? "more" : rule.maximumAmountMinor != null ? "less" : "any";
  return { name: rule.name, description: rule.description || "", sourceId: typeof rule.incomeSourceId === "string" ? rule.incomeSourceId : rule.incomeSourceId?._id || "", condition, minimum: rule.minimumAmountMinor != null ? String(rule.minimumAmountMinor / 100) : "", maximum: rule.maximumAmountMinor != null ? String(rule.maximumAmountMinor / 100) : "", priority: String(rule.priority || 0), isDefault: Boolean(rule.isDefault), isActive: rule.isActive !== false, fixed: rule.fixedAllocations.map((item) => ({ bucketId: typeof item.bucketId === "string" ? item.bucketId : item.bucketId._id, amount: String((item.amountMinor || 0) / 100) })), percentages: rule.percentageAllocations.map((item) => ({ bucketId: typeof item.bucketId === "string" ? item.bucketId : item.bucketId._id, percentage: String((item.percentageBps || 0) / 100) })) };
}

function RuleEditor({ open, rule, buckets, sources, busy, error, onClose, onSave }: { open: boolean; rule: AllocationRule | "new" | null; buckets: Bucket[]; sources: IncomeSource[]; busy: boolean; error: string; onClose: () => void; onSave: (id: string | undefined, payload: unknown) => void }) {
  const [state, setState] = useState<RuleFormState>(() => initialState(rule));
  const [localError, setLocalError] = useState("");
  const identity = rule === "new" ? "new" : rule?._id || "";
  const [lastIdentity, setLastIdentity] = useState(identity);
  if (identity !== lastIdentity) { setLastIdentity(identity); setState(initialState(rule)); setLocalError(""); }
  const total = useMemo(() => state.percentages.reduce((sum, item) => sum + (parsePercentageInput(item.percentage) || 0), 0), [state.percentages]);
  const submit = () => {
    setLocalError("");
    if (!state.name.trim()) return setLocalError("Give this rule a name.");
    const fixed = state.fixed.map((item, index) => { const parsed = parseMoneyInput(item.amount); if (!item.bucketId || !parsed.ok) throw new Error(`Complete fixed set-aside ${index + 1}.`); return { bucketId: item.bucketId, amountMinor: parsed.amountMinor, order: index }; });
    const percentages = state.percentages.filter((item) => item.bucketId || item.percentage).map((item, index) => { const bps = parsePercentageInput(item.percentage); if (!item.bucketId || !bps) throw new Error(`Complete percentage line ${index + 1}.`); return { bucketId: item.bucketId, percentageBps: bps, order: fixed.length + index }; });
    if (percentages.length && total !== 10_000) return setLocalError("Percentage allocations must total exactly 100%.");
    const ids = [...fixed, ...percentages].map((item) => item.bucketId);
    if (new Set(ids).size !== ids.length) return setLocalError("A bucket can appear only once across the rule.");
    let minimumAmountMinor: number | null = null; let maximumAmountMinor: number | null = null;
    if (state.condition === "more" || state.condition === "between") { const parsed = parseMoneyInput(state.minimum, true); if (!parsed.ok) return setLocalError("Enter a valid minimum."); minimumAmountMinor = parsed.amountMinor; }
    if (state.condition === "less" || state.condition === "between") { const parsed = parseMoneyInput(state.maximum, true); if (!parsed.ok) return setLocalError("Enter a valid maximum."); maximumAmountMinor = parsed.amountMinor; }
    if (minimumAmountMinor != null && maximumAmountMinor != null && minimumAmountMinor > maximumAmountMinor) return setLocalError("Minimum amount cannot exceed maximum amount.");
    onSave(rule && rule !== "new" ? rule._id : undefined, { name: state.name.trim(), description: state.description.trim(), priority: Number(state.priority) || 0, incomeSourceId: state.isDefault ? null : state.sourceId || null, minimumAmountMinor, maximumAmountMinor, fixedAllocations: fixed, percentageAllocations: percentages, isDefault: state.isDefault, isActive: state.isActive });
  };
  const updateArray = (key: "fixed" | "percentages", index: number, patch: Record<string, string>) => setState((value) => ({ ...value, [key]: value[key].map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }));
  return <Modal open={open} title={rule && rule !== "new" ? `Edit ${rule.name}` : "Create allocation rule"} description="Build the instruction in plain language. Percentage lines divide what remains after fixed set-asides." onClose={onClose} wide><div className="rule-builder"><section className="rule-phrase"><p>When I receive money from</p><select value={state.sourceId} disabled={state.isDefault} onChange={(event) => setState({ ...state, sourceId: event.target.value })}><option value="">Any source</option>{sources.map((source) => <option value={source._id} key={source._id}>{source.name}</option>)}</select><label><input type="checkbox" checked={state.isDefault} onChange={(event) => setState({ ...state, isDefault: event.target.checked })} />Use as default for unmatched income</label></section><section className="rule-phrase"><p>If the amount is</p><select value={state.condition} onChange={(event) => setState({ ...state, condition: event.target.value as RuleFormState["condition"] })}><option value="any">Any amount</option><option value="more">More than</option><option value="less">Less than</option><option value="between">Between</option></select>{(state.condition === "more" || state.condition === "between") && <input inputMode="decimal" placeholder="Minimum NGN" value={state.minimum} onChange={(event) => setState({ ...state, minimum: event.target.value })} />}{(state.condition === "less" || state.condition === "between") && <input inputMode="decimal" placeholder="Maximum NGN" value={state.maximum} onChange={(event) => setState({ ...state, maximum: event.target.value })} />}</section><section><div className="builder-heading"><div><p>First set aside</p><small>Fixed commitments happen before percentages.</small></div><button onClick={() => setState({ ...state, fixed: [...state.fixed, { bucketId: "", amount: "" }] })}><Plus />Add fixed amount</button></div>{state.fixed.map((item, index) => <BuilderRow key={index} buckets={buckets} value={item.bucketId} amount={item.amount} amountLabel="NGN" onBucket={(bucketId) => updateArray("fixed", index, { bucketId })} onAmount={(amount) => updateArray("fixed", index, { amount })} onRemove={() => setState({ ...state, fixed: state.fixed.filter((_, itemIndex) => itemIndex !== index) })} />)}</section><section><div className="builder-heading"><div><p>Then divide the rest</p><small>The total must be exactly 100%.</small></div><strong className={total === 10_000 ? "total-ok" : "total-bad"}>{formatPercentage(total)}</strong></div>{state.percentages.map((item, index) => <BuilderRow key={index} buckets={buckets} value={item.bucketId} amount={item.percentage} amountLabel="%" onBucket={(bucketId) => updateArray("percentages", index, { bucketId })} onAmount={(percentage) => updateArray("percentages", index, { percentage })} onRemove={() => setState({ ...state, percentages: state.percentages.filter((_, itemIndex) => itemIndex !== index) })} />)}<button className="add-split" onClick={() => setState({ ...state, percentages: [...state.percentages, { bucketId: "", percentage: "" }] })}><Plus />Add percentage</button></section><details><summary>Advanced matching</summary><div className="advanced-rule"><Field label="Rule name"><input value={state.name} onChange={(event) => setState({ ...state, name: event.target.value })} /></Field><Field label="Priority"><input type="number" value={state.priority} onChange={(event) => setState({ ...state, priority: event.target.value })} /></Field><Field label="Description"><textarea rows={2} value={state.description} onChange={(event) => setState({ ...state, description: event.target.value })} /></Field><label className="check-field"><input type="checkbox" checked={state.isActive} onChange={(event) => setState({ ...state, isActive: event.target.checked })} />Active for future income</label></div></details>{(localError || error) && <p className="form-error-box">{localError || error}</p>}<button className="button-primary submit-button" disabled={busy} onClick={() => { try { submit(); } catch (caught) { setLocalError(caught instanceof Error ? caught.message : "Check the rule details."); } }}>{busy ? "Saving..." : rule && rule !== "new" ? "Save rule" : "Create rule"}</button></div></Modal>;
}

function BuilderRow({ buckets, value, amount, amountLabel, onBucket, onAmount, onRemove }: { buckets: Bucket[]; value: string; amount: string; amountLabel: string; onBucket: (value: string) => void; onAmount: (value: string) => void; onRemove: () => void }) {
  return <div className="builder-row"><select value={value} onChange={(event) => onBucket(event.target.value)}><option value="">Choose bucket</option>{buckets.map((bucket) => <option value={bucket._id} key={bucket._id}>{bucket.name}</option>)}</select><div><input inputMode="decimal" value={amount} onChange={(event) => onAmount(event.target.value)} placeholder="0" /><span>{amountLabel}</span></div><button onClick={onRemove} aria-label="Remove line"><Trash2 /></button></div>;
}

function RuleTester({ rule, sources, onClose }: { rule: AllocationRule | null; sources: IncomeSource[]; onClose: () => void }) {
  const [amount, setAmount] = useState(""); const [sourceId, setSourceId] = useState(""); const [preview, setPreview] = useState<AllocationPreview | null>(null);
  const mutation = useMutation({ mutationFn: async () => { const parsed = parseMoneyInput(amount); if (!parsed.ok) throw new Error(parsed.message); return financeApi.previewRule({ amountMinor: parsed.amountMinor, incomeSourceId: sourceId || (typeof rule?.incomeSourceId === "string" ? rule.incomeSourceId : rule?.incomeSourceId?._id) }); }, onSuccess: setPreview });
  return <Modal open={Boolean(rule)} title="Test server matching" description="The server tests all active saved rules and reports the actual winner. It never writes financial data." onClose={() => { onClose(); setPreview(null); }} wide>{preview ? <AllocationBreakdown preview={preview} /> : <><Field label="Example income amount" hint="NGN"><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label="Income source"><select value={sourceId || (typeof rule?.incomeSourceId === "string" ? rule.incomeSourceId : rule?.incomeSourceId?._id || "")} onChange={(event) => setSourceId(event.target.value)}><option value="">No source</option>{sources.map((source) => <option value={source._id} key={source._id}>{source.name}</option>)}</select></Field>{mutation.error && <p className="form-error-box">{errorMessage(mutation.error)}</p>}<button className="button-primary submit-button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? "Testing..." : "Test this rule"}</button></>}</Modal>;
}

export function RuleDetail({ id }: { id: string }) {
  const query = useQueries({ queries: [
    { queryKey: queryKeys.detail("allocation-rules", id), queryFn: () => getResource("allocation-rules", id) },
    { queryKey: queryKeys.resource("buckets", { limit: 100 }), queryFn: () => listResource("buckets", { limit: 100 }) },
  ] });
  if (query.some((item) => item.isLoading)) return <LoadingBlock rows={5} />;
  const rule = query[0].data as AllocationRule | undefined;
  if (!rule || query[0].error) return <ErrorState error={errorMessage(query[0].error)} />;
  return <><Link className="back-link" href="/rules">Back to rules</Link><PageHeader eyebrow={rule.isDefault ? "Default allocation" : "Allocation rule"} title={rule.name} description={ruleSentence(rule)} /><section className="detail-card rule-detail"><h2>First, fixed set-asides</h2>{rule.fixedAllocations.length ? rule.fixedAllocations.map((item, index) => <div className="impact-row" key={index}><span>{refName(item.bucketId, item.bucketName || "Bucket")} <small>fixed</small></span><b>{formatMoney(item.amountMinor || 0)}</b></div>) : <p className="muted-copy">No fixed set-asides.</p>}<h2>Then, divide the rest</h2>{rule.percentageAllocations.map((item, index) => <div className="impact-row" key={index}><span>{refName(item.bucketId, item.bucketName || "Bucket")}</span><b>{formatPercentage(item.percentageBps || 0)}</b></div>)}</section></>;
}
