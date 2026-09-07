"use client";

import Link from "next/link";
import {
  AlertCircle,
  Archive,
  ArrowRight,
  Inbox,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function MoneyAmount({
  value,
  currency = "NGN",
  compact = false,
  className,
}: {
  value: number;
  currency?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("money-amount", className)}>
      {formatMoney(value, currency, { compact })}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}

export function ActionLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={secondary ? "button-secondary" : "button-primary"}
      href={href}
    >
      {children}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
  icon?: typeof Inbox;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon aria-hidden="true" />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action?.onClick ? (
        <button
          className="button-primary"
          type="button"
          onClick={action.onClick}
        >
          {action.label}
          <Plus aria-hidden="true" />
        </button>
      ) : action?.href ? (
        <ActionLink href={action.href}>
          {action.label}
          <Plus aria-hidden="true" />
        </ActionLink>
      ) : null}
    </div>
  );
}

export function ErrorState({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle aria-hidden="true" />
      <div>
        <h2>We could not load this</h2>
        <p>{error}</p>
      </div>
      {retry && (
        <button className="button-secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="loading-stack" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton" key={index} />
      ))}
    </div>
  );
}

export function FullPageLoading() {
  return (
    <main className="full-loading">
      <LoaderCircle aria-hidden="true" />
      <p>Restoring your secure session...</p>
    </main>
  );
}

export function ArchivedBadge() {
  return (
    <span className="archived-badge">
      <Archive aria-hidden="true" />
      Archived
    </span>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={cn("modal-panel", wide && "modal-wide")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header>
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      {children}
      {error && <em role="alert">{error}</em>}
    </label>
  );
}

export function SubmitButton({
  busy,
  children,
}: {
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="button-primary submit-button"
      type="submit"
      disabled={busy}
    >
      {busy ? "Saving..." : children}
    </button>
  );
}
