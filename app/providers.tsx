"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DataProvider } from "@/lib/data";
import { NavProvider, type LinkProps, type Nav } from "@/lib/nav";
import { registerServiceWorker } from "@/lib/install";

function Link({ href, ...rest }: LinkProps) {
  return <NextLink href={href} {...rest} />;
}

function NextNav({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();

  const nav = useMemo<Nav>(() => {
    const query: Record<string, string> = {};
    new URLSearchParams(qs).forEach((v, k) => (query[k] = v));
    return {
      path: pathname || "/",
      query,
      go: (href) => router.push(href),
      back: (fallback) => (window.history.length > 1 ? router.back() : router.push(fallback)),
      Link,
    };
  }, [pathname, qs, router]);

  return <NavProvider value={nav}>{children}</NavProvider>;
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(registerServiceWorker, []);
  // Other websites can't show this site inside theirs: they only get a link to open it here.
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    try {
      setFramed(window.top !== window.self);
    } catch {
      setFramed(true);
    }
  }, []);
  if (framed) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", fontFamily: "sans-serif" }}>
        <a href={window.location.href} target="_top" rel="noopener" style={{ color: "#106a7a", fontSize: 18 }}>
          Open Shiur Daled Mivtzoim
        </a>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <NextNav>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </NextNav>
    </Suspense>
  );
}
