import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const BATCH_SIZE = 20;
const WAIT_MS = 2000;
interface EventTypeWithMetadata {
  id: number;
  title: string;
  description: string | null;
  metadata: any;
}
interface IconColorResult {
  title: string;
  icon: string;
  color: string;
}
async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchEventBatch(skip: number, take: number): Promise<EventTypeWithMetadata[]> {
  return prisma.eventType.findMany({
    skip,
    take,
    select: { id: true, title: true, description: true, metadata: true },
  });
}
async function fetchIconsForEvents(
  events: { title: string; description: string | null }[]
): Promise<IconColorResult[]> {
  const tailwindTextColors = [
    "text-red-600",
    "text-yellow-500",
    "text-green-600",
    "text-blue-600",
    "text-purple-600",
    "text-pink-600",
    "text-orange-500",
    "text-emerald-600",
  ];
  const lucideIcons = [
    "Calendar",
    "Clock",
    "AlarmClock",
    "User",
    "Users",
    "Phone",
    "Video",
    "Mic",
    "Mail",
    "MapPin",
    "Globe",
    "Briefcase",
    "Handshake",
    "BookOpen",
    "Presentation",
    "Lightbulb",
    "PenTool",
    "Monitor",
    "Settings",
    "CheckCircle",
    "Star",
    "Heart",
    "Play",
    "Tag",
    "Share2",
    "Repeat",
    "RefreshCcw",
    "RotateCcw",
    "History",
  ];

  const prompt = `
You are an assistant that suggests most relevant UI icons and Tailwind CSS text color classes for event types based on their title and description.
Return a JSON array like:
[
  { "title": "Event Title", "icon": "LucideIcon", "color": "TailwindColorClass" },
  ...
]
Only select an icon from the given list: ${lucideIcons.join(", ")}.
Only select from the list of given Tailwind CSS text color classes: ${tailwindTextColors.join(", ")}.
Do not return any extra explanation or formatting.

Events:
${events
  .map((e) => `{"title": "${e.title}", "description": "${e.description?.replace(/\n/g, " ") || ""}"}`)
  .join(",\n")}
`;

  const res = await axios.post(
    OPENAI_ENDPOINT,
    {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    },
    {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  let content = res.data.choices[0].message.content?.trim();

  // Strip markdown code blocks if accidentally included
  if (content.startsWith("```")) {
    content = content.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, "$1").trim();
  }

  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) throw new Error("Expected JSON array from OpenAI");
    return parsed;
  } catch (err) {
    throw new Error(`Failed to parse OpenAI response: ${content}`);
  }
}

async function updateEventTypeMetadata() {
  const totalCount = await prisma.eventType.count();
  for (let skip = 0; skip < totalCount; skip += BATCH_SIZE) {
    const batch = await fetchEventBatch(skip, BATCH_SIZE);
    if (batch.length === 0) break;
    const iconResults = await fetchIconsForEvents(
      batch.map((e) => ({ title: e.title, description: e.description }))
    );
    const resultMap = new Map<string, IconColorResult>();
    iconResults.forEach((res) => resultMap.set(res.title, res));
    await Promise.all(
      batch.map((event) => {
        const result = resultMap.get(event.title);
        if (!result) return null;
        const updatedMetadata = {
          ...(event.metadata || {}),
          iconParams: {
            icon: result.icon,
            color: result.color,
          },
        };
        console.log(`Updating event ${event.id} with icon: ${result.icon}, color: ${result.color}`);
        return prisma.eventType.update({
          where: { id: event.id },
          data: { metadata: updatedMetadata },
        });
      })
    );
    console.log(`✅ Processed batch ${skip / BATCH_SIZE + 1}`);
    await sleep(WAIT_MS);
  }
}
updateEventTypeMetadata()
  .then(() => {
    console.log("🎉 All event types updated with iconParams.");
    prisma.$disconnect();
  })
  .catch((err) => {
    console.error("❌ Error updating event types:", err);
    prisma.$disconnect();
  });

// //REMOVE SCRIPT
// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// async function removeIconParamsFromMetadata() {
//   const allEvents = await prisma.eventType.findMany({
//     select: { id: true, metadata: true },
//   });

//   const updates = allEvents.map((event) => {
//     const metadata = event.metadata || {};
//     if (metadata.iconParams) {
//       delete metadata.iconParams;
//       return prisma.eventType.update({
//         where: { id: event.id },
//         data: { metadata },
//       });
//     }
//     return null;
//   });

//   const validUpdates = updates.filter(Boolean);

//   await Promise.all(validUpdates);
//   console.log(`✅ Removed iconParams from ${validUpdates.length} event types.`);
// }

// removeIconParamsFromMetadata()
//   .then(() => prisma.$disconnect())
//   .catch((err) => {
//     console.error("❌ Failed to remove iconParams:", err);
//     prisma.$disconnect();
//   });
