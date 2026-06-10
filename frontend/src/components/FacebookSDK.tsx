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

    const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
    console.log("[FB] FB.init() — appId:", appId);
    window.FB.init({ appId, cookie: true, xfbml: false, version: "v21.0" });
    window.__fbReady = true;
    window.__fbLastRef = window.FB;
    console.log("[FB] FB.init() done");
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
