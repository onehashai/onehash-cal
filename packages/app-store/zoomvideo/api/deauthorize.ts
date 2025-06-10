import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const requestBody = req.body;

    // Extract information from the deauthorization payload
    const userId = requestBody.payload.user_id;
    const deauthorizationTime = new Date(requestBody.payload.deauthorization_time);

    // Handle the deauthorization event (implement your logic here)
    console.log(`User ${userId} deauthorized the Zoom app at ${deauthorizationTime}`);

    res.status(200).end("Deauthorization event handled successfully");
  } catch (error) {
    console.error("Error handling deauthorization event:");
    res.status(500).json({ error: "Internal Server Error" });
  }
}
