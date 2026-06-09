"use client";

import { useEffect } from "react";
import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    fbReady: Promise<void>;
    _fbReadyResolve: (() => void) | undefined;
  }
}

export const FacebookSDK = () => {
  useEffect(() => {
    // Create the ready promise once; persists across soft navigations
    if (!window.fbReady) {
      window.fbReady = new Promise<void>((resolve) => {
        window._fbReadyResolve = resolve;
      });
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID!,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      window._fbReadyResolve?.();
      window._fbReadyResolve = undefined;
    };

    // Handle cached SDK: script already ran before our effect mounted
    if (window.FB && window._fbReadyResolve) {
      window.fbAsyncInit();
    }
  }, []);

  return (
    <Script
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
    />
  );
};
