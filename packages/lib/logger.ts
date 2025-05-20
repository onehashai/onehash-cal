import { Logger } from "tslog";

import { IS_PRODUCTION } from "./constants";
import { newRelicTransport } from "./newrelic-transporter";

// const stream = fs.createWriteStream("/tmp/nextjs-app.log", { flags: "a" });

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
      // stream.write(`${JSON.stringify(logObject)}\n`);
      newRelicTransport(logObject);
    },
  ],
});

// const formatLogService = (logObject: ILogObjMeta) => {};

export default logger;
