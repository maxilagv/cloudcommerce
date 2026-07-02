import {
  CustomerTier,
  type Actor,
  type CustomerAddressResponse,
  type CustomerAnalytics,
  type CustomerContactLogResponse,
  type CustomerDetail,
  type CustomerSearchResult,
  type CustomerSummary,
} from "@cloudcommerce/types";
import type {
  AddCustomerAddressInput,
  CreateCustomerInput,
  GetCustomerAnalyticsInput,
  GetCustomerDetailInput,
  ListCustomerContactsInput,
  LogCustomerContactInput,
  SearchCustomersInput,
  SetPrimaryCustomerAddressInput,
  SoftDeleteCustomerInput,
  UpdateCustomerAddressInput,
  UpdateCustomerInput,
} from "@cloudcommerce/validators";
import { err, ok, type Result } from "../../../shared/domain/result.js";
import type { CustomerDomainError } from "../../../shared/errors/domain-error.js";
import {
  canDeleteCustomers,
  canManageCustomers,
  canReadCustomerAnalytics,
  canReadCustomers,
  canViewCustomerInvestment,
  canViewSensitiveCustomerData,
  requiresSensitiveCustomerReason,
} from "../domain/customer-permissions.js";
import type { CustomerPurchaseAnalyticsPort } from "./customer-analytics-port.js";
import type {
  CreateCustomerAddressRecord,
  CustomerAddressEntity,
  CustomerAggregate,
  CustomerContactLogEntity,
  CustomerEntity,
  CustomerRepository,
  CustomerSearchRow,
  RequestAuditContext,
  UpdateCustomerAddressRecord,
  UpdateCustomerRecord,
} from "./customer-repository.js";

type RequestContext = {
  ip: string;
  userAgent: string;
  requestId: string;
  reason?: string | null;
};

export class CustomerService {
  public constructor(
    private readonly repository: CustomerRepository,
    private readonly purchaseAnalytics: CustomerPurchaseAnalyticsPort,
  ) {}

