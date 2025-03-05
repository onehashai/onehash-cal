import { describe, it, expect, vi, beforeEach } from "vitest";

type MockPayload = {
  bookingId: number;
  meetingNote: string;
};

const _SERVERMESSAGE = "Server Error";

const payload: MockPayload = {
  bookingId: 1,
  meetingNote: "Test content",
};

describe("tRPC Mutation - saveNote", () => {
  let mutateMock: any;
  let mockedTrpc: any;
  let onSuccess: any;
  let onError: any;

  beforeEach(async () => {
    // creating fresh mock functions before each test
    mutateMock = vi.fn();
    onSuccess = vi.fn();
    onError = vi.fn();

    // applying the mock to tRPC before each test
    vi.doMock("@calcom/trpc/react", async () => ({
      trpc: {
        viewer: {
          bookings: {
            saveNote: {
              useMutation: () => ({
                mutateAsync: async (data: MockPayload) => {
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

    // importing the mocked module
    mockedTrpc = await import("@calcom/trpc/react");
  });

  it("handles errors when saveNote fails and triggers onError", async () => {
    mutateMock.mockRejectedValue(new Error(_SERVERMESSAGE));

    await expect(mockedTrpc.trpc.viewer.bookings.saveNote.useMutation().mutateAsync(payload)).rejects.toThrow(
      _SERVERMESSAGE
    );

    expect(onError).toHaveBeenCalledOnce();
  });

  it("calls saveNote mutation with correct payload and triggers onSuccess", async () => {
    mutateMock.mockResolvedValue({ success: true });

    await mockedTrpc.trpc.viewer.bookings.saveNote.useMutation().mutateAsync(payload);

    expect(mutateMock).toHaveBeenCalledOnce();
    expect(mutateMock).toHaveBeenCalledWith(payload);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
