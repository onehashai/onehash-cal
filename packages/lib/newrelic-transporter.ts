import axios from "axios";
import type { ILogObj } from "tslog";

import { IS_DEV } from "@calcom/lib/constants";

const NEW_RELIC_LICENSE_KEY = process.env.NEW_RELIC_LICENSE_KEY;
const NEW_RELIC_APP_NAME = process.env.NEW_RELIC_APP_NAME || "cal-dev";
const NEW_RELIC_LOG_API = "https://log-api.newrelic.com/log/v1";

const BATCH_INTERVAL_MS = 5000;
const MAX_BATCH_SIZE = 20;

interface NewRelicLogEntry {
  message: string;
  timestamp: number;
  logtype: "application";
  service?: string;
  attributes: {
    logLevel?: string;
    fileName?: string;
    name?: string;
    appName: string;
    [key: string]: unknown;
  };
}

let logBuffer: NewRelicLogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

export const newRelicTransport = (logObject: ILogObj): void => {
  if (!NEW_RELIC_LICENSE_KEY || IS_DEV) return;

  const getLogMessage = (logObject: ILogObj): string => {
    if (Array.isArray(logObject.args)) {
      return logObject.args
        .map((arg) => {
          if (typeof arg === "object") {
            return JSON.stringify(arg);
          }
          return String(arg);
        })
        .join(" ");
    }
    return String(logObject.args);
  };

  const entry: NewRelicLogEntry = {
    message: getLogMessage(logObject),
    timestamp: new Date().getTime(),
    logtype: "application",
    service: NEW_RELIC_APP_NAME,
    attributes: {
      ...(logObject._meta as Record<string, unknown>),
      appName: NEW_RELIC_APP_NAME,
    },
  };

  logBuffer.push(entry);

  if (logBuffer.length >= MAX_BATCH_SIZE) {
    flushBuffer();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushBuffer, BATCH_INTERVAL_MS);
  }
};

const flushBuffer = async (): Promise<void> => {
  if (!NEW_RELIC_LICENSE_KEY || logBuffer.length === 0) return;

  const batch: NewRelicLogEntry[] = [...logBuffer];
  logBuffer = [];

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  try {
    const res = await axios.post(NEW_RELIC_LOG_API, batch, {
      headers: {
        "Content-Type": "application/json",
        "X-License-Key": NEW_RELIC_LICENSE_KEY,
      },
    });
    console.log("New Relic log batch sent:", res.status, res.data);
  } catch (err) {
    console.error("New Relic log batch failed:", err);
  }
};
