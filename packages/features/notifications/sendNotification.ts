import webpush from "web-push";

const vapidKeys = {
  publicKey:
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "BPFRnZLhSzQkeS8DUmsgIeDU5fLVcsdq7XZUF_bAqaf8yuvwye888sCHXar20eQMLn2uVg6_ONjbtxEU8zABmoA",
  privateKey: process.env.VAPID_PRIVATE_KEY || "lmbP1YbBmb7ehlT6YtLPJzDOdNK7n9jFcOvgEP5DUKU",
};

// The mail to email address should be the one at which push service providers can reach you. It can also be a URL.
if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  throw new Error("VAPID keys are not set. Please check your environment variables.");
}
webpush.setVapidDetails("https://cal.id", vapidKeys.publicKey, vapidKeys.privateKey);

type Subscription = {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
};

export const sendNotification = async ({
  subscription,
  title,
  body,
  icon,
  url,
  actions,
  requireInteraction,
}: {
  subscription: Subscription;
  title: string;
  body: string;
  icon?: string;
  url?: string;
  actions?: { action: string; title: string; type: string; image: string | null }[];
  requireInteraction?: boolean;
}) => {
  try {
    const payload = JSON.stringify({
      title,
      body,
      icon,
      data: {
        url,
      },
      actions,
      requireInteraction,
    });
    await webpush.sendNotification(subscription, payload);
  } catch (error) {
    console.error("Error sending notification", error);
  }
};
