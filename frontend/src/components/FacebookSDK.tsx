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
    console.log("[FB] fbAsyncInit called — window.FB:", !!window.FB);
    const appId = process.env.NEXT_PUBLIC_FB_APP_ID;
    console.log("[FB] appId from env in FacebookSDK.tsx:", appId);
    if (window.FB) {
      window.FB.init({
        appId,
        cookie: true,
        xfbml: false,
        version: "v21.0",
      });
      window.__fbReady = true;
      console.log("[FB] FB.init() done — _initialized:", window.FB._initialized, "_apiKey:", window.FB._apiKey, "version:", window.FB.version);
      console.log("[FB] FB object keys:", Object.keys(window.FB).join(", "));
      (window as any).__lastFB = window.FB;
    }
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
        console.log("[FB] onReady fired — window.FB:", !!window.FB, "__fbReady:", !!window.__fbReady);
        console.log("[FB] login fn source:", window.FB?.login?.toString().slice(0, 400));
        // Call init here too — matching a46e926 which called from both onLoad and fbAsyncInit
        if (window.FB) initFacebookSDK();
      }}
    />
  );
};
