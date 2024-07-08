import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc";
import { Button, showToast, TextField } from "@calcom/ui";
import { Icon } from "@calcom/ui";

export default function RazorpaySetup() {
  const [newMerchantId, setNewMerchantId] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newSecretKey, setNewSecretKey] = useState("");
  const router = useRouter();
  const { t } = useLocale();
  const integrations = trpc.viewer.integrations.useQuery({ variant: "payment", appId: "razorpay" });
  const [razorpayPaymentAppCredentials] = integrations.data?.items || [];
  const [credentialId] = razorpayPaymentAppCredentials?.userCredentialIds || [-1];
  const showContent = !!integrations.data && integrations.isSuccess && !!credentialId;
  const saveKeysMutation = trpc.viewer.appsRouter.updateAppCredentials.useMutation({
    onSuccess: () => {
      showToast(t("keys_have_been_saved"), "success");
      router.push("/event-types");
    },
    onError: (error) => {
      console.log("in onError", error);
      showToast(error.message, "error");
    },
  });

  if (integrations.isPending) {
    return <div className="absolute z-50 flex h-screen w-full items-center bg-gray-200" />;
  }

  return (
    <div className="bg-default flex h-screen">
      {showContent ? (
        <div className="bg-default border-subtle m-auto max-w-[43em] overflow-auto rounded border pb-10 md:p-10">
          <div className="ml-2 md:ml-5 ltr:mr-2 rtl:ml-2">
            <div className="invisible md:visible">
              <img className="h-11" src="/api/app-store/razorpay/icon.png" alt="Razorpay Payment Logo" />
              <p className="text-default mt-5 text-lg">Razorpay</p>
            </div>
            <form autoComplete="off" className="mt-5">
              <TextField
                label="Merchant Id"
                type="text"
                name="merchant_id"
                id="merchant_id"
                value={newMerchantId}
                onChange={(e) => setNewMerchantId(e.target.value)}
                role="presentation"
              />
              <TextField
                label="Client Id"
                type="text"
                name="key_id"
                id="key_id"
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                role="presentation"
              />

              <TextField
                label="Secret Key"
                type="password"
                name="access_token"
                id="access_token"
                value={newSecretKey}
                autoComplete="new-password"
                role="presentation"
                onChange={(e) => setNewSecretKey(e.target.value)}
              />

              {/* Button to submit */}
              <div className="mt-5 flex flex-row justify-end">
                <Button
                  color="secondary"
                  onClick={() => {
                    saveKeysMutation.mutate({
                      credentialId,
                      key: {
                        key_id: newClientId,
                        key_secret: newSecretKey,
                        merchant_id: newMerchantId,
                      },
                    });
                  }}>
                  {t("save")}
                </Button>
              </div>
            </form>
            <div>
              <p className="text-lgf text-default mt-5 font-bold">Getting started with Razorpay APP</p>
              <p className="text-default font-semi mt-2">
                Here in OneHash Cal we offer Razorpay as one of our payment gateway. You can use your own
                Razorpay Business account to receive payments from your customers enabling and setting up
                price and currency for each of your event types.
              </p>

              <p className="text-lgf text-default mt-5 inline-flex font-bold">
                <Icon name="circle-alert" className="mr-2 mt-1 h-4 w-4" /> Important requirements:
              </p>
              <ul className="text-default ml-1 mt-2 list-disc pl-2">
                <li>Razorpay Business account</li>
                <li>Razorpay Developer account</li>
              </ul>

              <p className="text-default mb-2 mt-5 font-bold">Resources:</p>
              <a
                className="text-orange-600 underline"
                target="_blank"
                href="https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/">
                Link to Razorpay developer API REST Setup Guide:
                https://razorpay.com/docs/payments/dashboard/account-settings/api-keys
              </a>

              <p className="text-lgf text-default mt-5 font-bold">Setup instructions</p>

              <ol className="text-default ml-1 mt-5 list-decimal pl-2">
                {/* @TODO: translate */}
                <li>
                  Log in to your Razorpay Dashboard with appropriate credentials.
                  <a
                    target="_blank"
                    href="https://dashboard.razorpay.com/signin?screen=sign_in"
                    className="text-orange-600 underline">
                    {t("here")}
                  </a>
                  .
                </li>
                <li>Select the Live mode to generate the API key.</li>
                <li>
                  Navigate to Account & Settings → API Keys (under Website and app settings) → Generate Key to
                  generate key for the selected mode.
                </li>

                <li>Copy The Key Id and Key Secret which appear on a pop-up page.</li>
                <li>Paste them on the required field and save them.</li>
                <li>You should be all setup after this.</li>
              </ol>
              <p className="text-default mt-5 inline-flex font-bold">
                <Icon name="circle-alert" className="mr-2 mt-1 h-4 w-4" />
                Reminder:
              </p>
              <p className="text-default mt-2">
                Our integration creates a specific webhook on your Razorpay account that we use to report back
                transactions to our system. If you delete this webhook, we will not be able to report back and
                you should Uninstall and Install the app again for this to work again. Uninstalling the app
                won&apos;t delete your current event type price/currency configuration but you would not be
                able to receive bookings.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="ml-5 mt-5">
          <div>Razorpay</div>
          <div className="mt-3">
            <Link href="/apps/razorpay" passHref={true} legacyBehavior>
              <Button>{t("go_to_app_store")}</Button>
            </Link>
          </div>
        </div>
      )}
      <Toaster position="bottom-right" />
    </div>
  );
}
