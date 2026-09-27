"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** A persistent mount for the existing widget: inline on home, floating elsewhere. */
export function AgentStage({ slug }: { slug: string }) {
  const pathname = usePathname();
  const mount = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const onReady = (event: Event) => {
      if ((event as CustomEvent<{ tenantSlug: string }>).detail?.tenantSlug === slug) setReady(true);
    };
    window.addEventListener("zello:agent-ready", onReady);
    if (mount.current) mount.current.dataset.agentReady = "true";
    window.dispatchEvent(new Event("zello:stage-ready"));
    return () => window.removeEventListener("zello:agent-ready", onReady);
  }, [slug]);
  const home = pathname.replace(/\/$/, "") === `/store/${slug}`;
  return (
    <section className={home ? "mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12" : ""} aria-label="Zello sales assistant">
      {home ? (
        <header className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Your personal AI sales agent</p>
          <h1 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-5xl">Assalam o Alaikum! Main Zello hoon.</h1>
          <p className="mt-3 text-lg text-ink-soft">Aap kya dhoond rahe hain?</p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">Boliye ya likhiye. Main options dhoondne, compare karne aur aapke budget ke mutabiq choose karne mein madad karunga.</p>
          <button type="button" disabled={!ready} className="mt-5 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={() => {
            const mic = mount.current?.querySelector("zello-widget")?.shadowRoot?.querySelector<HTMLButtonElement>(".zello-mic-button");
            mic?.scrollIntoView({ block: "nearest", behavior: "smooth" });
            mic?.click();
          }}>{ready ? "Mic se Zello se baat karein" : "Zello connect ho raha hai…"}</button>
          <p className="mt-4 text-xs text-ink-faint">Discover → Compare → Recommend → Cart → Checkout</p>
        </header>
      ) : null}
      <div ref={mount} id="zello-agent-stage" data-agent-inline={home ? "true" : "false"} />
      {home ? <p className="mt-3 text-center text-xs text-ink-faint">Mic dabayein aur baat karein · Roman Urdu, Urdu & English · DEMO catalog, no real delivery</p> : null}
    </section>
  );
}
