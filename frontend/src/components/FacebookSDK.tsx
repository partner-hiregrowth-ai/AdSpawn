"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    fbReady?: Promise<void>;
    _fbReadyResolve?: () => void;
    _fbReadyReject?: (e: Error) => void;
  }
}

function ensureFbReadyPromise() {
  if (typeof window === "undefined") return;
  if (window.fbReady) return;

  window.fbReady = new Promise<void>((resolve, reject) => {
    window._fbReadyResolve = resolve;
    window._fbReadyReject = reject;
  });

  window.fbAsyncInit = () => {
    const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
    if (!appId || appId === "your_facebook_app_id") {
      console.error("[FB] NEXT_PUBLIC_FB_APP_ID is not configured.");
      window._fbReadyReject?.(new Error("FB_APP_ID_MISSING"));
      window._fbReadyResolve = window._fbReadyReject = undefined;
      return;
    }
    window.FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
    console.log("[FB] Initialized");
    window._fbReadyResolve?.();
    window._fbReadyResolve = window._fbReadyReject = undefined;
  };
}

export const FacebookSDK = () => {
  ensureFbReadyPromise();

  return (
    <Script
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
    />
  );
};
