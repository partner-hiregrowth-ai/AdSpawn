"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    __fbReady: boolean;
  }
}

function initFB() {
  if (typeof window === "undefined" || window.__fbReady) return;
  window.FB.init({
    appId: process.env.NEXT_PUBLIC_FB_APP_ID,
    cookie: true,
    xfbml: true,
    version: "v21.0",
  });
  window.__fbReady = true;
  window.dispatchEvent(new Event("fb:ready"));
}

// Primary path: FB SDK calls this synchronously as soon as it loads.
if (typeof window !== "undefined") {
  window.fbAsyncInit = initFB;
}

// Fallback: onLoad fires after the script load event in case fbAsyncInit
// was not set in time (e.g. the SDK was already cached and executed instantly).
export const FacebookSDK = () => (
  <Script
    src="https://connect.facebook.net/en_US/sdk.js"
    strategy="afterInteractive"
    onLoad={initFB}
  />
);
