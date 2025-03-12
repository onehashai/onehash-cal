import type { ServiceAccount } from "firebase-admin";
import admin from "firebase-admin";

import { FIREBASE_SERVICE_ACCOUNT } from "@calcom/lib/constants";

class FirebaseService {
  private static instance: FirebaseService;

  private constructor() {
    if (!admin.apps.length) {
      if (!FIREBASE_SERVICE_ACCOUNT) {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is not defined");
      }
      let serviceAccount: ServiceAccount;
      try {
        serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
        serviceAccount.privateKey = serviceAccount.privateKey?.replace(/\\n/g, "\n");
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (error) {
        throw new Error(
          error instanceof SyntaxError
            ? "Invalid FIREBASE_SERVICE_ACCOUNT JSON format"
            : "Invalid FIREBASE_SERVICE_ACCOUNT"
        );
      }
    }
  }

  static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  getAdmin(): typeof admin {
    return admin;
  }

  async sendNotification(
    topic: string,
    payload: { title: string; body: string },
    metadata = {}
  ): Promise<string> {
    try {
      const formattedMetadata = Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [key, String(value)])
      );
      //Passing title and body inside data too ,because we are using custom notifications instead of default mobile system ones
      const message = {
        // notification: payload,
        data: { ...formattedMetadata, ...payload },
        topic,
        android: {
          priority: "high" as "high" | "normal",
        },
      };
      const response = await admin.messaging().send(message);
      return response;
    } catch (error) {
      console.error("Error sending notification:", error);
      throw error;
    }
  }
}

export default FirebaseService.getInstance();
