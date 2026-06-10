"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    __fbReady: boolean;
    __fbIntercepted: boolean;
  }
}

export const FacebookSDK = () => {
  if (typeof window !== "undefined" && !window.__fbIntercepted) {
    window.__fbIntercepted = true;

    const appId = process.env.NEXT_PUBLIC_FB_APP_ID;

    const tryInit = (fb: any) => {
      // The SDK installs a stub proxy first (window.FB.__buffer exists).
      // Skip it — only init on the real SDK object.
      if (!fb || fb.__buffer) {
        console.log("[FB] tryInit — stub, skipping");
        return;
      }
      console.log("[FB] tryInit — real SDK, calling FB.init() — keys:", Object.keys(fb).slice(0, 5).join(", "), "...");
      fb.init({ appId, cookie: true, xfbml: false, version: "v21.0" });
      window.__fbReady = true;
      console.log("[FB] FB.init() done");
    };

    // Intercept every window.FB assignment so FB.init() is called on
    // whichever object the SDK ends up using — it replaces window.FB
    // async (FedCM/gamingservices modules), and the final object must
    // be initialized even if earlier objects already were.
    let _fb: any = window.FB;
    try {
      Object.defineProperty(window, "FB", {
        configurable: true,
        get() { return _fb; },
        set(v) {
          console.log("[FB] window.FB assigned — __buffer:", !!v?.__buffer, "__fbReady:", window.__fbReady);
          window.__fbReady = false;
          _fb = v;
          tryInit(v);
        },
      });
    } catch {
      // defineProperty failed (already non-configurable) — fall back to fbAsyncInit
      console.log("[FB] defineProperty failed — falling back to fbAsyncInit");
    }

    if (_fb) tryInit(_fb);

    window.fbAsyncInit = () => {
      console.log("[FB] fbAsyncInit called — __buffer:", !!window.FB?.__buffer, "__fbReady:", window.__fbReady);
      // tryInit already ran via the setter; this is a compatibility no-op
    };
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
      }}
    />
  );
};
