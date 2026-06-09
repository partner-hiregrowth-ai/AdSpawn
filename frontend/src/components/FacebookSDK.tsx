"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    _fbInitDone?: boolean;
  }
}

function initFB() {
  if (window._fbInitDone) {
    console.log("[FB] initFB called again — skipping (already done)");
    return;
  }
  const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
  console.log("[FB] initFB called, appId:", appId);
  if (!appId) {
    console.error("[FB] NEXT_PUBLIC_FB_APP_ID is not set!");
    return;
  }
  window._fbInitDone = true;
  window.FB.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
  console.log("[FB] FB.init() completed, window.FB:", !!window.FB, "_fbInitDone:", window._fbInitDone);
}

if (typeof window !== "undefined") {
  window.fbAsyncInit = initFB;
  console.log("[FB] fbAsyncInit registered at module load");
}

export const FacebookSDK = () => (
  <Script
    src="https://connect.facebook.net/en_US/sdk.js"
    strategy="afterInteractive"
    onLoad={() => {
      console.log("[FB] onLoad fired, window.FB:", !!window.FB, "_fbInitDone:", window._fbInitDone);
      if (window.FB && !window._fbInitDone) initFB();
    }}
  />
);
