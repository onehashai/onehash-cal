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
  useEffect(() => {
    window.chatwootSettings = {
      hideMessageBubble: false,
      position: "right",
      locale: "en",
      type: "expanded",
    };
  }, []);

  // const handleScriptLoad = () => {
  //   const elements = document.querySelectorAll(".woot-widget-bubble.woot-elements--left");
  //   console.log("elements", elements);
  //   elements.forEach((element) => {
  //     const el = element as HTMLElement;
  //     adjustChatWidgetPosition(el);
  //   });

  //   // Adjust position on window resize
  //   window.addEventListener("resize", () => {
  //     elements.forEach((element) => {
  //       const el = element as HTMLElement;
  //       adjustChatWidgetPosition(el);
  //     });
  //   });
  // };

  const adjustChatWidgetPosition = (element: HTMLElement) => {
    // Get viewport height
    const windowWidth = window.innerWidth;

    // Adjust position based on viewport height
    if (windowWidth <= 600) {
      element.style.bottom = "80px";
      element.style.left = "20px";
    } else if (windowWidth <= 900) {
      element.style.bottom = "40px";
      element.style.left = "40px";
    } else {
      element.style.bottom = "20px";
      element.style.left = "140px";
    }
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

        // setTimeout(() => {
        //   handleScriptLoad();
        // }, 1000);
      }}
    />
  );
}
