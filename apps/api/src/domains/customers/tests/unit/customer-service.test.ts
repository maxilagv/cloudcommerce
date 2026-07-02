import {
  AdminRole,
  CustomerContactChannel,
  CustomerContactDirection,
  CustomerTier,
  type Actor,
} from "@cloudcommerce/types";
import { CreateCustomerSchema, CustomerAddressSchema } from "@cloudcommerce/validators";
import { describe, expect, it } from "vitest";
import { PlaceholderCustomerPurchaseAnalyticsPort } from "../../application/customer-analytics-port.js";
import type {
  CreateCustomerRecord,
  CustomerAddressEntity,
  CustomerAggregate,
  CustomerContactListResult,
  CustomerContactLogEntity,
  CustomerContactStats,
  CustomerEntity,
  CustomerRepository,
  CustomerSearchRepositoryResult,
  LogCustomerContactRecord,
  RequestAuditContext,
  SearchCustomersQuery,
  UpdateCustomerAddressRecord,
  UpdateCustomerRecord,
} from "../../application/customer-repository.js";
import { CustomerService } from "../../application/customer-service.js";

const now = new Date("2026-07-01T00:00:00.000Z");
const customerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

describe("Customer validators", () => {
  it("allows customers without whatsapp and validates E.164-like numbers when present", () => {
    expect(CreateCustomerSchema.safeParse({ firstName: "Ana", lastName: "Paz" }).success).toBe(true);
    expect(CreateCustomerSchema.safeParse({ firstName: "Ana", lastName: "Paz", whatsapp: "+5491134567890" }).success).toBe(true);
    expect(CreateCustomerSchema.safeParse({ firstName: "Ana", lastName: "Paz", whatsapp: "abc" }).success).toBe(false);
  });

  it("allows AR addresses without streetNumber when it does not apply", () => {
    const result = CustomerAddressSchema.safeParse({
      province: "Buenos Aires",
      city: "La Plata",
      street: "Calle 12",
      betweenStreets: "54 y 55",
      postalCode: "1900",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.streetNumber).toBeUndefined();
      expect(result.data.isPrimary).toBe(false);
    }
  });
});

describe("CustomerService", () => {
  it("normalizes optional whatsapp on create and keeps mass assignment explicit", async () => {
    const repository = new FakeCustomerRepository();
    const service = newService(repository);

    const result = await service.create(
      admin(AdminRole.ADMIN),
      {
        firstName: "Maximiliano",
        lastName: "Lavagetto",
        whatsapp: "1134567890",
        email: "maxi@example.com",
        notes: "Cliente demo",
      },
      requestContext,
    );

    expect(result.ok).toBe(true);
    expect(repository.createdCustomer?.whatsapp).toBe("+541134567890");
    expect(repository.createdCustomer && "deletedAt" in repository.createdCustomer).toBe(false);
  });

  it("searches customers with cursor pagination and masks sensitive fields for SUPPORT", async () => {
    const repository = new FakeCustomerRepository({ nextCursor: "next-page" });
    const service = newService(repository);

    const result = await service.search(admin(AdminRole.SUPPORT), { q: "maxi", sort: "recent", cursor: "cursor", limit: 20 });

    expect(result.ok).toBe(true);
    expect(repository.lastSearch).toEqual({ q: "maxi", sort: "recent", cursor: "cursor", limit: 20 });
    if (result.ok) {
      expect(result.value.nextCursor).toBe("next-page");
      expect(result.value.items[0]?.displayName).toBe("Maximiliano Lavagetto");
      expect(result.value.items[0]?.whatsapp).toBeNull();
      expect(result.value.items[0]?.primaryCity).toBeNull();
    }
  });

  it("requires a reason before SUPPORT can read sensitive customer detail", async () => {
    const repository = new FakeCustomerRepository();
    const service = newService(repository);

    const denied = await service.getDetail(admin(AdminRole.SUPPORT), { customerId }, requestContext);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.type).toBe("SENSITIVE_REASON_REQUIRED");
    }

    const allowed = await service.getDetail(
      admin(AdminRole.SUPPORT),
      { customerId, reason: "Atender reclamo abierto" },
      requestContext,
    );
    expect(allowed.ok).toBe(true);
    expect(repository.sensitiveAccesses).toHaveLength(1);
  });

  it("counts only call contacts for callsCount and hides investment from SUPPORT", async () => {
    const service = newService(new FakeCustomerRepository());

    const result = await service.getAnalytics(admin(AdminRole.SUPPORT), { customerId, range: "6M", breakdown: "category" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.callsCount).toBe(2);
      expect(result.value.contactsCount).toBe(3);
      expect(result.value.investedAvailable).toBe(false);
      expect("totalInvested" in result.value).toBe(false);
      expect("margin" in result.value).toBe(false);
    }
  });

  it("rejects analytics for CATALOG_MANAGER", async () => {
    const service = newService(new FakeCustomerRepository());

    const result = await service.getAnalytics(admin(AdminRole.CATALOG_MANAGER), { customerId, range: "6M", breakdown: "category" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });

  it("does not expose internal deletedAt fields in detail responses", async () => {
    const service = newService(new FakeCustomerRepository());

    const result = await service.getDetail(admin(AdminRole.ADMIN), { customerId }, requestContext);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("deletedAt" in result.value).toBe(false);
    }
  });
});

