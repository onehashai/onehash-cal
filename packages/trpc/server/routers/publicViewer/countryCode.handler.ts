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
  let country = "IN";
  try {
    if (ip) {
      const apiKey = process.env.GEOLOCATION_API_KEY;
      // const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
      const geoRes = await fetch(`https://api.ipgeolocation.io/v2/ipgeo?apiKey=${apiKey}&ip=${ip}`);
      const geoData = await geoRes.json();
      country = geoData.location.country_code2;
    }
  } catch (err) {
    console.error("Failed to fetch GeoLocation : ", err);
  }
  return { countryCode: country };
};

export default countryCodeHandler;
