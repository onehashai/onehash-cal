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
  key_id: string;
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
    const key = props.key_id;
    const data = await fetch(
      `/api/integration/razorpay/create-order?amount=${props.payment.amount}&currency=${props.payment.currency}&bookingId=${props.bookingId}`
    );
    const { order } = await data?.json();
    const options = {
      key: key,
      name: COMPANY_NAME,
      currency: order.currency,
      amount: order.amount,
      order_id: order.id,
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

    paymentObject.on("payment.failed", function (response) {
      showToast(`Payment failed with error: ${response.error.description}`, "error");
      setIsLoading(false);
      router.replace(`/booking/${props.bookingId}?razorpayPaymentStatus=failed`);
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
