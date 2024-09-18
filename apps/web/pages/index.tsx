import type { GetServerSidePropsContext } from "next";
import Head from "next/head";
import { useRouter } from "next/navigation";
import nookies from "nookies";

import { getServerSession } from "@calcom/features/auth/lib/getServerSession";
import { DEMO_URL, KEYCLOAK_COOKIE_DOMAIN, SIGNUP_URL, WEBAPP_URL } from "@calcom/lib/constants";

function HomePage({ isLoggedIn }: { isLoggedIn: boolean }) {
  const router = useRouter();
  const handleGotoLoginPage = () => {
    window.location.href = "/auth/login";
  };
  const handleGotoSignupPage = () => {
    handleGettingStarted();
  };
  const handleGettingStarted = () => {
    window.open(SIGNUP_URL, "_blank");
  };

  const handleGoToApp = () => {
    if (process.env.NODE_ENV === "production") {
      const url = new URL(window.location.href);
      const hostnameParts = url.hostname.split(".");

      if (hostnameParts.length === 2) {
        hostnameParts.unshift("app");
        url.hostname = hostnameParts.join(".");
      }

      url.pathname = "/event-types";
      window.location.href = url.href;
    } else {
      // In development or non-production environment
      window.location.href = `${window.location.href}event-types`;
    }
  };

  const handleScheduleDemo = () => {
    window.open(DEMO_URL, "_blank");
  };

  const handleExploreIntegration = () => {
    window.open("https://www.onehash.ai/integrations", "_blank");
  };

  const trustedByLogos = [
    "bms",
    "cloudmojo",
    "moneyplus",
    "msg91",
    "omnify",
    "supersourcing",
    "talentomni",
    "upmetrics",
    "wework",
  ];
  const infoCardData = [
    {
      title: "Sleek URL- It’s just your name!",
      description:
        "No more worrying about remembering the meeting URLs, simply personalize it with OneHash Cal, it could be just your name.",
      image: "/sleek-url",
    },
    {
      title: "Unlimited event  types and links",
      description:
        "Enhance productivity effortlessly with unlimited event types and meeting links,  allowing you to focus on what truly matters.",
      image: "/events",
    },
    {
      title: "Access to multi-calendars",
      description:
        "Blend effortlessly with your favourite tools and apps, expanding your workflow without limits.",
      image: "/calendars",
    },

    {
      title: "Multiple reminder notifications",
      description:
        "Never miss out on important meetings and stay organized and on track with timely reminders.",
      image: "/workflow",
    },

    {
      title: "Useful Insights",
      description:
        "Leverage insightful analytics to optimize your scheduling strategy. Identify booking trends, spot popular events and view bookings across the platform. ",
      image: "/insights",
    },
    {
      title: "Quick customer support",
      description:
        "Don’t worry about getting stuck, in case you do, get instant resolutions from a reliable and rapid customer support team.",
      image: "/support",
    },
  ];

  return (
    <>
      <Head>
        <title>Your Ultimate Free Calendly Pro Alternative</title>
        <meta name="description" content="Learn more about us and what we do." />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Protest+Guerrilla&display=swap"
          rel="stylesheet"
        />
      </Head>
      <div
        className=" min-h-screen bg-white"
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: "400",
          fontStyle: "normal",
        }}>
        {/* SECTION 1  */}
        <div
          id="section1"
          style={{
            backgroundImage: `url('/assets/bg-1.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          className="bg-cover bg-no-repeat">
          <div className="px-8 pt-8 md:px-24">
            {/* HEADER */}
            <header>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <img
                    src="/cal-logo-word.svg"
                    alt="OneHash Logo"
                    className="w-[100px] scale-150 transform md:w-[153px]"
                  />
                </div>

                {/* //TODO:add login and signup links here */}
                {isLoggedIn ? (
                  <>
                    <button
                      onClick={handleGoToApp}
                      className="bg-primary-color hover:bg-hover-primary-color rounded-full px-4 py-2 text-white transition md:px-6">
                      GO TO APP{" "}
                    </button>
                  </>
                ) : (
                  <div className="flex items-center space-x-2 font-semibold md:space-x-4">
                    <button
                      onClick={handleGotoLoginPage}
                      className="border-primary-color rounded-full border px-4 py-2 text-blue-500 hover:text-blue-700 md:px-6">
                      Log in
                    </button>
                    <button
                      onClick={handleGotoSignupPage}
                      className="bg-primary-color hover:bg-hover-primary-color rounded-full px-4 py-2 text-white transition md:px-6">
                      Signup
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* SECTION1 HERO */}
            <div className="mt-20 min-h-[700px]">
              <div className="flex flex-col items-center justify-between md:flex-row">
                <div className="flex flex-col gap-6 md:w-1/3 md:gap-10">
                  <h1 className="text-primary-color mt-8 text-4xl font-semibold lg:text-6xl">
                    Your Ultimate Free Calendly Pro Alternative
                  </h1>

                  <p>
                    Experience All the Calendly Pro Features, Sleek URL, Unlimited Events, Workflows with Zero
                    Subscription Cost
                  </p>
                </div>

                <div className="border-primary-color mt-6 w-full overflow-hidden rounded-lg border p-2 shadow-xl shadow-blue-500/50 md:mt-0 md:w-1/2">
                  <img src="assets/booking-preview.png" alt="booking-preview" className="rounded-lg" />
                </div>
              </div>

              <div id="reviews" className="mt-6">
                <img src="assets/reviews.png" alt="reviews" />
              </div>

              <div id="getting-started" className="mt-16 flex flex-col gap-4 md:flex-row">
                <button
                  onClick={handleGettingStarted}
                  className="bg-primary-color hover:bg-hover-primary-color w-full rounded-full px-6 py-2 text-white transition md:h-14 md:w-40">
                  Get Started
                </button>
                <button
                  onClick={handleScheduleDemo}
                  className="border-primary-color rounded-full border px-6 py-2 text-blue-500 hover:text-blue-700">
                  Schedule a Demo
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 px-8 pb-8 md:mt-0 md:px-24">
          {/* SECTION 2 - TRUSTED BY */}
          <div className="mb-16 flex flex-col items-center gap-4">
            <h1 className="text-2xl font-semibold md:text-4xl">Trusted By</h1>
            <p>Over 32K+ software businesses growing with OneHash Cal</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              {trustedByLogos.map((logo) => {
                return (
                  <img
                    key={logo}
                    src={`assets/trusted-by/${logo}.png`}
                    alt={logo}
                    className="h-fit w-20 md:w-24"
                  />
                );
              })}
            </div>
          </div>

          {/* SECTION 3: WHY CHOOSE ONEHASH CAL */}
          <div className="mb-8 flex flex-col items-center gap-16 text-center md:mb-16">
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-semibold md:text-4xl">
                Unlimited meetings, Unlimited members, <br />
                Unlimited calendars <span className="text-blue-500">Free Forever</span>
              </h1>
              <p>Streamline Your Appointment Scheduling at Your Workplace at No Cost</p>
            </div>

            <div className="flex w-full flex-col gap-8">
              {infoCardData.map((card, i) => {
                return (
                  <InfoCard
                    key={card.title}
                    number={i + 1}
                    heading={card.title}
                    description={card.description}
                    imageSrc={`assets/walkthrough${card.image}.png`}
                  />
                );
              })}
            </div>
          </div>

          {/* SECTION 4: INTEGRATIONS */}
          <div className="mb-8 flex flex-col items-center gap-4 md:mb-16">
            <h1 className="text-2xl font-semibold md:text-4xl">Multiple Integrations</h1>
            <div className="relative mt-3 w-full lg:w-1/2">
              <img src="assets/integrations.svg" alt="integrations" />
              <div className="absolute bottom-10 left-1/2 flex w-full -translate-x-1/2 transform flex-col gap-2 lg:bottom-32 lg:w-auto lg:flex-row">
                <button
                  onClick={handleExploreIntegration}
                  className="bg-primary-color  hover:bg-hover-primary-color h-auto rounded-full px-6 py-2 text-white transition">
                  Explore Integrations
                </button>
                <button
                  onClick={handleScheduleDemo}
                  className="border-primary-color hidden rounded-full border px-6 py-2 text-blue-500 hover:text-blue-700 md:block">
                  Schedule a Demo
                </button>
              </div>
            </div>
          </div>
        </div>
        <footer className="bg-gray-100 px-4 py-8 text-gray-700 md:px-8">
          <div className="container mx-auto ">
            <h5 className="mb-4 text-lg font-semibold">License Notice & Copyright Disclaimer</h5>
            <p className="text-xs text-slate-500 md:text-base">
              OneHash Cal is a fork of & built over the top of Calcom © 2020-present, Cal.com, Inc. Calcom is
              a free software: you can redistribute it and/or modify it under the terms of the GNU Affero
              General Public License as published by the Free Software Foundation, either version 3 of the
              License, or (at your option) any later version.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

const InfoCard = ({
  number,
  heading,
  description,
  imageSrc,
}: {
  number: number;
  heading: string;
  description: string;
  imageSrc: string;
}) => {
  return (
    <div className="relative h-[500px] overflow-hidden rounded-3xl border border-blue-200">
      <div className="flex h-full flex-col lg:flex-row">
        <div className="basis-full lg:basis-1/3">
          <div className="flex h-full w-full flex-col justify-center gap-4 pl-4 text-start lg:gap-6 lg:pl-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-300 p-4 lg:h-16 lg:w-16 lg:p-8">
              <span className="font-semibold">{number}</span>
            </div>
            <h3 className="w-full text-xl font-semibold lg:w-2/3 lg:text-3xl">{heading}</h3>
            <p className="text-gray-600">{description}</p>
          </div>
        </div>
        <div className="basis-full lg:basis-2/3">
          <div className="relative mt-6 px-2 ">
            <img
              className="relative top-0 h-auto min-w-full rounded-lg border-4 border-gray-300 object-fill shadow-xl shadow-blue-500/50 lg:absolute lg:right-[-10%]"
              src={imageSrc}
              alt=""
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { req, res } = context;
  const session = await getServerSession({ req, res });
  const keycloak_cookie_domain = KEYCLOAK_COOKIE_DOMAIN || "";
  const useSecureCookies = WEBAPP_URL?.startsWith("https://");

  if (session?.keycloak_token) {
    nookies.set(context, "keycloak_token", session.keycloak_token, {
      domain: keycloak_cookie_domain,
      sameSite: useSecureCookies ? "none" : "lax",
      path: "/",
      secure: useSecureCookies,
      httpOnly: true,
    });
  }

  return {
    props: {
      isLoggedIn: !!session,
    },
  };
}

export default HomePage;
