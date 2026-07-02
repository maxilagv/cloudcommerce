import type {
  CustomerContactChannel,
  CustomerContactDirection,
  CustomerTier,
} from "@cloudcommerce/types";

export type RequestAuditContext = {
  actorId: string | null;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  reason?: string | null;
};

export type CustomerEntity = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
  tier: CustomerTier;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CustomerAddressEntity = {
  id: string;
  customerId: string;
  label: string | null;
  recipientName: string | null;
  province: string;
  city: string;
  street: string;
  streetNumber: string | null;
  betweenStreets: string | null;
  postalCode: string | null;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CustomerContactLogEntity = {
  id: string;
  customerId: string;
  channel: CustomerContactChannel;
  direction: CustomerContactDirection;
  note: string | null;
  occurredAt: Date;
  createdBy: string | null;
};

export type CustomerSearchRow = CustomerEntity & {
  primaryCity: string | null;
  lastContactAt: Date | null;
};

export type CustomerContactStats = {
  callsCount: number;
  contactsCount: number;
  lastContactAt: Date | null;
};

export type CustomerAggregate = {
  customer: CustomerEntity;
  addresses: CustomerAddressEntity[];
  recentContacts: CustomerContactLogEntity[];
  stats: CustomerContactStats;
};

export type CreateCustomerAddressRecord = {
  label: string | null;
  recipientName: string | null;
  province: string;
  city: string;
  street: string;
  streetNumber: string | null;
  betweenStreets: string | null;
  postalCode: string | null;
  isPrimary: boolean;
};

export type CreateCustomerRecord = {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
  tier: CustomerTier;
  initialAddress: CreateCustomerAddressRecord | null;
};

export type UpdateCustomerRecord = {
  customerId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  email?: string | null;
  whatsapp?: string | null;
  notes?: string | null;
};

export type UpdateCustomerAddressRecord = {
  customerId: string;
  addressId: string;
  label?: string | null;
  recipientName?: string | null;
  province?: string;
  city?: string;
  street?: string;
  streetNumber?: string | null;
  betweenStreets?: string | null;
  postalCode?: string | null;
  isPrimary?: boolean;
};

export type LogCustomerContactRecord = {
  customerId: string;
  channel: CustomerContactChannel;
  direction: CustomerContactDirection;
  note: string | null;
  occurredAt: Date;
  createdBy: string | null;
};

export type SearchCustomersQuery = {
  q: string | null;
  sort: "recent" | "name" | "last_contact";
  cursor: string | null;
  limit: number;
};

export type CustomerSearchRepositoryResult = {
  rows: CustomerSearchRow[];
  nextCursor: string | null;
};

export type CustomerContactListResult = {
  rows: CustomerContactLogEntity[];
  nextCursor: string | null;
};

export interface CustomerRepository {
  findActiveCustomerById(customerId: string): Promise<CustomerEntity | null>;
  findActiveCustomerByEmail(email: string): Promise<CustomerEntity | null>;
  searchCustomers(input: SearchCustomersQuery): Promise<CustomerSearchRepositoryResult>;
  createCustomer(input: CreateCustomerRecord, audit: RequestAuditContext): Promise<CustomerAggregate>;
  updateCustomer(input: UpdateCustomerRecord, audit: RequestAuditContext): Promise<CustomerAggregate | null>;
  addAddress(customerId: string, input: CreateCustomerAddressRecord, audit: RequestAuditContext): Promise<CustomerAddressEntity | null>;
  updateAddress(input: UpdateCustomerAddressRecord, audit: RequestAuditContext): Promise<CustomerAddressEntity | null>;
  setPrimaryAddress(customerId: string, addressId: string, audit: RequestAuditContext): Promise<CustomerAddressEntity | null>;
  listAddresses(customerId: string): Promise<CustomerAddressEntity[]>;
  logContact(input: LogCustomerContactRecord, audit: RequestAuditContext): Promise<CustomerContactLogEntity | null>;
  listContacts(input: { customerId: string; cursor: string | null; limit: number }): Promise<CustomerContactListResult>;
  getCustomerAggregate(customerId: string): Promise<CustomerAggregate | null>;
  getContactStats(customerId: string): Promise<CustomerContactStats>;
  recordSensitiveAccess(input: { customerId: string; action: string }, audit: RequestAuditContext): Promise<void>;
  softDeleteCustomer(customerId: string, audit: RequestAuditContext): Promise<CustomerEntity | null>;
}
