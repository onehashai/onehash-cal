import type { NextSeoProps } from "next-seo";
import { NextSeo } from "next-seo";
import { usePathname } from "next/navigation";

import type { AppImageProps, MeetingImageProps } from "@calcom/lib/OgImages";
import { constructAppImage, constructGenericImage, constructMeetingImage } from "@calcom/lib/OgImages";
import { APP_NAME, CAL_URL } from "@calcom/lib/constants";
import { buildCanonical, getSeoImage, seoConfig } from "@calcom/lib/next-seo.config";
import { truncateOnWord } from "@calcom/lib/text";

export type HeadSeoProps = {
  title: string;
  description: string;
  siteName?: string;
  url?: string;
  canonical?: string;
  nextSeoProps?: NextSeoProps;
  app?: AppImageProps;
  meeting?: MeetingImageProps;
  isBrandingHidden?: boolean;
  origin?: string;
  bannerUrl?: string;
};

/**
 * Build full seo tags from title, desc, canonical and url
 */
const buildSeoMeta = (pageProps: {
  title: string;
  description: string;
  image: string;
  siteName?: string;
  url?: string;
  canonical?: string;
}) => {
  const { title, description, image, canonical, siteName = seoConfig.headSeo.siteName } = pageProps;
  return {
    title: title,
    canonical: canonical,
    openGraph: {
      site_name: siteName,
      type: "website",
      title: title,
      description: description,
      images: [
        {
          url: image,
        },
      ],
    },
    additionalMetaTags: [
      {
        property: "name",
        content: title,
      },
      {
        property: "description",
        content: description,
      },
      {
        name: "description",
        content: description,
      },
      {
        property: "image",
        content: image,
      },
    ],
  };
};

export const HeadSeo = (props: HeadSeoProps): JSX.Element => {
  const path = usePathname();

  // The below code sets the defaultUrl for our canonical tags
  // Get the router's path
  // Set the default URL to either the current URL (if self-hosted) or https://cal.com canonical URL
  const defaultUrl = buildCanonical({ path, origin: props.origin || CAL_URL });

  const {
    title,
    description,
    siteName,
    canonical = defaultUrl,
    nextSeoProps = {},
    app,
    meeting,
    isBrandingHidden,
  } = props;

  const truncatedDescription = truncateOnWord(description, 158);
  const pageTitle = `${title}${isBrandingHidden ? "" : ` | ${APP_NAME}`}`;

  // Function to construct the image based on the type of content
  const getImage = () => {
    if (meeting) {
      return getSeoImage("ogImage") + constructMeetingImage(meeting);
    }
    if (app) {
      return getSeoImage("ogImage") + constructAppImage({ ...app, description: truncatedDescription });
    }
    return getSeoImage("ogImage") + constructGenericImage({ title, description });
  };

  const image = getImage();
  const seoObject = buildSeoMeta({
    title: pageTitle,
    image,
    description: truncatedDescription,
    canonical,
    siteName,
  });

  const seoProps: NextSeoProps = {
    ...nextSeoProps,
    ...seoObject,
    openGraph: {
      ...nextSeoProps.openGraph,
      ...seoObject.openGraph,
      images: [...(nextSeoProps.openGraph?.images || []), ...seoObject.openGraph.images],
    },
    additionalMetaTags: [...(nextSeoProps.additionalMetaTags || []), ...seoObject.additionalMetaTags],
  };

  return <NextSeo {...seoProps} />;
};

export default HeadSeo;
