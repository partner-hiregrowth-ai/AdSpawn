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

  // Set up the global init function that the SDK calls
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
        // If the script loads after fbAsyncInit was already defined,
        // it should call it automatically, but we can also manually call it if needed.
        if (window.FB && !window.FB._initialized) {
          initFacebookSDK();
        }
      }}
    />
  );
};
