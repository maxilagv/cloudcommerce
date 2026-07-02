import {
  AddCustomerAddressSchema,
  CreateCustomerInputSchema,
  GetCustomerAnalyticsSchema,
  GetCustomerDetailSchema,
  ListCustomerContactsSchema,
  LogCustomerContactSchema,
  SearchCustomersSchema,
  SetPrimaryCustomerAddressSchema,
  SoftDeleteCustomerSchema,
  UpdateCustomerAddressSchema,
  UpdateCustomerSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { CustomerDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, customerErrorToAppError } from "../../../shared/errors/http-error.js";

const throwCustomer = (error: CustomerDomainError): never => {
  throw appErrorToTrpcError(customerErrorToAppError(error));
};

const requestContext = (ctx: { ip: string; userAgent: string; requestId: string }, reason?: string | null) => ({
  ip: ctx.ip,
  userAgent: ctx.userAgent,
  requestId: ctx.requestId,
  reason: reason ?? null,
});

export const customersRouter = router({
  search: adminProcedure.input(SearchCustomersSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.customers.search(ctx.actor, input);
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  getDetail: adminProcedure.input(GetCustomerDetailSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.customers.getDetail(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  getAnalytics: adminProcedure.input(GetCustomerAnalyticsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.customers.getAnalytics(ctx.actor, input);
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  listAddresses: adminProcedure.input(GetCustomerDetailSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.customers.listAddresses(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  listContacts: adminProcedure.input(ListCustomerContactsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.customers.listContacts(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  create: adminProcedure.input(CreateCustomerInputSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.create(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  update: adminProcedure.input(UpdateCustomerSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.update(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  addAddress: adminProcedure.input(AddCustomerAddressSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.addAddress(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  updateAddress: adminProcedure.input(UpdateCustomerAddressSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.updateAddress(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  setPrimaryAddress: adminProcedure.input(SetPrimaryCustomerAddressSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.setPrimaryAddress(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  logContact: adminProcedure.input(LogCustomerContactSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.logContact(ctx.actor, input, requestContext(ctx));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),

  softDelete: adminProcedure.input(SoftDeleteCustomerSchema).mutation(async ({ ctx, input }) => {
    const result = await ctx.container.customers.softDelete(ctx.actor, input, requestContext(ctx, input.reason));
    if (!result.ok) {
      return throwCustomer(result.error);
    }
    return result.value;
  }),
});
