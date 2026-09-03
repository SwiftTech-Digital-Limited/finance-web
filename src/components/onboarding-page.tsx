"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Landmark, ListTree, PiggyBank, Sparkles, WalletCards } from "lucide-react";
import { createResource, financeApi, listResource, queryKeys } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { parseMoneyInput } from "@/lib/money";
import { parsePercentageInput } from "@/lib/percentage";
import { Field, LoadingBlock } from "@/components/ui-kit";

const steps = ["Welcome", "First account", "Buckets", "Income source", "First rule", "Finish"];

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState({ name: "", type: "bank", opening: "0" });
  const [bucketNames, setBucketNames] = useState(["Everyday", "Savings", "Investing"]);
  const [sourceName, setSourceName] = useState("");
  const [ruleName, setRuleName] = useState("My default income plan");
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
  const progress = useQuery({ queryKey: ["finance", "onboarding"], queryFn: financeApi.onboarding });
  const buckets = useQuery({ queryKey: queryKeys.resource("buckets", { limit: 100 }), queryFn: () => listResource("buckets", { limit: 100 }), enabled: step >= 4 });
  const mutation = useMutation({
    mutationFn: async () => {
      if (step === 1) {
        const money = parseMoneyInput(account.opening, true); if (!money.ok || !account.name.trim()) throw new Error(money.ok ? "Name the account." : money.message);
        await createResource("accounts", { name: account.name.trim(), type: account.type, openingBalanceMinor: money.amountMinor, currency: "NGN", includeInNetWorth: true });
      }
      if (step === 2) {
        const names = bucketNames.map((name) => name.trim()).filter(Boolean); if (!names.length) throw new Error("Add at least one purpose.");
        await Promise.all(names.map((name, index) => createResource("buckets", { name, type: index === 1 ? "saving" : index === 2 ? "investment" : "spending", displayOrder: index })));
      }
      if (step === 3) {
        if (!sourceName.trim()) throw new Error("Name an income source or skip this step.");
        await createResource("income-sources", { name: sourceName.trim() });
      }
      if (step === 4) {
        const availableBuckets = buckets.data?.items || [];
        const allocations = availableBuckets.map((bucket, index) => ({ bucketId: bucket._id, percentageBps: parsePercentageInput(percentages[bucket._id] || ""), order: index })).filter((item): item is { bucketId: string; percentageBps: number; order: number } => item.percentageBps !== null && item.percentageBps > 0);
        if (allocations.reduce((sum, item) => sum + item.percentageBps, 0) !== 10_000) throw new Error("Your percentage plan must total exactly 100%.");
        await createResource("allocation-rules", { name: ruleName.trim() || "Default income plan", isDefault: true, isActive: true, priority: 0, fixedAllocations: [], percentageAllocations: allocations });
      }
      if (step === 5) await financeApi.setOnboarding(true);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.all });
      if (step === 5) window.location.assign("/dashboard"); else setStep((value) => value + 1);
    },
  });
  const next = () => {
    const flags = progress.data;
    if ((step === 1 && flags?.hasAccount) || (step === 2 && flags?.hasBucket) || (step === 3 && flags?.hasIncomeSource) || (step === 4 && flags?.hasAllocationRule)) setStep((value) => value + 1);
    else mutation.mutate();
  };
  const total = useMemo(() => Object.values(percentages).reduce((sum, value) => sum + (parsePercentageInput(value) || 0), 0), [percentages]);
  if (progress.isLoading) return <main className="onboarding-shell"><LoadingBlock rows={5} /></main>;
  return (
    <main className="onboarding-shell">
      <aside className="onboarding-aside">
        <p className="mobile-brand">KoboPlan<span>.</span></p>
        <div><p className="eyebrow">Set up your system</p><h1>One idea<br />at a time.</h1><p>Accounts hold money. Buckets give it purpose. Rules connect new income to the life you want to fund.</p></div>
        <ol>{steps.map((label, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={label}><span>{index < step ? <Check /> : index + 1}</span>{label}</li>)}</ol>
      </aside>
      <section className="onboarding-main">
        <div className="onboarding-card">
          <p className="eyebrow">Step {step + 1} of {steps.length}</p>
          {step === 0 && <Intro icon={Sparkles} title="Set up where your money lives and what you want it to do." text="You can start small. We will use the backend's progress to keep your setup accurate, and you can refine everything later." />}
          {step === 1 && <><Intro icon={Landmark} title="Where does your money live?" text="An account is a physical location such as a bank, wallet, or cash. An opening balance becomes real physical money but starts unallocated." /><Field label="Account name"><input value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} placeholder="GTBank" /></Field><Field label="Account type"><select value={account.type} onChange={(event) => setAccount({ ...account, type: event.target.value })}><option value="bank">Bank</option><option value="cash">Cash</option><option value="wallet">Wallet</option><option value="savings">Savings account</option><option value="investment">Investment</option><option value="other">Other</option></select></Field><Field label="Opening balance" hint="NGN"><input inputMode="decimal" value={account.opening} onChange={(event) => setAccount({ ...account, opening: event.target.value })} /></Field></>}
          {step === 2 && <><Intro icon={PiggyBank} title="What should your money be for?" text="Buckets are purposes, not bank accounts. These suggestions are fully editable and do not control app behavior by name." /><div className="suggestion-list">{bucketNames.map((name, index) => <div key={index}><input value={name} onChange={(event) => setBucketNames((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button onClick={() => setBucketNames((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></div>)}<button onClick={() => setBucketNames((items) => [...items, ""])}>+ Add another purpose</button></div></>}
          {step === 3 && <><Intro icon={WalletCards} title="What kinds of money arrive?" text="Income sources let salary, lessons, contracts, or any other income follow different plans." /><Field label="Income source name"><input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Lessons" /></Field></>}
          {step === 4 && <><Intro icon={ListTree} title="Create your first income plan." text="This simple default rule divides the full remainder. You can add source matching, thresholds, and fixed set-asides later." /><Field label="Rule name"><input value={ruleName} onChange={(event) => setRuleName(event.target.value)} /></Field><div className="onboarding-percentages">{buckets.data?.items.map((bucket) => <label key={bucket._id}><span>{bucket.name}</span><div><input inputMode="decimal" value={percentages[bucket._id] || ""} onChange={(event) => setPercentages({ ...percentages, [bucket._id]: event.target.value })} placeholder="0" /><span>%</span></div></label>)}</div><p className={total === 10_000 ? "percentage-total ok" : "percentage-total"}>Total: {total / 100}% {total === 10_000 && <Check />}</p></>}
          {step === 5 && <Intro icon={Check} title="Your foundation is ready." text="Enter the dashboard, add income, and let the server show exactly how each amount is assigned. You can always change future rules without rewriting history." />}
          {mutation.error && <p className="form-error-box" role="alert">{errorMessage(mutation.error)}</p>}
          <div className="onboarding-actions">{step > 0 && <button className="button-secondary" onClick={() => setStep((value) => value - 1)}>Back</button>}{(step === 3 || step === 4) && <button className="skip-button" onClick={() => setStep((value) => value + 1)}>Skip for now</button>}<button className="button-primary" disabled={mutation.isPending} onClick={() => step === 0 ? setStep(1) : next()}>{mutation.isPending ? "Saving..." : step === 5 ? "Enter dashboard" : "Continue"}<ArrowRight /></button></div>
        </div>
      </section>
    </main>
  );
}
function Intro({ icon: Icon, title, text }: { icon: typeof Check; title: string; text: string }) { return <header className="onboarding-intro"><span><Icon /></span><h2>{title}</h2><p>{text}</p></header>; }
