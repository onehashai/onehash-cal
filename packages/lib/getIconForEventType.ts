import axios from "axios";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface EventVisualSuggestion {
  icon: string; // should match a Lucide icon name
  color: string; // hex format
}

export async function getEventIconAndColor(
  title: string,
  description: string
): Promise<EventVisualSuggestion> {
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
    "DollarSign",
  ];

  const prompt = `
You are an assistant that suggests most relevant UI icons and Tailwind CSS text color classes for event types based on their title and description.
Respond ONLY with a single valid JSON object like this:
{ "icon": "LucideIconName", "color": "TailwindColorClass" }

Only select an icon from the given list:
${lucideIcons.join(", ")}

Only select from the list of given Tailwind CSS text color classes:
${tailwindTextColors.join(", ")}

Title: "${title}"
Description: "${description.replace(/\n/g, " ")}"
`;

  const response = await axios.post(
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

  let text = response.data.choices[0].message.content?.trim();

  // Remove ```json ... ``` if model includes it
  if (text.startsWith("```")) {
    text = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/, "$1").trim();
  }

  try {
    const parsed = JSON.parse(text);
    console.log("parsed_", parsed);
    if (
      typeof parsed.icon !== "string" ||
      typeof parsed.color !== "string" ||
      !lucideIcons.includes(parsed.icon) ||
      !tailwindTextColors.includes(parsed.color)
    ) {
      throw new Error("Invalid or unexpected icon or color");
    }

    return parsed as EventVisualSuggestion;
  } catch (err) {
    throw new Error(`Failed to parse OpenAI response: ${text}`);
  }
}
