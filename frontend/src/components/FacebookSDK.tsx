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
  if (window._fbInitDone) return; // prevent double-init
  window._fbInitDone = true;
  window.FB.init({
    appId: process.env.NEXT_PUBLIC_FB_APP_ID,
    cookie: true,
    xfbml: true,
    version: "v21.0",
  });
}

if (typeof window !== "undefined") {
  window.fbAsyncInit = initFB;
}

export const FacebookSDK = () => (
  <Script
    src="https://connect.facebook.net/en_US/sdk.js"
    strategy="afterInteractive"
    onLoad={() => {
      // Fallback: SDK loaded but fbAsyncInit wasn't called (e.g. cached script race)
      if (window.FB && !window._fbInitDone) initFB();
    }}
  />
);
