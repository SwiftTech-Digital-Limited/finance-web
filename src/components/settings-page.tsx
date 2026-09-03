"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Archive, ChevronRight, LockKeyhole, Tags, UserRound } from "lucide-react";
import { financeApi, listResource, queryKeys, type ResourceName } from "@/lib/api";
import { useAuth } from "@/components/providers";
import { errorMessage } from "@/lib/errors";
import { ArchivedBadge, EmptyState, ErrorState, Field, LoadingBlock, PageHeader } from "@/components/ui-kit";

export function SettingsPage() {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || "", timezone: user?.timezone || "Africa/Lagos", defaultCurrency: user?.defaultCurrency || "NGN" });
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  const profileMutation = useMutation({ mutationFn: () => financeApi.updateProfile(profile), onSuccess: (updated) => setUser(updated) });
  const passwordMutation = useMutation({ mutationFn: () => financeApi.changePassword(password), onSuccess: () => { setPassword({ currentPassword: "", newPassword: "" }); setTimeout(() => window.location.assign("/login"), 800); } });
  return <><PageHeader eyebrow="Settings" title="Your preferences" description="Manage your profile, security, expense categories, and archived configuration." /><div className="settings-grid"><section className="settings-panel"><header><span><UserRound /></span><div><h2>Profile</h2><p>Used for timezone-aware periods and currency display.</p></div></header><form onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}><Field label="Name"><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field><Field label="Timezone"><select value={profile.timezone} onChange={(event) => setProfile({ ...profile, timezone: event.target.value })}><option value="Africa/Lagos">Africa/Lagos (WAT)</option><option value="Africa/Accra">Africa/Accra (GMT)</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></Field><Field label="Default currency"><select value={profile.defaultCurrency} onChange={(event) => setProfile({ ...profile, defaultCurrency: event.target.value })}><option value="NGN">NGN - Nigerian naira</option></select></Field>{profileMutation.error && <p className="form-error-box">{errorMessage(profileMutation.error)}</p>}{profileMutation.isSuccess && <p className="success-callout">Profile updated.</p>}<button className="button-primary" disabled={profileMutation.isPending}>Save profile</button></form></section><section className="settings-panel"><header><span><LockKeyhole /></span><div><h2>Security</h2><p>Changing your password revokes every active session.</p></div></header><form onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate(); }}><Field label="Current password"><input type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></Field><Field label="New password" hint="At least 10 characters"><input type="password" autoComplete="new-password" minLength={10} value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></Field>{passwordMutation.error && <p className="form-error-box">{errorMessage(passwordMutation.error)}</p>}{passwordMutation.isSuccess && <p className="success-callout">Password changed. Returning to sign in...</p>}<button className="button-primary" disabled={passwordMutation.isPending || password.newPassword.length < 10}>Change password</button></form></section></div><section className="settings-links"><Link href="/settings/categories"><span><Tags /></span><div><h2>Expense categories</h2><p>Create, edit, search, and archive spending labels.</p></div><ChevronRight /></Link><Link href="/settings/archived"><span><Archive /></span><div><h2>Archived resources</h2><p>Review configuration preserved for history and balances.</p></div><ChevronRight /></Link></section></>;
}

const archiveKinds: { name: ResourceName; label: string }[] = [
  { name: "accounts", label: "Accounts" }, { name: "buckets", label: "Buckets" },
  { name: "categories", label: "Categories" }, { name: "income-sources", label: "Income sources" },
  { name: "allocation-rules", label: "Allocation rules" },
];
export function ArchivedPage() {
  const results = useQueries({ queries: archiveKinds.map((item) => ({ queryKey: queryKeys.resource(item.name, { limit: 100, includeArchived: true }), queryFn: () => listResource(item.name, { limit: 100, includeArchived: true }) })) });
  if (results.some((result) => result.isLoading)) return <><PageHeader title="Archived resources" /><LoadingBlock rows={6} /></>;
  const error = results.find((result) => result.error)?.error; if (error) return <ErrorState error={errorMessage(error)} />;
  const groups = archiveKinds.map((kind, index) => ({ ...kind, items: (results[index].data?.items || []).filter((item) => item.isArchived) }));
  const count = groups.reduce((sum, group) => sum + group.items.length, 0);
  return <><PageHeader eyebrow="Settings" title="Archived resources" description="Archived configuration remains part of historical labels and derived balances, but cannot be selected for new activity." />{!count ? <EmptyState title="Nothing is archived" description="Archived accounts, buckets, categories, sources, and rules will be listed here." /> : <div className="archive-groups">{groups.filter((group) => group.items.length).map((group) => <section className="detail-card" key={group.name}><h2>{group.label}</h2>{group.items.map((item) => <div className="impact-row" key={item._id}><span>{item.name}</span><ArchivedBadge /></div>)}</section>)}</div>}</>;
}
