import { StrictMode, useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/app-shell";
import { Screen } from "@/components/screens";
import { DataProvider } from "@/lib/data";
import { NavProvider, parseHref, type LinkProps, type Nav } from "@/lib/nav";

/**
 * Single-file build of the app (published as a Claude artifact). The page
 * lives in one document, so navigation is kept in memory instead of the URL.
 */
function App() {
  const [stack, setStack] = useState([parseHref("/")]);
  const current = stack[stack.length - 1];

  const go = useCallback((href: string) => {
    setStack((s) => [...s.slice(-30), parseHref(href)]);
    window.scrollTo(0, 0);
  }, []);

  // The Android app's back button asks this: go back a page if there is one (true), else it leaves the app.
  useEffect(() => {
    (window as unknown as { sdmBack?: () => boolean }).sdmBack = () => {
      if (stack.length <= 1) return false;
      setStack((s) => s.slice(0, -1));
      return true;
    };
  }, [stack.length]);

  const nav = useMemo<Nav>(() => {
    function Link({ href, children, ...rest }: LinkProps) {
      const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        go(href);
      };
      return (
        <a href="#" onClick={onClick} {...rest}>
          {children}
        </a>
      );
    }
    return {
      path: current.path,
      query: current.query,
      go,
      back: (fallback) => (stack.length > 1 ? setStack((s) => s.slice(0, -1)) : go(fallback)),
      Link,
    };
  }, [current, stack.length, go]);

  return (
    <NavProvider value={nav}>
      <AppShell>
        <Screen key={current.path + JSON.stringify(current.query)} path={current.path} />
      </AppShell>
    </NavProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </StrictMode>,
);
