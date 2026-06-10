"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
    __fbReady: boolean;
  }
}

export const FacebookSDK = () => (
  <Script
    src="https://connect.facebook.net/en_US/sdk.js"
    strategy="afterInteractive"
    onLoad={() => {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      window.__fbReady = true;
      window.dispatchEvent(new Event("fb:ready"));
    }}
  />
);
