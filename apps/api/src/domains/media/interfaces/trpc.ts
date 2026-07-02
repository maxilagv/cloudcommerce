import { MediaSignedUrlInputSchema, UpdateMediaAltTextInputSchema } from "@cloudcommerce/validators";
import type { MediaDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, mediaErrorToAppError } from "../../../shared/errors/http-error.js";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";

const throwMedia = (error: MediaDomainError): never => {
  throw appErrorToTrpcError(mediaErrorToAppError(error));
};

export const mediaRouter = router({
  getSignedUrl: adminProcedure.input(MediaSignedUrlInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.media.getSignedUrl(ctx.actor, input.mediaAssetId, input.expiresInSeconds);
    if (!result.ok) {
      return throwMedia(result.error);
    }
    return result.value;
  }),
  updateAltText: adminProcedure.input(UpdateMediaAltTextInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.media.updateAltText(ctx.actor, input.mediaAssetId, input.altText);
    if (!result.ok) {
      return throwMedia(result.error);
    }
    return result.value;
  }),
});
