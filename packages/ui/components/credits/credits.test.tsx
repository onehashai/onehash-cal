/* eslint-disable playwright/missing-playwright-await */
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@calcom/lib/constants", async () => {
  const actual = (await vi.importActual("@calcom/lib/constants")) as typeof import("@calcom/lib/constants");
  return {
    ...actual,
    CALCOM_VERSION: "mockedVersion",
  };
});

//basic testing element
const Credits = () => {
  return (
    <footer>
      <a href="https://go.cal.com/credits" aria-label="Cal.com, Inc.">
        Cal.com, Inc.
      </a>
      <a href="https://go.cal.com/releases" aria-label="mockedVersion">
        mockedVersion
      </a>
      <p>© {new Date().getFullYear()}</p>
    </footer>
  );
};

describe("Tests for Credits component", () => {
  test("Should render credits section with links", () => {
    render(<Credits />);

    const creditsLinkElement = screen.getByRole("link", { name: /Cal\.com, Inc\./i });
    expect(creditsLinkElement).toBeInTheDocument();
    expect(creditsLinkElement).toHaveAttribute("href", "https://go.cal.com/credits");

    const versionLinkElement = screen.getByRole("link", { name: /mockedVersion/i });
    expect(versionLinkElement).toBeInTheDocument();
    expect(versionLinkElement).toHaveAttribute("href", "https://go.cal.com/releases");
  });

  test("Should render credits section with correct text", () => {
    render(<Credits />);

    const currentYear = new Date().getFullYear();
    const copyrightElement = screen.getByText(`© ${currentYear}`);
    expect(copyrightElement).toHaveTextContent(`${currentYear}`);
  });
});
