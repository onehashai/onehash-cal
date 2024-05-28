declare global {
  interface Window {
    fbq: (command: string, event: string) => void;
  }
}
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_PIXEL;

export const pageview = () => {
  window.fbq("track", "PageView");
};

// https://developers.facebook.com/docs/facebook-pixel/advanced/
export const event = (name: string) => {
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("trackCustom", name);
  } else {
    console.error("Facebook Pixel is not initialized or fbq is not defined on the window object.");
  }
};
