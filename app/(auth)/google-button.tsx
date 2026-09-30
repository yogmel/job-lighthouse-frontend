"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef } from "react";

type GoogleButtonText = "signup_with" | "signin_with";

/** Minimal slice of the Google Identity Services API we use. */
type GoogleId = {
  initialize(options: {
    client_id: string;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: { type: "standard"; text: GoogleButtonText; theme: "outline"; size: "large"; width: number },
  ): void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

type Props = {
  /** Button label: "Sign up with Google" or "Sign in with Google". */
  text: GoogleButtonText;
  onCredential: (idToken: string) => void;
};

export function GoogleButton({ text, onCredential }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the latest callback without re-initialising GIS on every render.
  const onCredentialRef = useRef(onCredential);
  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  const render = useCallback(() => {
    const gis = window.google?.accounts.id;
    const container = containerRef.current;
    if (!gis || !container || !clientId) return;
    gis.initialize({
      client_id: clientId,
      callback: ({ credential }) => onCredentialRef.current(credential),
    });
    gis.renderButton(container, {
      type: "standard",
      text,
      theme: "outline",
      size: "large",
      width: container.clientWidth || 320,
    });
  }, [clientId, text]);

  if (!clientId) {
    return (
      <p className="text-center text-xs text-muted">
        Google sign-in is not configured.
      </p>
    );
  }

  return (
    <>
      {/* onReady also fires on remount, after the script is already loaded. */}
      <Script src="https://accounts.google.com/gsi/client" onReady={render} />
      <div ref={containerRef} className="flex min-h-10 justify-center" />
    </>
  );
}
