"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/providers";
import { ApiError } from "@/lib/api/client";
import { PRODUCT_NAME } from "@/lib/product";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Enter your name."),
  password: z.string().min(10, "Use at least 10 characters."),
});
type AuthFields = { name?: string; email: string; password: string };

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { login, register: registerUser } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState("");
  const schema = mode === "login" ? loginSchema : registerSchema;
  const form = useForm<AuthFields>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    setServerError("");
    try {
      if (mode === "login") {
        await login({ email: values.email, password: values.password });
      } else {
        await registerUser({
          name: values.name || "",
          email: values.email,
          password: values.password,
        });
      }
      router.replace(mode === "register" ? "/onboarding" : "/dashboard");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.",
      );
    }
  });

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-labelledby="story-title">
        <Link className="brand-mark" href="/">{PRODUCT_NAME}<span>.</span></Link>
        <div className="auth-story-copy">
          <p className="eyebrow">Money with a clear purpose</p>
          <h1 id="story-title">Know where it lives.<br />Decide what it does.</h1>
          <p>Build calm, programmable cash flow around the way your income actually arrives.</p>
          <div className="trust-note">
            <ShieldCheck aria-hidden="true" />
            <span>Your balances stay grounded in the server’s ledgers—never browser guesswork.</span>
          </div>
        </div>
        <p className="auth-footnote">Accounts are where money lives. Buckets are what it’s for.</p>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <p className="mobile-brand">{PRODUCT_NAME}<span>.</span></p>
          <p className="eyebrow">{mode === "login" ? "Welcome back" : "Start with intention"}</p>
          <h2 id="auth-title">{mode === "login" ? "Sign in to your money plan" : "Create your account"}</h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Continue assigning every naira a job."
              : "Set up a personal system for income, priorities, and spending."}
          </p>
          <form onSubmit={submit} noValidate>
            {mode === "register" && (
              <Field label="Full name" error={form.formState.errors.name?.message}>
                <input autoComplete="name" placeholder="Ada Okafor" {...form.register("name")} />
              </Field>
            )}
            <Field label="Email address" error={form.formState.errors.email?.message}>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="ada@example.com"
                {...form.register("email")}
              />
            </Field>
            <Field
              label="Password"
              hint={mode === "register" ? "At least 10 characters" : undefined}
              error={form.formState.errors.password?.message}
            >
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="Your secure password"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
            </Field>
            {serverError && (
              <p className="form-error form-error-box" role="alert">{serverError}</p>
            )}
            <button className="primary-action" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Please wait…"
                : mode === "login" ? "Sign in" : "Create account"}
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <Link href={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({
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
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      {children}
      {error && <em role="alert">{error}</em>}
    </label>
  );
}
