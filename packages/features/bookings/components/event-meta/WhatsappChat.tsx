import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";

export function WhatsappChat({ whatsappNumber }: { whatsappNumber: string }) {
  const generateWhatsAppLink = (phoneNumber: string): string => {
    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");

    const whatsappLink = `https://wa.me/send?phone=${cleanedPhoneNumber}`;

    return whatsappLink;
  };
  const openWhatsAppChat = () => {
    // Dimensions and other properties of the popup window
    const width = 800;
    const height = 600;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    const options = `width=${width},height=${height},left=${left},top=${top},resizable,scrollbars=yes,status=1`;

    //Generating the whatsapp link
    const url = generateWhatsAppLink(whatsappNumber);
    // Open the popup window with the provided URL and options
    window.open(url, "_blank", options);
  };
  const { t } = useLocale();

  return (
    <div onClick={openWhatsAppChat} className="flex cursor-pointer flex-row items-center text-sm font-medium">
      <img
        src="/app-store/whatsapp/icon.svg"
        className={classNames("me-[10px] h-4 w-4")}
        alt="WhatsApp icon"
      />
      <p className="line-clamp-1">{t("whatsapp_chat")}</p>
    </div>
  );
}
