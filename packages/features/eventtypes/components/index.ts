import dynamic from "next/dynamic";

export { default as CheckedTeamSelect } from "./CheckedTeamSelect";
export { default as CreateEventTypeDialog } from "./CreateEventTypeDialog";
export { default as EventTypeDescription } from "./EventTypeDescription";
export { MultiplePrivateLinksController } from "./MultiplePrivateLinksController";
export const EventTypeDescriptionLazy = dynamic(() => import("./EventTypeDescription"));
export const CardDescriptionLazy = dynamic(() =>
  import("./EventTypeDescription").then((mod) => mod.CardDescription)
);
export { default as EventTypeIconCard } from "./EventTypeIconCard";
