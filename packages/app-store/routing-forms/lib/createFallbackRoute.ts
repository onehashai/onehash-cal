import { Utils as QbUtils } from "react-awesome-query-builder";

import type { GlobalRoute, SerializableRoute } from "../types/types";

export const createFallbackRoute = (): Exclude<SerializableRoute, GlobalRoute> => {
  const uuid = QbUtils.uuid();
  return {
    id: uuid,
    isFallback: true,
    action: {
      type: "customPageMessage",
      value: "TEst",
    },
    queryValue: { id: uuid, type: "group" },
  };
};
