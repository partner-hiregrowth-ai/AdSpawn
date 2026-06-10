"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    __fbReady: boolean;
    __fbLastRef: any;
  }
}

export const FacebookSDK = () => {
  const initFacebookSDK = () => {
    // Skip if called on the stub proxy — it buffers calls and replays them
    // on the real SDK, which would cause a double-init that resets auth state.
    if (!window.FB || window.FB.__buffer) return;
    if (window.__fbReady) return;

    const rawAppId = process.env.NEXT_PUBLIC_FB_APP_ID;
    const appId = rawAppId?.replace(/^["']|["']$/g, "")?.trim();
    
    if (!appId || appId === "your_facebook_app_id") {
      console.warn("[FB] FB.init() skipped — App ID is missing or default:", appId);
      return;
    }

    console.log("[FB] FB.init() — appId:", appId, "raw:", rawAppId);
    try {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v22.0"
      });
      window.__fbReady = true;
      window.__fbLastRef = window.FB;
      console.log("[FB] FB.init() done");
    } catch (err) {
      console.error("[FB] FB.init() failed:", err);
    }
  };

  if (typeof window !== "undefined") {
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
        console.log("[FB] onReady — __buffer:", !!window.FB?.__buffer, "__fbReady:", !!window.__fbReady);
        initFacebookSDK();
      }}
    />
  );
};
