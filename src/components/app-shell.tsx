"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronDown,
  CircleDollarSign,
  FolderCog,
  Gauge,
  Landmark,
  LayoutGrid,
  ListTree,
  LogOut,
  Menu,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  Settings,
  SlidersHorizontal,
  Target,
  X,
} from "lucide-react";
import { useAuth } from "@/components/providers";
import { FullPageLoading } from "@/components/ui-kit";
import { PRODUCT_NAME } from "@/lib/product";
import { cn } from "@/lib/utils";

const nav = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: Gauge }],
  },
  {
    label: "Money",
    items: [
      { href: "/transactions", label: "Transactions", icon: ReceiptText },
      { href: "/accounts", label: "Accounts", icon: Landmark },
      { href: "/buckets", label: "Buckets", icon: PiggyBank },
    ],
  },
  {
    label: "Planning",
    items: [
      {
        href: "/income-sources",
        label: "Income sources",
        icon: CircleDollarSign,
      },
      { href: "/rules", label: "Allocation rules", icon: ListTree },
      { href: "/monthly-spending", label: "Monthly spending", icon: Target },
    ],
  },
  {
    label: "Insights",
    items: [{ href: "/analytics", label: "Analytics", icon: BarChart3 }],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, restoring, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    if (!restoring && !user) router.replace("/login");
  }, [restoring, user, router]);

  if (restoring || !user) return <FullPageLoading />;

  return (
    <div className="app-frame">
      <aside className={cn("sidebar", menuOpen && "sidebar-open")}>
        <div className="sidebar-brand">
          <Link href="/dashboard">
            {PRODUCT_NAME}
            <span>.</span>
          </Link>
          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {nav.map((section) => (
            <div className="nav-section" key={section.label}>
              <p>{section.label}</p>
              {section.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    className={cn("nav-link", active && "active")}
                    href={item.href}
                    key={item.href}
                    onClick={() => setMenuOpen(false)}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link
            className={cn(
              "nav-link",
              pathname.startsWith("/settings") && "active",
            )}
            href="/settings"
          >
            <Settings />
            <span>Settings</span>
          </Link>
          <button className="user-chip" onClick={() => void logout()}>
            <span>{user.name.slice(0, 1).toUpperCase()}</span>
            <span>
              <b>{user.name}</b>
              <small>{user.email}</small>
            </span>
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="app-main">
        <header className="topbar">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <p className="topbar-context">Your money, clearly assigned</p>
          <div className="quick-add-wrap">
            <button
              className="quick-add-button"
              onClick={() => setQuickOpen((value) => !value)}
              aria-expanded={quickOpen}
            >
              <Plus />
              <span>Add</span>
              <ChevronDown />
            </button>
            {quickOpen && <QuickMenu onNavigate={() => setQuickOpen(false)} />}
          </div>
        </header>
        <main className="page-content">{children}</main>
        <footer className="app-footer">
          <span>{PRODUCT_NAME} keeps account and bucket ledgers distinct.</span>
          <span>Built with care in Nigeria.</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <MobileLink
          href="/dashboard"
          label="Home"
          icon={LayoutGrid}
          active={pathname.startsWith("/dashboard")}
        />
        <MobileLink
          href="/transactions"
          label="Activity"
          icon={ReceiptText}
          active={pathname.startsWith("/transactions")}
        />
        <Link href="/add" className="mobile-add">
          <Plus />
          <span>Add</span>
        </Link>
        <MobileLink
          href="/rules"
          label="Plan"
          icon={SlidersHorizontal}
          active={
            pathname.startsWith("/rules") ||
            pathname.startsWith("/monthly-spending")
          }
        />
        <MobileLink
          href="/settings"
          label="More"
          icon={MoreHorizontal}
          active={pathname.startsWith("/settings")}
        />
      </nav>
    </div>
  );
}

function QuickMenu({ onNavigate }: { onNavigate: () => void }) {
  const items = [
    {
      href: "/add?flow=income",
      label: "Add income",
      text: "Record and assign money",
      icon: CircleDollarSign,
    },
    {
      href: "/add?flow=expense",
      label: "Add expense",
      text: "Spend from an account and bucket",
      icon: ReceiptText,
    },
    {
      href: "/add?flow=transfer",
      label: "Move money",
      text: "Transfer between accounts",
      icon: ArrowLeftRight,
    },
    {
      href: "/add?flow=reallocate",
      label: "Change its purpose",
      text: "Reallocate between buckets",
      icon: FolderCog,
    },
  ];
  return (
    <div className="quick-menu">
      {items.map((item) => (
        <Link href={item.href} key={item.href} onClick={onNavigate}>
          <item.icon />
          <span>
            <b>{item.label}</b>
            <small>{item.text}</small>
          </span>
        </Link>
      ))}
    </div>
  );
}

function MobileLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Menu;
  active: boolean;
}) {
  return (
    <Link className={active ? "active" : ""} href={href}>
      <Icon />
      <span>{label}</span>
    </Link>
  );
}
