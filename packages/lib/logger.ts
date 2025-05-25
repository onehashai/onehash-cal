import * as Sentry from "@sentry/nextjs";
import type { ILogObj } from "tslog";
import { Logger } from "tslog";

import { IS_PRODUCTION } from "./constants";

// const stream = fs.createWriteStream("/tmp/nextjs-app.log", { flags: "a" });

// import { newRelicTransport } from "./newrelic-transporter";

// const stream = fs.createWriteStream("/tmp/nextjs-app.log", { flags: "a" });
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

function logLevelToSentry(level: number): Sentry.SeverityLevel {
  switch (level) {
    case 0:
      return "debug";
    case 1:
      return "debug";
    case 2:
      return "info";
    case 3:
      return "warning";
    case 4:
      return "error";
    case 5:
      return "fatal";
    default:
      return "error";
  }
}
const logger = new Logger({
  minLevel: parseInt(process.env.NEXT_PUBLIC_LOGGER_LEVEL || "4"),
  maskValuesOfKeys: ["password", "passwordConfirmation", "credentials", "credential"],
  prettyLogTimeZone: IS_PRODUCTION ? "UTC" : "local",
  prettyErrorStackTemplate: "  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}", // default
  prettyErrorTemplate: "\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}", // default
  prettyLogTemplate: "{{hh}}:{{MM}}:{{ss}}:{{ms}} [{{logLevelName}}] ", // default with exclusion of `{{filePathWithLine}}`
  stylePrettyLogs: true,
  prettyLogStyles: {
    name: "yellow",
    dateIsoStr: "blue",
  },
  argumentsArrayName: "args",

  attachedTransports: [
    (logObject) => {
      // Only forward errors to Sentry
      if (logObject._meta.logLevelId >= parseInt(process.env.NEXT_PUBLIC_SENTRY_LOG_LEVEL || "5")) {
        const message = getLogMessage(logObject);
        Sentry.captureMessage(message, {
          level: logLevelToSentry(logObject._meta.logLevelId),
        });
      }
    },
  ],
});

// const formatLogService = (logObject: ILogObjMeta) => {};

export default logger;
