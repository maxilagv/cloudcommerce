export const envelope = <T>(data: T, requestId: string) => ({
  data,
  meta: { requestId },
});
