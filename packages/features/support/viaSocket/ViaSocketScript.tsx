/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";

declare global {
  interface Window {
    SendDataToChatbot: any;
  }
}
export default function ViaSocketScript() {
  useEffect(() => {
    getInitPayload();
  }, []);

  const getInitPayload = async () => {
    try {
      const res = await fetch("/api/via-socket");
      if (res.ok) {
        const data = await res.json();
        const script = document.createElement("script");
        script.id = "chatbot-main-script";
        script.src = "https://chatbot-embed.viasocket.com/chatbot-prod.js";
        script.setAttribute("embedToken", data.embedToken);
        script.setAttribute("bridgeName", "Calander_Assistant");
        script.setAttribute("threadId", data.userId);
        document.head.appendChild(script);
        console.log("keys", data);
      }
    } catch (err) {
      console.error("Failed to initialize via-socket");
    }
  };

  return (
    <></>
    // <>
    //   {keys.embedToken != "" && (
    //     <>
    //       {/* <Script
    //         id="chatbot-main-script"
    //         src="https://chatbot-embed.viasocket.com/chatbot-prod.js"
    //         strategy="afterInteractive"
    //         onLoad={() => {
    //           window.SendDataToChatbot();
    //           console.log("ViaSocket script loaded");
    //         }}
    //       />
    //       <Script
    //         id="chatbot-config"
    //         strategy="afterInteractive"
    //         dangerouslySetInnerHTML={{
    //           __html: `
    //           window.chatbotConfig = {
    //             embedToken: "${embedToken}",
    //             bridgeName: "Calander_Assistant",
    //             threadId: "userId"
    //           };
    //         `,
    //         }}
    //       /> */}
    //       {/* <Script
    //         id="chatbot-main-script"
    //         src="https://chatbot-embed.viasocket.com/chatbot-prod.js"
    //         strategy="afterInteractive"
    //         onLoad={() => {
    //           console.log("ViaSocket script loaded");
    //           window.SendDataToChatbot();
    //         }}
    //         // dangerouslySetInnerHTML={{
    //         //   __html: `
    //         //   window.chatbotConfig = {
    //         //     embedToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcmdfaWQiOiIxMjQ5OCIsImNoYXRib3RfaWQiOiI2Nzg4YTM4NTFhZGI1NzMzZmM3NzRlMmEiLCJ1c2VyX2lkIjoxMjMsInZhcmlhYmxlcyI6eyJzZXNzaW9uIjoxMjN9fQ.ZOIs0xAPNMRBSmqGaBWJVHPdcBz4aA2TAdiQOlDtK40",
    //         //     bridgeName: "Calander_Assistant",
    //         //     threadId: "${keys.userId}"
    //         //   };
    //         // `,
    //         // }}
    //       /> */}
    //     </>
    //   )}
    // </>
  );
}
