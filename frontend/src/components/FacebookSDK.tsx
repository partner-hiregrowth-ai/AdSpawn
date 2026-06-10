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
    if (window.FB) {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      window.__fbReady = true;
      console.log("[FB] FB.init() done via fbAsyncInit — __fbReady set");
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
        // onReady fires on script load event, BEFORE the SDK calls fbAsyncInit.
        // Do NOT call FB.init() here — let fbAsyncInit handle it properly.
        console.log("[FB] onReady fired — window.FB:", !!window.FB, "__fbReady:", !!window.__fbReady);
      }}
    />
  );
};
