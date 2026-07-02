import { accessLog, auditLog, customer, customerAddress, customerContactLog, outboxEvent } from "@cloudcommerce/database";
import { CustomerContactChannel } from "@cloudcommerce/types";
import { and, asc, desc, eq, gt, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import type { Database } from "../../../../infrastructure/database/client.js";
import type {
  CreateCustomerAddressRecord,
  CreateCustomerRecord,
  CustomerAddressEntity,
  CustomerAggregate,
  CustomerContactListResult,
  CustomerContactLogEntity,
  CustomerContactStats,
  CustomerEntity,
  CustomerRepository,
  CustomerSearchRepositoryResult,
  CustomerSearchRow,
  LogCustomerContactRecord,
  RequestAuditContext,
  SearchCustomersQuery,
  UpdateCustomerAddressRecord,
  UpdateCustomerRecord,
} from "../../application/customer-repository.js";

type SearchCursor = {
  createdAt: Date;
  id: string;
  displayName: string;
};

export class DrizzleCustomerRepository implements CustomerRepository {
  public constructor(private readonly db: Database) {}

  public async findActiveCustomerById(customerId: string): Promise<CustomerEntity | null> {
    const row = await this.db.query.customer.findFirst({
      where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
    });
    return row ? this.mapCustomer(row) : null;
  }

  public async findActiveCustomerByEmail(email: string): Promise<CustomerEntity | null> {
    const row = await this.db.query.customer.findFirst({
      where: and(isNull(customer.deletedAt), sql`lower(${customer.email}) = ${email.toLowerCase()}`),
    });
    return row ? this.mapCustomer(row) : null;
  }

  public async searchCustomers(input: SearchCustomersQuery): Promise<CustomerSearchRepositoryResult> {
    const conditions: SQL[] = [isNull(customer.deletedAt)];
    if (input.q) {
      const query = `%${input.q}%`;
      conditions.push(
        or(
          ilike(customer.displayName, query),
          ilike(customer.firstName, query),
          ilike(customer.lastName, query),
          ilike(customer.email, query),
          ilike(customer.whatsapp, query),
        ) ?? sql`false`,
      );
    }
    const cursor = this.decodeSearchCursor(input.cursor);
    if (cursor) {
      if (input.sort === "name") {
        conditions.push(
          or(
            gt(customer.displayName, cursor.displayName),
            and(eq(customer.displayName, cursor.displayName), gt(customer.id, cursor.id)),
          ) ?? sql`false`,
        );
      } else {
        conditions.push(
          or(
            lt(customer.createdAt, cursor.createdAt),
            and(eq(customer.createdAt, cursor.createdAt), lt(customer.id, cursor.id)),
          ) ?? sql`false`,
        );
      }
    }
    const primaryCity = sql<string | null>`(
      select ca.city
      from customer_address ca
      where ca.customer_id = ${customer.id} and ca.is_primary = true
      limit 1
    )`;
    const lastContactAt = sql<Date | null>`(
      select max(ccl.occurred_at)
      from customer_contact_log ccl
      where ccl.customer_id = ${customer.id}
    )`;
    const orderBy =
      input.sort === "name"
        ? [asc(customer.displayName), asc(customer.id)]
        : [desc(customer.createdAt), desc(customer.id)];
    const rows = await this.db
      .select({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        displayName: customer.displayName,
        email: customer.email,
        whatsapp: customer.whatsapp,
        notes: customer.notes,
        tier: customer.tier,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        deletedAt: customer.deletedAt,
        primaryCity,
        lastContactAt,
      })
      .from(customer)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(input.limit + 1);
    const visibleRows = rows.slice(0, input.limit).map((row) => this.mapSearchRow(row));
    const nextCursor = rows.length > input.limit && visibleRows.length > 0
      ? this.encodeSearchCursor(visibleRows[visibleRows.length - 1] as CustomerSearchRow)
      : null;
    return { rows: visibleRows, nextCursor };
  }

  public async createCustomer(input: CreateCustomerRecord, audit: RequestAuditContext): Promise<CustomerAggregate> {
    const customerId = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(customer)
        .values({
          id: uuidv7(),
          firstName: input.firstName,
          lastName: input.lastName,
          displayName: input.displayName,
          email: input.email,
          whatsapp: input.whatsapp,
          notes: input.notes,
          tier: input.tier,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create customer");
      }
      if (input.initialAddress) {
        await tx.insert(customerAddress).values({
          id: uuidv7(),
          customerId: row.id,
          ...input.initialAddress,
          isPrimary: true,
        });
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "customer.create",
        resourceType: "customer",
        resourceId: row.id,
        before: null,
        after: { fields: ["firstName", "lastName", "email", "whatsapp", "notes", "initialAddress"] },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "customers",
        aggregateId: row.id,
        eventType: "CustomerCreated",
        payload: { customerId: row.id },
      });
      return row.id;
    });
    const aggregate = await this.getCustomerAggregate(customerId);
    if (!aggregate) {
      throw new Error("Created customer could not be loaded");
    }
    return aggregate;
  }

  public async updateCustomer(input: UpdateCustomerRecord, audit: RequestAuditContext): Promise<CustomerAggregate | null> {
    const updatedId = await this.db.transaction(async (tx) => {
      const existing = await tx.query.customer.findFirst({
        where: and(eq(customer.id, input.customerId), isNull(customer.deletedAt)),
      });
      if (!existing) {
        return null;
      }
      const patch: Partial<typeof customer.$inferInsert> = { updatedAt: new Date() };
      const fields: string[] = [];
      if (input.firstName !== undefined) {
        patch.firstName = input.firstName;
        fields.push("firstName");
      }
      if (input.lastName !== undefined) {
        patch.lastName = input.lastName;
        fields.push("lastName");
      }
      if (input.displayName !== undefined) {
        patch.displayName = input.displayName;
      }
      if (input.email !== undefined) {
        patch.email = input.email;
        fields.push("email");
      }
      if (input.whatsapp !== undefined) {
        patch.whatsapp = input.whatsapp;
        fields.push("whatsapp");
      }
      if (input.notes !== undefined) {
        patch.notes = input.notes;
        fields.push("notes");
      }
      const [row] = await tx.update(customer).set(patch).where(eq(customer.id, input.customerId)).returning();
      if (!row) {
        return null;
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "customer.update",
        resourceType: "customer",
        resourceId: row.id,
        before: { fields },
        after: { fields },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "customers",
        aggregateId: row.id,
        eventType: "CustomerUpdated",
        payload: { customerId: row.id, fields },
      });
      return row.id;
    });
    return updatedId ? this.getCustomerAggregate(updatedId) : null;
  }

  public async addAddress(
    customerId: string,
    input: CreateCustomerAddressRecord,
    audit: RequestAuditContext,
  ): Promise<CustomerAddressEntity | null> {
    return this.db.transaction(async (tx) => {
      const existingCustomer = await tx.query.customer.findFirst({
        where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
        columns: { id: true },
      });
      if (!existingCustomer) {
        return null;
      }
      const [countRow] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(customerAddress)
        .where(eq(customerAddress.customerId, customerId));
      const shouldBePrimary = (countRow?.value ?? 0) === 0 || input.isPrimary;
      if (shouldBePrimary) {
        await tx.update(customerAddress).set({ isPrimary: false, updatedAt: new Date() }).where(eq(customerAddress.customerId, customerId));
      }
      const [row] = await tx
        .insert(customerAddress)
        .values({
          id: uuidv7(),
          customerId,
          label: input.label,
          recipientName: input.recipientName,
          province: input.province,
          city: input.city,
          street: input.street,
          streetNumber: input.streetNumber,
          betweenStreets: input.betweenStreets,
          postalCode: input.postalCode,
          isPrimary: shouldBePrimary,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to add customer address");
      }
      await this.insertAudit(tx, audit, "customer_address.add", "customer_address", row.id, ["address"]);
      return this.mapAddress(row);
    });
  }

  public async updateAddress(input: UpdateCustomerAddressRecord, audit: RequestAuditContext): Promise<CustomerAddressEntity | null> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.customerAddress.findFirst({
        where: and(eq(customerAddress.id, input.addressId), eq(customerAddress.customerId, input.customerId)),
      });
      if (!existing) {
        return null;
      }
      const patch: Partial<typeof customerAddress.$inferInsert> = { updatedAt: new Date() };
      const fields: string[] = [];
      if (input.label !== undefined) {
        patch.label = input.label;
        fields.push("label");
      }
      if (input.recipientName !== undefined) {
        patch.recipientName = input.recipientName;
        fields.push("recipientName");
      }
      if (input.province !== undefined) {
        patch.province = input.province;
        fields.push("province");
      }
      if (input.city !== undefined) {
        patch.city = input.city;
        fields.push("city");
      }
      if (input.street !== undefined) {
        patch.street = input.street;
        fields.push("street");
      }
      if (input.streetNumber !== undefined) {
        patch.streetNumber = input.streetNumber;
        fields.push("streetNumber");
      }
      if (input.betweenStreets !== undefined) {
        patch.betweenStreets = input.betweenStreets;
        fields.push("betweenStreets");
      }
      if (input.postalCode !== undefined) {
        patch.postalCode = input.postalCode;
        fields.push("postalCode");
      }
      if (input.isPrimary === true) {
        await tx.update(customerAddress).set({ isPrimary: false, updatedAt: new Date() }).where(eq(customerAddress.customerId, input.customerId));
        patch.isPrimary = true;
        fields.push("isPrimary");
      }
      const [row] = await tx.update(customerAddress).set(patch).where(eq(customerAddress.id, input.addressId)).returning();
      if (!row) {
        return null;
      }
      await this.insertAudit(tx, audit, "customer_address.update", "customer_address", row.id, fields);
      return this.mapAddress(row);
    });
  }

  public async setPrimaryAddress(
    customerId: string,
    addressId: string,
    audit: RequestAuditContext,
  ): Promise<CustomerAddressEntity | null> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.customerAddress.findFirst({
        where: and(eq(customerAddress.id, addressId), eq(customerAddress.customerId, customerId)),
      });
      if (!existing) {
        return null;
      }
      await tx.update(customerAddress).set({ isPrimary: false, updatedAt: new Date() }).where(eq(customerAddress.customerId, customerId));
      const [row] = await tx
        .update(customerAddress)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(customerAddress.id, addressId))
        .returning();
      if (!row) {
        return null;
      }
      await this.insertAudit(tx, audit, "customer_address.set_primary", "customer_address", row.id, ["isPrimary"]);
      return this.mapAddress(row);
    });
  }

  public async listAddresses(customerId: string): Promise<CustomerAddressEntity[]> {
    const rows = await this.db
      .select()
      .from(customerAddress)
      .where(eq(customerAddress.customerId, customerId))
      .orderBy(desc(customerAddress.isPrimary), desc(customerAddress.createdAt));
    return rows.map((row) => this.mapAddress(row));
  }

  public async logContact(input: LogCustomerContactRecord, audit: RequestAuditContext): Promise<CustomerContactLogEntity | null> {
    return this.db.transaction(async (tx) => {
      const existingCustomer = await tx.query.customer.findFirst({
        where: and(eq(customer.id, input.customerId), isNull(customer.deletedAt)),
        columns: { id: true },
      });
      if (!existingCustomer) {
        return null;
      }
      const [row] = await tx
        .insert(customerContactLog)
        .values({
          id: uuidv7(),
          customerId: input.customerId,
          channel: input.channel,
          direction: input.direction,
          note: input.note,
          occurredAt: input.occurredAt,
          createdBy: input.createdBy,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to log customer contact");
      }
      await this.insertAudit(tx, audit, "customer_contact.log", "customer", input.customerId, ["contact"]);
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "customers",
        aggregateId: input.customerId,
        eventType: "CustomerContactLogged",
        payload: { customerId: input.customerId, contactId: row.id, channel: row.channel },
      });
      return this.mapContact(row);
    });
  }

  public async listContacts(input: { customerId: string; cursor: string | null; limit: number }): Promise<CustomerContactListResult> {
    const conditions: SQL[] = [eq(customerContactLog.customerId, input.customerId)];
    const cursor = this.decodeDateCursor(input.cursor);
    if (cursor) {
      conditions.push(lt(customerContactLog.occurredAt, cursor));
    }
    const rows = await this.db
      .select()
      .from(customerContactLog)
      .where(and(...conditions))
      .orderBy(desc(customerContactLog.occurredAt), desc(customerContactLog.id))
      .limit(input.limit + 1);
    const visibleRows = rows.slice(0, input.limit).map((row) => this.mapContact(row));
    const lastRow = visibleRows[visibleRows.length - 1];
    return {
      rows: visibleRows,
      nextCursor: rows.length > input.limit && lastRow ? lastRow.occurredAt.toISOString() : null,
    };
  }

  public async getCustomerAggregate(customerId: string): Promise<CustomerAggregate | null> {
    const row = await this.findActiveCustomerById(customerId);
    if (!row) {
      return null;
    }
    const [addresses, contacts, stats] = await Promise.all([
      this.listAddresses(customerId),
      this.listContacts({ customerId, cursor: null, limit: 10 }),
      this.getContactStats(customerId),
    ]);
    return {
      customer: row,
      addresses,
      recentContacts: contacts.rows,
      stats,
    };
  }

  public async getContactStats(customerId: string): Promise<CustomerContactStats> {
    const [row] = await this.db
      .select({
        contactsCount: sql<number>`count(*)::int`,
        callsCount: sql<number>`count(*) filter (where ${customerContactLog.channel} = ${CustomerContactChannel.CALL})::int`,
        lastContactAt: sql<Date | null>`max(${customerContactLog.occurredAt})`,
      })
      .from(customerContactLog)
      .where(eq(customerContactLog.customerId, customerId));
    return {
      contactsCount: row?.contactsCount ?? 0,
      callsCount: row?.callsCount ?? 0,
      lastContactAt: row?.lastContactAt ?? null,
    };
  }

  public async recordSensitiveAccess(input: { customerId: string; action: string }, audit: RequestAuditContext): Promise<void> {
    await this.db.insert(accessLog).values({
      id: uuidv7(),
      actorId: audit.actorId,
      resourceType: "customer",
      resourceId: input.customerId,
      action: input.action,
      reason: audit.reason ?? null,
      ip: audit.ip ?? "unknown",
      userAgent: audit.userAgent ?? "unknown",
      requestId: audit.requestId ?? "unknown",
    });
  }

  public async softDeleteCustomer(customerId: string, audit: RequestAuditContext): Promise<CustomerEntity | null> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.customer.findFirst({
        where: and(eq(customer.id, customerId), isNull(customer.deletedAt)),
      });
      if (!existing) {
        return null;
      }
      const [row] = await tx
        .update(customer)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(customer.id, customerId))
        .returning();
      if (!row) {
        return null;
      }
      await tx.insert(auditLog).values({
        id: uuidv7(),
        actorId: audit.actorId,
        action: "customer.soft_delete",
        resourceType: "customer",
        resourceId: customerId,
        before: { active: true },
        after: { active: false },
        ip: audit.ip,
        userAgent: audit.userAgent,
        requestId: audit.requestId,
        reason: audit.reason ?? null,
      });
      await tx.insert(outboxEvent).values({
        id: uuidv7(),
        aggregateType: "customers",
        aggregateId: customerId,
        eventType: "CustomerDeactivated",
        payload: { customerId },
      });
      return this.mapCustomer(row);
    });
  }

  private async insertAudit(
    tx: Parameters<Parameters<Database["transaction"]>[0]>[0],
    audit: RequestAuditContext,
    action: string,
    resourceType: string,
    resourceId: string,
    fields: string[],
  ): Promise<void> {
    await tx.insert(auditLog).values({
      id: uuidv7(),
      actorId: audit.actorId,
      action,
      resourceType,
      resourceId,
      before: { fields },
      after: { fields },
      ip: audit.ip,
      userAgent: audit.userAgent,
      requestId: audit.requestId,
      reason: audit.reason ?? null,
    });
  }

  private mapCustomer(row: typeof customer.$inferSelect): CustomerEntity {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      email: row.email,
      whatsapp: row.whatsapp,
      notes: row.notes,
      tier: row.tier,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  private mapSearchRow(row: typeof customer.$inferSelect & { primaryCity: string | null; lastContactAt: Date | null }): CustomerSearchRow {
    return {
      ...this.mapCustomer(row),
      primaryCity: row.primaryCity,
      lastContactAt: row.lastContactAt,
    };
  }

  private mapAddress(row: typeof customerAddress.$inferSelect): CustomerAddressEntity {
    return {
      id: row.id,
      customerId: row.customerId,
      label: row.label,
      recipientName: row.recipientName,
      province: row.province,
      city: row.city,
      street: row.street,
      streetNumber: row.streetNumber,
      betweenStreets: row.betweenStreets,
      postalCode: row.postalCode,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapContact(row: typeof customerContactLog.$inferSelect): CustomerContactLogEntity {
    return {
      id: row.id,
      customerId: row.customerId,
      channel: row.channel,
      direction: row.direction,
      note: row.note,
      occurredAt: row.occurredAt,
      createdBy: row.createdBy,
    };
  }

  private encodeSearchCursor(row: CustomerSearchRow): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        displayName: row.displayName,
      }),
    ).toString("base64url");
  }

  private decodeSearchCursor(cursor: string | null): SearchCursor | null {
    if (!cursor) {
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      const value = parsed as { createdAt?: unknown; id?: unknown; displayName?: unknown };
      if (typeof value.createdAt !== "string" || typeof value.id !== "string" || typeof value.displayName !== "string") {
        return null;
      }
      const createdAt = new Date(value.createdAt);
      if (Number.isNaN(createdAt.getTime())) {
        return null;
      }
      return { createdAt, id: value.id, displayName: value.displayName };
    } catch {
      return null;
    }
  }

  private decodeDateCursor(cursor: string | null): Date | null {
    if (!cursor) {
      return null;
    }
    const parsed = new Date(cursor);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
