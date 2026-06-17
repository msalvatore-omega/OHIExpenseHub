"use client";

// Mock login. No real auth — "Sign in" just routes into the app using the
// existing mock session (default ADMIN, adjustable via the dev role switcher).

import { useRouter } from "next/navigation";

import { APP_NAME } from "@/lib/constants";
import { useSession } from "@/lib/auth/mock-session";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { role, setRole } = useSession();

  function handleSignIn() {
    // "Set" the mock session (re-affirm the current role) and enter the app.
    setRole(role);
    router.push("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <BrandLogo className="mb-3 size-16" />
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <CardDescription>Employee expense management</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3">
          <Button
            onClick={handleSignIn}
            variant="outline"
            className="w-full gap-2"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Prototype — authentication is simulated.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
