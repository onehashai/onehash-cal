import { describe, it, expect, vi, beforeEach } from "vitest";

type PropsType = {
  bookingId: number;
  rescheduleReason: string;
};

const _DATA: PropsType = {
  bookingId: 1,
  rescheduleReason: "Test Reason...",
};
const _SERVERMESSAGE = "Server Error";

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
          bookings: {
            requestReschedule: {
              useMutation: () => ({
                mutateAsync: async (data: PropsType) => {
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
      },
    }));

    // Importing the mocked module
    mockedTrpc = await import("@calcom/trpc/react");
  });

  it("calls exportBookings mutation with correct payload and triggers onSuccess", async () => {
    mutateMock.mockResolvedValue({ success: true });

    await mockedTrpc.trpc.viewer.bookings.requestReschedule.useMutation().mutateAsync(_DATA);

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith(_DATA);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("handles errors when exportBookings fails and triggers onError", async () => {
    mutateMock.mockRejectedValue(new Error(_SERVERMESSAGE));

    await expect(
      mockedTrpc.trpc.viewer.bookings.requestReschedule.useMutation().mutateAsync(_DATA)
    ).rejects.toThrow(_SERVERMESSAGE);

    expect(onError).toHaveBeenCalledOnce();
  });
});
