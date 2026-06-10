"use client";

import Script from "next/script";

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: any;
  }
}

export const FacebookSDK = () => {
  const initFacebookSDK = () => {
    if (window.FB) {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
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
      onLoad={() => {
        if (window.FB && !window.FB._initialized) {
          initFacebookSDK();
        }
      }}
    />
  );
};