const newService = (repository: CustomerRepository): CustomerService =>
  new CustomerService(repository, new PlaceholderCustomerPurchaseAnalyticsPort());

const admin = (role: AdminRole): Actor => ({
  kind: "admin",
  userId: "admin-user",
  role,
  sessionId: "session",
});

const requestContext = {
  ip: "127.0.0.1",
  userAgent: "vitest",
  requestId: "request-id",
};

class FakeCustomerRepository implements CustomerRepository {
  public createdCustomer: CreateCustomerRecord | null = null;
  public lastSearch: SearchCustomersQuery | null = null;
  public readonly sensitiveAccesses: string[] = [];

  public constructor(private readonly options: { nextCursor?: string | null } = {}) {}

  public async findActiveCustomerById(id: string): Promise<CustomerEntity | null> {
    return id === customerId ? customerEntity : null;
  }

  public async findActiveCustomerByEmail(_email: string): Promise<CustomerEntity | null> {
    return null;
  }

  public async searchCustomers(input: SearchCustomersQuery): Promise<CustomerSearchRepositoryResult> {
    this.lastSearch = input;
    return {
      rows: [{ ...customerEntity, primaryCity: "CABA", lastContactAt: now }],
      nextCursor: this.options.nextCursor ?? null,
    };
  }

  public async createCustomer(input: CreateCustomerRecord): Promise<CustomerAggregate> {
    this.createdCustomer = input;
    return aggregate({ customer: { ...customerEntity, ...input, id: customerId, createdAt: now, updatedAt: now, deletedAt: null } });
  }

  public async updateCustomer(_input: UpdateCustomerRecord): Promise<CustomerAggregate | null> {
    return aggregate();
  }

  public async addAddress(): Promise<CustomerAddressEntity | null> {
    return addressEntity;
  }

  public async updateAddress(_input: UpdateCustomerAddressRecord): Promise<CustomerAddressEntity | null> {
    return addressEntity;
  }

  public async setPrimaryAddress(): Promise<CustomerAddressEntity | null> {
    return addressEntity;
  }

  public async listAddresses(): Promise<CustomerAddressEntity[]> {
    return [addressEntity];
  }

  public async logContact(input: LogCustomerContactRecord): Promise<CustomerContactLogEntity | null> {
    return { ...contacts[0] as CustomerContactLogEntity, ...input, id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd9" };
  }

  public async listContacts(): Promise<CustomerContactListResult> {
    return { rows: contacts, nextCursor: null };
  }

  public async getCustomerAggregate(id: string): Promise<CustomerAggregate | null> {
    return id === customerId ? aggregate() : null;
  }

  public async getContactStats(): Promise<CustomerContactStats> {
    return {
      callsCount: contacts.filter((contact) => contact.channel === CustomerContactChannel.CALL).length,
      contactsCount: contacts.length,
      lastContactAt: contacts[0]?.occurredAt ?? null,
    };
  }

  public async recordSensitiveAccess(input: { customerId: string; action: string }, _audit: RequestAuditContext): Promise<void> {
    this.sensitiveAccesses.push(`${input.action}:${input.customerId}`);
  }

  public async softDeleteCustomer(): Promise<CustomerEntity | null> {
    return { ...customerEntity, deletedAt: now };
  }
}

const aggregate = (override: Partial<CustomerAggregate> = {}): CustomerAggregate => ({
  customer: customerEntity,
  addresses: [addressEntity],
  recentContacts: contacts,
  stats: {
    callsCount: 2,
    contactsCount: 3,
    lastContactAt: contacts[0]?.occurredAt ?? null,
  },
  ...override,
});

const customerEntity: CustomerEntity = {
  id: customerId,
  firstName: "Maximiliano",
  lastName: "Lavagetto",
  displayName: "Maximiliano Lavagetto",
  email: "maxi@example.com",
  whatsapp: "+5491134567890",
  notes: "Cliente demo",
  tier: CustomerTier.CloudPrime,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const addressEntity: CustomerAddressEntity = {
  id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
  customerId,
  label: "Casa",
  recipientName: "Maximiliano Lavagetto",
  province: "Ciudad Autonoma de Buenos Aires",
  city: "CABA",
  street: "Av. Corrientes",
  streetNumber: "1234",
  betweenStreets: "Libertad y Talcahuano",
  postalCode: "1043",
  isPrimary: true,
  createdAt: now,
  updatedAt: now,
};

const contacts: CustomerContactLogEntity[] = [
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
    customerId,
    channel: CustomerContactChannel.CALL,
    direction: CustomerContactDirection.IN,
    note: "Consulta",
    occurredAt: now,
    createdBy: "admin-user",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2",
    customerId,
    channel: CustomerContactChannel.WHATSAPP,
    direction: CustomerContactDirection.OUT,
    note: "Seguimiento",
    occurredAt: now,
    createdBy: "admin-user",
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3",
    customerId,
    channel: CustomerContactChannel.CALL,
    direction: CustomerContactDirection.IN,
    note: "Reclamo",
    occurredAt: now,
    createdBy: "admin-user",
  },
];
