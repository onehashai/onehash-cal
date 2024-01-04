import React from "react";

class OneHashChatWidget extends React.Component {
  componentDidMount() {
    // Add Chatwoot Settings
    window.chatwootSettings = {
      hideMessageBubble: false,
      position: "right", // This can be left or right
      locale: "en", // Language to be set
      type: "standard", // [standard, expanded_bubble]
    };

    // Paste the script from inbox settings except the <script> tag
    (function (d, t) {
      var BASE_URL = "https://chat.onehash.ai";
      var g = d.createElement(t),
        s = d.getElementsByTagName(t)[0];
      g.src = `${BASE_URL}/packs/js/sdk.js`;
      s.parentNode.insertBefore(g, s);
      g.async = !0;
      g.onload = function () {
        window.chatwootSDK.run({
          websiteToken: "wDbXNafmeJPxJPAimstLMpZQ",
          baseUrl: BASE_URL,
        });
      };
    })(document, "script");
  }

  render() {
    return null;
  }
}

export default OneHashChatWidget;
