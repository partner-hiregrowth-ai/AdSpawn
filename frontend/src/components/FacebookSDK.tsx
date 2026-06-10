"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

let fbInitResolveFn: (() => void) | null = null;
const fbInitPromise =
  typeof window !== "undefined"
    ? new Promise<void>((resolve) => {
        fbInitResolveFn = resolve;
      })
    : Promise.resolve();

if (typeof window !== "undefined") {
  window.fbAsyncInit = () => {
    window.FB.init({
      appId: process.env.NEXT_PUBLIC_FB_APP_ID,
      cookie: true,
      xfbml: true,
      version: "v21.0",
    });
    fbInitResolveFn?.();
  };
}

export function waitForFBInit(): Promise<void> {
  return fbInitPromise;
}

export const FacebookSDK = () => (
  <Script
    src="https://connect.facebook.net/en_US/sdk.js"
    strategy="afterInteractive"
  />
);
