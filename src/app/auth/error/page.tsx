"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

import { APP_NAME } from "@/lib/constants";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const MESSAGES: Record<string, { title: string; body: string }> = {
  deactivated: {
    title: "Account deactivated",
    body: "Your account has been deactivated. Contact your administrator.",
  },
  unprovisioned: {
    title: "Access not provisioned",
    body: "Your account is not provisioned for OHI Expense Hub. Contact your administrator to request access.",
  },
};

const DEFAULT_MESSAGE = {
  title: "Sign-in failed",
  body: "An error occurred during sign-in. Contact your administrator.",
};

function ErrorContent() {
  const params = useSearchParams();
  const reason = params.get("reason") ?? "";
  const { title, body } = MESSAGES[reason] ?? DEFAULT_MESSAGE;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center pb-4">
        <BrandLogo className="mb-3 size-14" />
        <CardTitle className="text-xl">{APP_NAME}</CardTitle>
        <CardDescription className="text-destructive font-medium">{title}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">{body}</p>
        <Link
          href="/login"
          className="inline-flex h-8 items-center rounded-lg border border-input bg-transparent px-3 text-sm font-medium transition-colors hover:bg-accent/60"
        >
          Back to sign-in
        </Link>
      </CardContent>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <React.Suspense fallback={null}>
        <ErrorContent />
      </React.Suspense>
    </main>
  );
}
