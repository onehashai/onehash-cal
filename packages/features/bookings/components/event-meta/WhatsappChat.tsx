import classNames from "@calcom/lib/classNames";
import { useLocale } from "@calcom/lib/hooks/useLocale";

export function WhatsappChat({ whatsappNumber }: { whatsappNumber: string }) {
  function generateWhatsAppLink(phoneNumber: string): string {
    const cleanedPhoneNumber = phoneNumber.replace(/\D/g, "");

    const whatsappLink = `https://wa.me/send?phone=${cleanedPhoneNumber}`;

    return whatsappLink;
  }
  const { t } = useLocale();

  return (
    <div className="flex flex-row items-center text-sm font-medium">
      <img
        src="/app-store/whatsapp/icon.svg"
        className={classNames("me-[10px] h-4 w-4")}
        alt="WhatsApp icon"
      />
      <a href={generateWhatsAppLink(whatsappNumber)} target="_blank" rel="noopener noreferrer">
        <p className="line-clamp-1">{t("whatsapp_chat")}</p>
      </a>
    </div>
  );
}
