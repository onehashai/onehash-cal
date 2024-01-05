/* eslint-disable @typescript-eslint/no-explicit-any */
import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    chatwootSDK: any;
    chatwootSettings: any;
  }
}

export default function OneHashChatScript() {
  // const { data } = trpc.viewer.me.useQuery();

  useEffect(() => {
    window.chatwootSettings = {
      hideMessageBubble: false,
      position: "right",
      locale: "en",
      type: "standard",
    };
  }, []);

  return (
    <Script
      id="onehash-chat-sdk"
      src="https://chat.onehash.ai/packs/js/sdk.js"
      onLoad={() => {
        window.chatwootSDK.run({
          websiteToken: "wDbXNafmeJPxJPAimstLMpZQ",
          baseUrl: "https://chat.onehash.ai",
        });
      }}
    />
  );
}
