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
    console.log("[FB] initFacebookSDK called — window.FB:", !!window.FB, "__fbReady:", !!window.__fbReady);
    if (window.FB && !window.__fbReady) {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      window.__fbReady = true;
      console.log("[FB] FB.init() done — __fbReady set");
    } else {
      console.log("[FB] initFacebookSDK skipped — FB exists:", !!window.FB, "already ready:", !!window.__fbReady);
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
        initFacebookSDK();
      }}
    />
  );
};
