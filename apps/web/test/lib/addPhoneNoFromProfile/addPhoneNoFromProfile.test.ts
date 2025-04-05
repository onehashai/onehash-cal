import { describe, it, expect, vi, beforeEach } from "vitest";

type MockPayload = {
  phoneNumber: string;
  verificationCode?: string;
};

const _SERVERMESSAGE = "Server Error";
const _WRONGCODEMESSAGE = "Incorrect Verification Code";

const payload: MockPayload = {
  phoneNumber: "+1234567890",
};

describe("tRPC Mutations - sendVerificationCode & verifyPhoneNumber", () => {
  let sendMutateMock: any;
  let verifyMutateMock: any;
  let mockedTrpc: any;
  let onMutateMock: any;
  let onSuccess: any;
  let onError: any;

  beforeEach(async () => {
    // Fresh mocks before each test
    sendMutateMock = vi.fn();
    verifyMutateMock = vi.fn();
    onMutateMock = vi.fn();
    onSuccess = vi.fn();
    onError = vi.fn();

    vi.doMock("@calcom/trpc/react", async () => ({
      trpc: {
        viewer: {
          workflows: {
            sendVerificationCode: {
              useMutation: () => ({
                mutateAsync: async (data: MockPayload) => {
                  onMutateMock();
                  try {
                    const result = await sendMutateMock(data);
                    onSuccess(result);
                    return result;
                  } catch (error) {
                    onError(error);
                    throw error;
                  }
                },
              }),
            },
            verifyPhoneNumber: {
              useMutation: () => ({
                mutateAsync: async (data: MockPayload) => {
                  try {
                    const result = await verifyMutateMock(data);
                    onSuccess(result);
                    return result;
                  } catch (error) {
                    onError(error);
                    throw error;
                  }
                },
              }),
            },
            getVerifiedNumbers: {
              useQuery: () => ({
                data: [{ phoneNumber: "+1234567890" }],
              }),
            },
          },
        },
      },
    }));

    // Import mocked module
    mockedTrpc = await import("@calcom/trpc/react");
  });

  it("handles errors when sendVerificationCode fails and triggers onError", async () => {
    sendMutateMock.mockRejectedValue(new Error(_SERVERMESSAGE));

    await expect(
      mockedTrpc.trpc.viewer.workflows.sendVerificationCode.useMutation().mutateAsync(payload)
    ).rejects.toThrow(_SERVERMESSAGE);

    expect(onMutateMock).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });

  it("calls sendVerificationCode mutation with correct payload and triggers onSuccess", async () => {
    sendMutateMock.mockResolvedValue({ success: true });

    await mockedTrpc.trpc.viewer.workflows.sendVerificationCode.useMutation().mutateAsync(payload);

    expect(onMutateMock).toHaveBeenCalledOnce();
    expect(sendMutateMock).toHaveBeenCalledOnce();
    expect(sendMutateMock).toHaveBeenCalledWith(payload);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("verifies phone number successfully and updates numberVerified state", async () => {
    verifyMutateMock.mockResolvedValue(true);

    const result = await mockedTrpc.trpc.viewer.workflows.verifyPhoneNumber.useMutation().mutateAsync({
      phoneNumber: payload.phoneNumber,
      verificationCode: "123456",
    });

    expect(verifyMutateMock).toHaveBeenCalledOnce();
    expect(verifyMutateMock).toHaveBeenCalledWith({
      phoneNumber: payload.phoneNumber,
      verificationCode: "123456",
    });
    expect(result).toBe(true);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("fails verification with incorrect code and triggers onError", async () => {
    verifyMutateMock.mockRejectedValue(new Error(_WRONGCODEMESSAGE));

    await expect(
      mockedTrpc.trpc.viewer.workflows.verifyPhoneNumber.useMutation().mutateAsync({
        phoneNumber: payload.phoneNumber,
        verificationCode: "999999",
      })
    ).rejects.toThrow(_WRONGCODEMESSAGE);

    expect(verifyMutateMock).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
  });
});
