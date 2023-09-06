import type { NextApiRequest, NextApiResponse } from "next/types";

import { sendOTptoEmail } from "@calcom/emails";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("request came", req.body);
  if (req.method !== "POST") {
    return res.status(400).json({ message: "" });
  }
  try {
    const otp = req.body?.otp;
    const to = req.body?.to;
    console.log(otp, to);
    sendOTptoEmail({ otp, to });
    return res.status(201).json({ message: "OTP sent to email" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to send OTP to email" });
  }
}
