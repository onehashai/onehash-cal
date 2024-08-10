import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useState } from "react";

import { COMPANY_NAME } from "@calcom/lib/constants";
import { Button, showToast } from "@calcom/ui";

declare global {
  interface Window {
    Razorpay: any;
  }
}
interface IRazorpayPaymentComponentProps {
  payment: {
    currency: string;
    amount: number;
    data: unknown;
  };
  bookingId: string;
}

const RazorpayPaymentComponent = (props: IRazorpayPaymentComponentProps) => {
  const { data: userData } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  //helper function to load Razorpay client side script
  function loadScript(src: string) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        reject(false);
      };
      document.body.appendChild(script);
    });
  }

  // //load Razorpay client side script on component mount
  // useEffect(() => {
  //   if (!window.Razorpay) loadScript("https://checkout.razorpay.com/v1/checkout.js");
  // }, []);

  const makePayment = async () => {
    if (!userData) return;
    if (!window.Razorpay)
      try {
        loadScript("https://checkout.razorpay.com/v1/checkout.js");
      } catch (e) {
        showToast("Failed to instantiate Razorpay. Please try again.", "error");
        return;
      }

    setIsLoading(true);
    const data = await fetch(`/api/integration/razorpay/get-order?bookingId=${props.bookingId}`);
    const { currency, amount, order_id, key } = await data?.json();
    const options = {
      key,
      name: COMPANY_NAME,
      currency,
      amount,
      order_id,
      modal: {
        ondismiss: function () {
          setIsLoading(false);
        },
      },
      handler: async function (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) {
        const data = await fetch("/api/integration/razorpay/capture", {
          method: "POST",
          body: JSON.stringify({
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
            bookingId: props.bookingId,
          }),
        });

        const res = await data.json();
        if (res.isOk) {
          router.replace(res.redirect);
        } else {
          showToast(`Error: ${res.message}`, "error");
          if (res.redirect) router.replace(res.redirect);
        }
      },
      prefill: {
        email: userData.user?.email,
        name: userData.user?.name,
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.open();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paymentObject.on("payment.failed", async function (response: any) {
      const res =
        await fetch(`/api/integration/razorpay/validate?paymentId=${response.error.metadata.order_id}&
        bookingId=${props.bookingId}
        `);
      if (res.ok) {
        const { isCaptured } = await res.json();
        if (isCaptured) {
          router.replace(`/booking/${props.bookingId}?razorpayPaymentStatus=success`);
        } else {
          showToast(`Payment failed with error: ${response.error.description}`, "error");
          router.replace(`/booking/${props.bookingId}?razorpayPaymentStatus=failed
          }`);
        }
      }
      setIsLoading(false);
    });
  };

  return (
    <>
      <Script id="razorpay-checkout-js" src="https://checkout.razorpay.com/v1/checkout.js" />
      <div className="">
        <Button disabled={isLoading} onClick={makePayment}>
          Pay Now
        </Button>
      </div>
    </>
  );
};

export default RazorpayPaymentComponent;