  public async search(actor: Actor, input: SearchCustomersInput): Promise<Result<CustomerSearchResult, CustomerDomainError>> {
    if (!canReadCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const result = await this.repository.searchCustomers({
      q: input.q?.trim() ? input.q.trim() : null,
      sort: input.sort,
      cursor: input.cursor ?? null,
      limit: input.limit,
    });
    const includeSensitive = !requiresSensitiveCustomerReason(actor);
    return ok({
      items: result.rows.map((row) => this.presentSummary(row, includeSensitive)),
      nextCursor: result.nextCursor,
    });
  }

  public async create(
    actor: Actor,
    input: CreateCustomerInput,
    context: RequestContext,
  ): Promise<Result<CustomerDetail, CustomerDomainError>> {
    if (!canManageCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (input.initialAddress && !canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const email = input.email ?? null;
    if (email) {
      const existing = await this.repository.findActiveCustomerByEmail(email);
      if (existing) {
        return err({ type: "DUPLICATE_CUSTOMER_EMAIL" });
      }
    }
    const aggregate = await this.repository.createCustomer(
      {
        firstName: input.firstName,
        lastName: input.lastName,
        displayName: this.displayName(input.firstName, input.lastName),
        email,
        whatsapp: this.normalizeWhatsapp(input.whatsapp),
        notes: input.notes ?? null,
        tier: CustomerTier.CloudBase,
        initialAddress: input.initialAddress ? this.addressRecord(input.initialAddress, true) : null,
      },
      this.audit(actor, context, input.reason ?? "customer.create"),
    );
    return ok(this.presentDetail(aggregate));
  }

  public async update(
    actor: Actor,
    input: UpdateCustomerInput,
    context: RequestContext,
  ): Promise<Result<CustomerDetail, CustomerDomainError>> {
    if (!canManageCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if ((input.whatsapp !== undefined || input.email !== undefined) && !canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const current = await this.repository.findActiveCustomerById(input.customerId);
    if (!current) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    if (input.email) {
      const existing = await this.repository.findActiveCustomerByEmail(input.email);
      if (existing && existing.id !== input.customerId) {
        return err({ type: "DUPLICATE_CUSTOMER_EMAIL" });
      }
    }
    const record: UpdateCustomerRecord = { customerId: input.customerId };
    const nextFirstName = input.firstName ?? current.firstName;
    const nextLastName = input.lastName ?? current.lastName;
    if (input.firstName !== undefined) record.firstName = input.firstName;
    if (input.lastName !== undefined) record.lastName = input.lastName;
    if (input.firstName !== undefined || input.lastName !== undefined) {
      record.displayName = this.displayName(nextFirstName, nextLastName);
    }
    if (input.email !== undefined) record.email = input.email;
    if (input.whatsapp !== undefined) record.whatsapp = this.normalizeWhatsapp(input.whatsapp);
    if (input.notes !== undefined) record.notes = input.notes;
    const updated = await this.repository.updateCustomer(record, this.audit(actor, context, input.reason ?? "customer.update"));
    if (!updated) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    return ok(this.presentDetail(updated));
  }

  public async getDetail(
    actor: Actor,
    input: GetCustomerDetailInput,
    context: RequestContext,
  ): Promise<Result<CustomerDetail, CustomerDomainError>> {
    if (!canReadCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const aggregate = await this.repository.getCustomerAggregate(input.customerId);
    if (!aggregate) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    if (requiresSensitiveCustomerReason(actor)) {
      await this.repository.recordSensitiveAccess(
        { customerId: input.customerId, action: "view_sensitive" },
        this.audit(actor, context, input.reason ?? "customer.detail"),
      );
    }
    return ok(this.presentDetail(aggregate));
  }

  public async getAnalytics(
    actor: Actor,
    input: GetCustomerAnalyticsInput,
  ): Promise<Result<CustomerAnalytics, CustomerDomainError>> {
    if (!canReadCustomerAnalytics(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const customer = await this.repository.findActiveCustomerById(input.customerId);
    if (!customer) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    const includeSensitiveInvestment = canViewCustomerInvestment(actor);
    const [stats, purchase] = await Promise.all([
      this.repository.getContactStats(input.customerId),
      this.purchaseAnalytics.getCustomerAnalytics({
        customerId: input.customerId,
        range: input.range,
        breakdown: input.breakdown,
        includeSensitiveInvestment,
      }),
    ]);
    const base: CustomerAnalytics = {
      customerId: input.customerId,
      range: input.range,
      ordersCount: purchase.ordersCount,
      totalSpent: purchase.totalSpent,
      totalSaved: purchase.totalSaved,
      callsCount: stats.callsCount,
      contactsCount: stats.contactsCount,
      aov: purchase.aov,
      lastOrderAt: purchase.lastOrderAt,
      lastContactAt: stats.lastContactAt,
      spendingSeries: purchase.spendingSeries,
      purchaseBreakdown: purchase.purchaseBreakdown,
      purchaseHistory: purchase.purchaseHistory,
      investedAvailable: false,
    };
    if (includeSensitiveInvestment && purchase.totalInvested && purchase.margin) {
      return ok({
        ...base,
        totalInvested: purchase.totalInvested,
        margin: purchase.margin,
        investedAvailable: true,
      });
    }
    return ok(base);
  }

  public async addAddress(
    actor: Actor,
    input: AddCustomerAddressInput,
    context: RequestContext,
  ): Promise<Result<CustomerAddressResponse, CustomerDomainError>> {
    if (!canManageCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const customer = await this.repository.findActiveCustomerById(input.customerId);
    if (!customer) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    const address = await this.repository.addAddress(
      input.customerId,
      this.addressRecord(input, input.isPrimary),
      this.audit(actor, context, input.reason ?? "customer_address.add"),
    );
    if (!address) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    return ok(this.presentAddress(address));
  }

  public async updateAddress(
    actor: Actor,
    input: UpdateCustomerAddressInput,
    context: RequestContext,
  ): Promise<Result<CustomerAddressResponse, CustomerDomainError>> {
    if (!canManageCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const record: UpdateCustomerAddressRecord = {
      customerId: input.customerId,
      addressId: input.addressId,
    };
    if (input.label !== undefined) record.label = input.label;
    if (input.recipientName !== undefined) record.recipientName = input.recipientName;
    if (input.province !== undefined) record.province = input.province;
    if (input.city !== undefined) record.city = input.city;
    if (input.street !== undefined) record.street = input.street;
    if (input.streetNumber !== undefined) record.streetNumber = input.streetNumber;
    if (input.betweenStreets !== undefined) record.betweenStreets = input.betweenStreets;
    if (input.postalCode !== undefined) record.postalCode = input.postalCode;
    if (input.isPrimary !== undefined) record.isPrimary = input.isPrimary;
    const address = await this.repository.updateAddress(record, this.audit(actor, context, input.reason ?? "customer_address.update"));
    if (!address) {
      return err({ type: "ADDRESS_NOT_FOUND" });
    }
    return ok(this.presentAddress(address));
  }

  public async setPrimaryAddress(
    actor: Actor,
    input: SetPrimaryCustomerAddressInput,
    context: RequestContext,
  ): Promise<Result<CustomerAddressResponse, CustomerDomainError>> {
    if (!canManageCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const address = await this.repository.setPrimaryAddress(
      input.customerId,
      input.addressId,
      this.audit(actor, context, input.reason ?? "customer_address.set_primary"),
    );
    if (!address) {
      return err({ type: "ADDRESS_NOT_FOUND" });
    }
    return ok(this.presentAddress(address));
  }

  public async listAddresses(
    actor: Actor,
    input: GetCustomerDetailInput,
    context: RequestContext,
  ): Promise<Result<CustomerAddressResponse[], CustomerDomainError>> {
    if (!canReadCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const customer = await this.repository.findActiveCustomerById(input.customerId);
    if (!customer) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    if (requiresSensitiveCustomerReason(actor)) {
      await this.repository.recordSensitiveAccess(
        { customerId: input.customerId, action: "view_addresses" },
        this.audit(actor, context, input.reason ?? "customer.addresses"),
      );
    }
    const rows = await this.repository.listAddresses(input.customerId);
    return ok(rows.map((row) => this.presentAddress(row)));
  }

  public async logContact(
    actor: Actor,
    input: LogCustomerContactInput,
    context: RequestContext,
  ): Promise<Result<CustomerContactLogResponse, CustomerDomainError>> {
    if (!canManageCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const customer = await this.repository.findActiveCustomerById(input.customerId);
    if (!customer) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    const contact = await this.repository.logContact(
      {
        customerId: input.customerId,
        channel: input.channel,
        direction: input.direction,
        note: input.note ?? null,
        occurredAt: input.occurredAt,
        createdBy: actor.kind === "admin" ? actor.userId : null,
      },
      this.audit(actor, context, "customer_contact.log"),
    );
    if (!contact) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    return ok(this.presentContact(contact));
  }

  public async listContacts(
    actor: Actor,
    input: ListCustomerContactsInput,
    context: RequestContext,
  ): Promise<Result<{ items: CustomerContactLogResponse[]; nextCursor: string | null }, CustomerDomainError>> {
    if (!canReadCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    if (!canViewSensitiveCustomerData(actor, input.reason)) {
      return err({ type: "SENSITIVE_REASON_REQUIRED" });
    }
    const customer = await this.repository.findActiveCustomerById(input.customerId);
    if (!customer) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    if (requiresSensitiveCustomerReason(actor)) {
      await this.repository.recordSensitiveAccess(
        { customerId: input.customerId, action: "view_contacts" },
        this.audit(actor, context, input.reason ?? "customer.contacts"),
      );
    }
    const result = await this.repository.listContacts({
      customerId: input.customerId,
      cursor: input.cursor ?? null,
      limit: input.limit,
    });
    return ok({ items: result.rows.map((row) => this.presentContact(row)), nextCursor: result.nextCursor });
  }

  public async softDelete(
    actor: Actor,
    input: SoftDeleteCustomerInput,
    context: RequestContext,
  ): Promise<Result<CustomerDetail, CustomerDomainError>> {
    if (!canDeleteCustomers(actor)) {
      return err({ type: actor.kind === "public" ? "UNAUTHENTICATED" : "FORBIDDEN" });
    }
    const deleted = await this.repository.softDeleteCustomer(input.customerId, this.audit(actor, context, input.reason));
    if (!deleted) {
      return err({ type: "CUSTOMER_NOT_FOUND" });
    }
    return ok({
      id: deleted.id,
      firstName: deleted.firstName,
      lastName: deleted.lastName,
      displayName: deleted.displayName,
      email: deleted.email,
      whatsapp: deleted.whatsapp,
      notes: deleted.notes,
      tier: deleted.tier,
      addresses: [],
      recentContacts: [],
      callsCount: 0,
      contactsCount: 0,
      lastContactAt: null,
      createdAt: deleted.createdAt,
      updatedAt: deleted.updatedAt,
    });
  }

  private presentSummary(row: CustomerSearchRow, includeSensitive: boolean): CustomerSummary {
    return {
      id: row.id,
      displayName: row.displayName,
      email: includeSensitive ? row.email : null,
      whatsapp: includeSensitive ? row.whatsapp : null,
      tier: row.tier,
      primaryCity: includeSensitive ? row.primaryCity : null,
      ordersCount: 0,
      totalSpent: { amountMinor: 0, currency: "ARS" },
      lastOrderAt: null,
      createdAt: row.createdAt,
    };
  }

  private presentDetail(aggregate: CustomerAggregate): CustomerDetail {
    return {
      id: aggregate.customer.id,
      firstName: aggregate.customer.firstName,
      lastName: aggregate.customer.lastName,
      displayName: aggregate.customer.displayName,
      email: aggregate.customer.email,
      whatsapp: aggregate.customer.whatsapp,
      notes: aggregate.customer.notes,
      tier: aggregate.customer.tier,
      addresses: aggregate.addresses.map((address) => this.presentAddress(address)),
      recentContacts: aggregate.recentContacts.map((contact) => this.presentContact(contact)),
      callsCount: aggregate.stats.callsCount,
      contactsCount: aggregate.stats.contactsCount,
      lastContactAt: aggregate.stats.lastContactAt,
      createdAt: aggregate.customer.createdAt,
      updatedAt: aggregate.customer.updatedAt,
    };
  }

  private presentAddress(address: CustomerAddressEntity): CustomerAddressResponse {
    return {
      id: address.id,
      customerId: address.customerId,
      label: address.label,
      recipientName: address.recipientName,
      province: address.province,
      city: address.city,
      street: address.street,
      streetNumber: address.streetNumber,
      betweenStreets: address.betweenStreets,
      postalCode: address.postalCode,
      isPrimary: address.isPrimary,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }

  private presentContact(contact: CustomerContactLogEntity): CustomerContactLogResponse {
    return {
      id: contact.id,
      customerId: contact.customerId,
      channel: contact.channel,
      direction: contact.direction,
      note: contact.note,
      occurredAt: contact.occurredAt,
    };
  }

  private addressRecord(input: {
    label?: string | null | undefined;
    recipientName?: string | null | undefined;
    province: string;
    city: string;
    street: string;
    streetNumber?: string | undefined;
    betweenStreets?: string | undefined;
    postalCode?: string | undefined;
    isPrimary: boolean;
  }, forcePrimary: boolean): CreateCustomerAddressRecord {
    return {
      label: input.label ?? null,
      recipientName: input.recipientName ?? null,
      province: input.province,
      city: input.city,
      street: input.street,
      streetNumber: input.streetNumber ?? null,
      betweenStreets: input.betweenStreets ?? null,
      postalCode: input.postalCode ?? null,
      isPrimary: forcePrimary || input.isPrimary,
    };
  }

  private normalizeWhatsapp(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    const digits = trimmed.replace(/\D/g, "");
    if (trimmed.startsWith("+")) {
      return `+${digits}`;
    }
    if (digits.startsWith("54") || digits.length > 13) {
      return `+${digits}`;
    }
    return `+54${digits}`;
  }

  private displayName(firstName: string, lastName: string): string {
    return `${firstName.trim()} ${lastName.trim()}`.trim();
  }

  private audit(actor: Actor, context: RequestContext, reason: string): RequestAuditContext {
    return {
      actorId: actor.kind === "admin" ? actor.userId : null,
      ip: context.ip,
      userAgent: context.userAgent,
      requestId: context.requestId,
      reason,
    };
  }
}
