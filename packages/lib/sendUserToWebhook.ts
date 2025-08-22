export const sendUserToMakeWebhook = async (userData: {
  id: number;
  email: string;
  name: string;
  username?: string;
  identityProvider: string;
  createdAt?: Date;
}) => {
  try {
    const MAKE_SIGNUP_WEBHOOK_URL = process.env.MAKE_SIGNUP_WEBHOOK_URL;
    if (!MAKE_SIGNUP_WEBHOOK_URL) {
      console.error("MAKE_SIGNUP_WEBHOOK_URL is not defined");
      return;
    }
    const webhookUrl = MAKE_SIGNUP_WEBHOOK_URL;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: userData.id,
        email: userData.email,
        name: userData.name,
        username: userData.username,
        identityProvider: userData.identityProvider,
        createdAt: userData.createdAt || new Date(),
      }),
    });

    if (!response.ok) {
      console.error("Failed to send user data to Make webhook:", response.status, response.statusText);
    } else {
      console.log("Successfully sent user data to Make webhook");
    }
  } catch (error) {
    console.error("Error sending user data to Make webhook:", error);
  }
};
