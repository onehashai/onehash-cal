import type { CreateInnerContextOptions } from "../../createContext";

type CountryCodeOptions = {
  ctx: CreateInnerContextOptions;
};

export const countryCodeHandler = async ({ ctx }: CountryCodeOptions) => {
  const { req } = ctx;

  // const countryCode: string | string[] = req?.headers?.["x-vercel-ip-country"] ?? "";
  // return { countryCode: Array.isArray(countryCode) ? countryCode[0] : countryCode };

  const forwarded = req?.headers?.["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0] : req?.socket?.remoteAddress;
  let country;
  try {
    if (ip) {
      const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geoData = await geoRes.json();
      if (geoData?.country) {
        country = geoData?.country;
      }
    }
  } catch (err) {
    console.error("Failed to fetch GeoLocation : ", err);
  }
  return { countryCode: Array.isArray(country) ? country[0] : country };
};

export default countryCodeHandler;
