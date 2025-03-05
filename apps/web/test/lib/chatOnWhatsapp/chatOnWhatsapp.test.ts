import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const _WHATSAPPAPPBASEURL = "https://api.whatsapp.com/send";
const _WHATSAPPWEBBASEURL = "https://web.whatsapp.com/send";

describe("check if WhatsApp app & web opens", () => {
  let openSpy;

  beforeEach(() => {
    //since provider doesnt have window object defined, i define it here manually
    global.window = {};
    global.window.open = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const phoneNumber = "+1234567890"; // Example phone number
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");
  const urlEncodedTextMessage = encodeURIComponent(`Hi, I'm running late by 5 minutes. I'll be there soon.`);

  it("opens WhatsApp Web URL correctly", () => {
    const whatsappWebLink = `${_WHATSAPPWEBBASEURL}?phone=${cleanedPhoneNumber}&text=${urlEncodedTextMessage}`;
    window.open(whatsappWebLink, "_blank");

    expect(window.open).toHaveBeenCalledWith(whatsappWebLink, "_blank");
  });

  it("opens WhatsApp App URL correctly", () => {
    const whatsappAppLink = `${_WHATSAPPAPPBASEURL}?phone=${cleanedPhoneNumber}&text=${urlEncodedTextMessage}`;
    window.open(whatsappAppLink, "_blank");

    expect(window.open).toHaveBeenCalledWith(whatsappAppLink, "_blank");
  });
});
