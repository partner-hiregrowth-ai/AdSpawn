"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    __fbReady: boolean;
  }
}

export const FacebookSDK = () => {
  const initFacebookSDK = () => {
    // The FB SDK installs a stub proxy first (window.FB.__buffer exists).
    // FB.init() called on the stub gets buffered and replayed when the real SDK
    // loads — which would call FB.init() twice (once from buffer, once from here),
    // resetting auth state. Skip until the real SDK is active.
    if (!window.FB || window.FB.__buffer) {
      console.log("[FB] initFacebookSDK — stub active, skipping (__buffer:", !!window.FB?.__buffer, ")");
      return;
    }
    if (window.__fbReady) {
      console.log("[FB] initFacebookSDK — already initialized, skipping");
      return;
    }
    const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
    console.log("[FB] FB.init() on real SDK — appId:", appId, "FB keys:", Object.keys(window.FB).join(", "));
    window.FB.init({
      appId,
      cookie: true,
      xfbml: false,
      version: "v21.0",
    });
    window.__fbReady = true;
    console.log("[FB] FB.init() done");
  };

  if (typeof window !== "undefined") {
    console.log("[FB] FacebookSDK render — setting window.fbAsyncInit");
    window.fbAsyncInit = initFacebookSDK;
  }

  return (
    <Script
      async
      defer
      crossOrigin="anonymous"
      src="https://connect.facebook.net/en_US/sdk.js"
      strategy="afterInteractive"
      onReady={() => {
        console.log("[FB] onReady fired — __buffer:", !!window.FB?.__buffer, "__fbReady:", !!window.__fbReady);
        initFacebookSDK();
      }}
    />
  );
};
