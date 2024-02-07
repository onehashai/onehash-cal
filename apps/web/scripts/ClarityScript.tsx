import { useEffect } from "react";

const ClarityScript = () => {
  useEffect(() => {
    // This function will be executed on the client side after the component mounts
    (function (c, l, a, r, i, t, y) {
      c[a] =
        c[a] ||
        function () {
          (c[a].q = c[a].q || []).push(arguments);
        };
      t = l.createElement(r);
      t.async = 1;
      t.src = `https://www.clarity.ms/tag/${i}`;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", "kuxrvewmyr");
  }, []);

  return null; // Since this is just for script execution, the component doesn't render anything
};

export default ClarityScript;
