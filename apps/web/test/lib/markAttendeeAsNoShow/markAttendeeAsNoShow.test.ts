import { describe, it, expect, vi, beforeEach } from "vitest";

const _SERVERMESSAGE = "Server Error";

type AttendeeProps = {
  name?: string;
  email: string;
  phoneNumber: string | null;
  id: number;
  noShow: boolean;
};

type mutateProps = {
  bookingUid: string;
  attendees: AttendeeProps;
};

const _DATA: mutateProps = {
  bookingUid: "1",
  attendees: {
    name: "string",
    email: "string@string.com",
    phoneNumber: "8014978455",
    id: 1,
    noShow: true,
  },
};

describe("tRPC Mutation - exportBookings", () => {
  let mutateMock: any;
  let mockedTrpc: any;
  let onSuccess: any;
  let onError: any;

  beforeEach(async () => {
    // Creating fresh mock functions before each test
    mutateMock = vi.fn();
    onSuccess = vi.fn();
    onError = vi.fn();

    // Applying the mock to tRPC before each test
    vi.doMock("@calcom/trpc/react", async () => ({
      trpc: {
        viewer: {
          markNoShow: {
            useMutation: () => ({
              mutateAsync: async (data: mutateProps) => {
                try {
                  const result = await mutateMock(data);
                  onSuccess(result);
                  return result;
                } catch (error) {
                  onError(error);
                  throw error;
                }
              },
            }),
          },
        },
      },
    }));

    // Importing the mocked module
    mockedTrpc = await import("@calcom/trpc/react");
  });

  it("calls exportBookings mutation with correct payload and triggers onSuccess", async () => {
    mutateMock.mockResolvedValue({ success: true });

    await mockedTrpc.trpc.viewer.markNoShow.useMutation().mutateAsync(_DATA);

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith(_DATA);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("handles errors when exportBookings fails and triggers onError", async () => {
    mutateMock.mockRejectedValue(new Error(_SERVERMESSAGE));

    await expect(mockedTrpc.trpc.viewer.markNoShow.useMutation().mutateAsync(_DATA)).rejects.toThrow(
      _SERVERMESSAGE
    );

    expect(onError).toHaveBeenCalledOnce();
  });
});
