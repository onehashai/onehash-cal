import Script from "next/script";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chatwootSDK: any;
    chatwootSettings: object;
  }
}

export default function OneHashChatScript() {
  // const { data } = trpc.viewer.me.useQuery();
  window.chatwootSettings = {
    hideMessageBubble: false,
    position: "right",
    locale: "en",
    type: "standard",
  };

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
