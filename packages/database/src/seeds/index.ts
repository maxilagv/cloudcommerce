import {
  AdminRole,
  CustomerContactChannel,
  CustomerContactDirection,
  CustomerTier,
  MediaSource,
  PaymentMethodId,
  DocumentStatus,
  DocumentType,
  OrderChannel,
  OrderStatus,
  PricingScope,
  PricingValueKind,
  ProductStatus,
  ShippingMethod,
  StockMovementType,
} from "@cloudcommerce/types";
import { hash } from "argon2";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import postgres from "postgres";
import { v7 as uuidv7 } from "uuid";
import {
  adminUser,
  brand,
  category,
  customer,
  customerAddress,
  customerContactLog,
  mediaAsset,
  permissionGrant,
  priceList,
  product,
  productMedia,
  productVariant,
  markupRule,
  commercialDocument,
  documentSequence,
  financePeriodSnapshot,
  order as orderTable,
  orderLine,
  orderStatusEvent,
  stockItem,
  stockMovement,
  supplierCost,
  specGroup,
  specItem,
  setting,
  featureFlag,
} from "../schema/index.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}
if (process.env.NODE_ENV === "production" && process.env.ALLOW_PROD_SEED !== "true") {
  throw new Error("Refusing to run seeds in production without ALLOW_PROD_SEED=true");
}
if (!process.env.OWNER_PASSWORD) {
  throw new Error("OWNER_PASSWORD is required to seed the OWNER user");
}

const ownerEmail = (process.env.OWNER_EMAIL ?? "owner@cloudcommerce.local").trim().toLowerCase();
const ownerPassword = process.env.OWNER_PASSWORD;
const ownerFullName = process.env.OWNER_FULL_NAME ?? "CloudCommerce Owner";

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql, {
  schema: {
    adminUser,
    permissionGrant,
    category,
    customer,
    customerAddress,
    customerContactLog,
    brand,
    mediaAsset,
    product,
    productMedia,
    productVariant,
    priceList,
    markupRule,
    commercialDocument,
    documentSequence,
    financePeriodSnapshot,
    order: orderTable,
    orderLine,
    orderStatusEvent,
    supplierCost,
    stockItem,
    stockMovement,
    specGroup,
    specItem,
    setting,
    featureFlag,
  },
});

let owner = await db.query.adminUser.findFirst({
  where: eq(adminUser.email, ownerEmail),
});

if (!owner) {
  const [createdOwner] = await db.insert(adminUser).values({
    id: uuidv7(),
    email: ownerEmail,
    passwordHash: await hash(ownerPassword, { type: 2 }),
    fullName: ownerFullName,
    role: AdminRole.OWNER,
  }).returning();
  if (!createdOwner) {
    throw new Error("Failed to create OWNER seed user");
  }
  owner = createdOwner;
}

const ownerId = owner?.id ?? null;

const permissions: Array<{ role: AdminRole; resource: string; action: string }> = [
  { role: AdminRole.OWNER, resource: "*", action: "*" },
  { role: AdminRole.ADMIN, resource: "*", action: "*" },
  { role: AdminRole.CATALOG_MANAGER, resource: "catalog", action: "*" },
  { role: AdminRole.CATALOG_MANAGER, resource: "ai", action: "use" },
  { role: AdminRole.FINANCE, resource: "finance", action: "*" },
  { role: AdminRole.FINANCE, resource: "orders", action: "read" },
  { role: AdminRole.SUPPORT, resource: "customers", action: "*" },
  { role: AdminRole.SUPPORT, resource: "orders", action: "read" },
  { role: AdminRole.SUPPORT, resource: "dashboard", action: "read" },
];

for (const permission of permissions) {
  await db
    .insert(permissionGrant)
    .values({ id: uuidv7(), ...permission })
    .onConflictDoNothing();
}

await db
  .insert(setting)
  .values([
    {
      id: "12121212-1212-4121-8121-121212121211",
      key: "store.identity",
      value: { name: "CloudCommerce", legalName: "CloudCommerce Demo" },
      scope: "public",
      updatedBy: ownerId,
    },
    {
      id: "12121212-1212-4121-8121-121212121212",
      key: "store.currency",
      value: { base: "ARS", display: "es-AR", rounding: "nearest_100" },
      scope: "public",
      updatedBy: ownerId,
    },
    {
      id: "12121212-1212-4121-8121-121212121213",
      key: "shipping.options",
      value: [
        {
          id: "standard",
          method: ShippingMethod.STANDARD,
          label: "Envio estandar",
          detail: "Llega en 3 a 5 dias habiles",
          costAmountMinor: 0,
          currency: "ARS",
          isActive: true,
          isDefault: true,
          position: 0,
        },
        {
          id: "express",
          method: ShippingMethod.EXPRESS,
          label: "Envio express",
          detail: "Llega en 24 a 48 horas",
          costAmountMinor: 24_900,
          currency: "ARS",
          isActive: true,
          isDefault: false,
          position: 1,
        },
        {
          id: "pickup",
          method: ShippingMethod.PICKUP,
          label: "Retiro coordinado",
          detail: "Listo para coordinar en 2 horas",
          costAmountMinor: 0,
          currency: "ARS",
          isActive: true,
          isDefault: false,
          position: 2,
        },
      ],
      scope: "public",
      updatedBy: ownerId,
    },
    {
      id: "12121212-1212-4121-8121-121212121214",
      key: "payments.methods",
      value: [
        { id: PaymentMethodId.VISA, label: "Visa", provider: "stripe", isEnabled: true, position: 0, credentialsRef: "sm://payments/stripe", installmentsMax: 12 },
        { id: PaymentMethodId.MASTERCARD, label: "Mastercard", provider: "stripe", isEnabled: true, position: 1, credentialsRef: "sm://payments/stripe", installmentsMax: 12 },
        { id: PaymentMethodId.AMEX, label: "American Express", provider: "stripe", isEnabled: true, position: 2, credentialsRef: "sm://payments/stripe", installmentsMax: 6 },
        { id: PaymentMethodId.MERCADOPAGO, label: "MercadoPago", provider: "mercadopago", isEnabled: false, position: 3, credentialsRef: "sm://payments/mercadopago" },
        { id: PaymentMethodId.MODO, label: "MODO", provider: "modo", isEnabled: false, position: 4, credentialsRef: "sm://payments/modo" },
        { id: PaymentMethodId.EFECTIVO, label: "Efectivo", provider: "offline", isEnabled: true, position: 5 },
      ],
      scope: "business",
      updatedBy: ownerId,
    },
  ])
  .onConflictDoNothing();

await db
  .insert(featureFlag)
  .values({
    id: "13131313-1313-4131-8131-131313131311",
    key: "checkout.v2",
    enabled: false,
    owner: ownerEmail,
    reviewAt: "2026-10-01",
    removalPlan: "Eliminar cuando checkout v2 sea estable.",
    description: "Flag demo para probar el nuevo checkout.",
    updatedBy: ownerId,
  })
  .onConflictDoNothing();

const demoCategories = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Refrigeradores", slug: "refrigeradores", position: 10 },
  { id: "11111111-1111-4111-8111-111111111112", name: "Computadoras", slug: "computadoras", position: 20 },
  { id: "11111111-1111-4111-8111-111111111113", name: "Lavadoras", slug: "lavadoras", position: 30 },
  { id: "11111111-1111-4111-8111-111111111114", name: "Celulares", slug: "celulares", position: 40 },
  { id: "11111111-1111-4111-8111-111111111115", name: "Electrodomesticos", slug: "electrodomesticos", position: 50 },
  { id: "11111111-1111-4111-8111-111111111116", name: "Aspiradoras", slug: "aspiradoras", position: 60 },
  { id: "11111111-1111-4111-8111-111111111117", name: "Audio y Video", slug: "audio-y-video", position: 70 },
];

for (const demoCategory of demoCategories) {
  await db
    .insert(category)
    .values({
      ...demoCategory,
      parentId: null,
      description: `Categoria demo para ${demoCategory.name}.`,
      imageId: null,
      isActive: true,
      seoTitle: `${demoCategory.name} para comprar online`,
      seoDescription: `Explora productos de ${demoCategory.name} seleccionados para CloudCommerce.`,
    })
    .onConflictDoNothing();
}

const demoBrandId = "22222222-2222-4222-8222-222222222222";
await db
  .insert(brand)
  .values({
    id: demoBrandId,
    name: "Cloud Demo",
    slug: "cloud-demo",
    logoId: null,
    isActive: true,
  })
  .onConflictDoNothing();

const storageRoot = resolve(process.env.STORAGE_LOCAL_ROOT ?? ".cloudcommerce-media");
const demoImageBody = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);
const demoMedia = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  return {
    id: `33333333-3333-4333-8333-33333333333${number}`,
    storageKey: `seed/demo-product-${number}.png`,
    checksum: `seed-demo-product-${number}`,
    position: index,
  };
});

for (const media of demoMedia) {
  const target = resolve(storageRoot, media.storageKey);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, demoImageBody).catch(() => undefined);
  await db
    .insert(mediaAsset)
    .values({
      id: media.id,
      storageKey: media.storageKey,
      mime: "image/png",
      byteSize: demoImageBody.byteLength,
      width: 1,
      height: 1,
      dominantColor: "#f5f5f5",
      blurPlaceholder: null,
      altText: "Imagen demo de producto",
      source: MediaSource.UPLOAD,
      checksum: media.checksum,
      createdBy: ownerId,
    })
    .onConflictDoNothing();
}

const demoProductId = "44444444-4444-4444-8444-444444444444";
await db
  .insert(product)
  .values({
    id: demoProductId,
    slug: "smartphone-demo-128gb",
    title: "Smartphone Demo 128GB",
    subtitle: "Pantalla AMOLED, bateria de larga duracion y carga rapida",
    description:
      "Smartphone demo para validar el catalogo del panel administrativo con descripcion completa, variantes, imagenes y especificaciones estructuradas.",
    brandId: demoBrandId,
    categoryId: "11111111-1111-4111-8111-111111111114",
    status: ProductStatus.READY_FOR_REVIEW,
    mainImageId: demoMedia[0]?.id ?? null,
    sku: "DEMO-PHONE-128",
    seoTitle: "Smartphone Demo 128GB CloudCommerce",
    seoDescription: "Compra el Smartphone Demo 128GB con pantalla AMOLED, gran bateria y variantes listas para el catalogo.",
  })
  .onConflictDoNothing();

for (const media of demoMedia) {
  await db
    .insert(productMedia)
    .values({
      id: uuidv7(),
      productId: demoProductId,
      mediaAssetId: media.id,
      position: media.position,
      altText: `Smartphone Demo vista ${media.position + 1}`,
    })
    .onConflictDoNothing();
}

const demoVariants = [
  {
    id: "66666666-6666-4666-8666-666666666661",
    sku: "DEMO-PHONE-128-BLK",
    title: "Negro / 128GB",
    attributes: { color: "negro", capacity: "128GB" },
    position: 0,
    costAmountMinor: 320_000,
    onHand: 24,
  },
  {
    id: "66666666-6666-4666-8666-666666666662",
    sku: "DEMO-PHONE-128-BLU",
    title: "Azul / 128GB",
    attributes: { color: "azul", capacity: "128GB" },
    position: 1,
    costAmountMinor: 330_000,
    onHand: 12,
  },
];

for (const variant of demoVariants) {
  await db
    .insert(productVariant)
    .values({
      id: variant.id,
      productId: demoProductId,
      sku: variant.sku,
      title: variant.title,
      isActive: true,
      attributes: variant.attributes,
      position: variant.position,
    })
    .onConflictDoNothing();
}

await db
  .insert(priceList)
  .values({
    id: "77777777-7777-4777-8777-777777777771",
    name: "ARS Default",
    isDefault: true,
    currency: "ARS",
  })
  .onConflictDoNothing();

await db
  .insert(markupRule)
  .values({
    id: "77777777-7777-4777-8777-777777777772",
    scope: PricingScope.GLOBAL,
    scopeId: null,
    kind: PricingValueKind.PERCENT,
    value: 5_000,
    minMarginBps: 2_500,
    isActive: true,
    createdBy: ownerId,
  })
  .onConflictDoNothing();

const demoSupplierId = "88888888-8888-4888-8888-888888888881";
for (const variant of demoVariants) {
  await db
    .insert(supplierCost)
    .values({
      id: `88888888-8888-4888-8888-88888888888${variant.position + 2}`,
      variantId: variant.id,
      supplierId: demoSupplierId,
      costAmountMinor: variant.costAmountMinor,
      currency: "ARS",
    })
    .onConflictDoNothing();

  await db
    .insert(stockItem)
    .values({
      id: `99999999-9999-4999-8999-99999999999${variant.position + 1}`,
      variantId: variant.id,
      onHand: variant.onHand,
      reserved: 0,
      reorderPoint: 5,
    })
    .onConflictDoUpdate({
      target: stockItem.variantId,
      set: {
        onHand: variant.onHand,
        reserved: 0,
        reorderPoint: 5,
        updatedAt: new Date(),
      },
    });

  await db
    .insert(stockMovement)
    .values({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${variant.position + 1}`,
      variantId: variant.id,
      type: StockMovementType.IMPORT,
      quantity: variant.onHand,
      reason: "Seed de inventario demo",
      refType: "seed",
      refId: variant.sku,
      createdBy: ownerId,
    })
    .onConflictDoNothing();
}

const specGroupId = "55555555-5555-4555-8555-555555555555";
await db
  .insert(specGroup)
  .values({
    id: specGroupId,
    productId: demoProductId,
    name: "Caracteristicas principales",
    position: 0,
  })
  .onConflictDoNothing();

const demoSpecs = [
  { key: "screen", label: "Pantalla", valueText: "AMOLED 6.5 pulgadas", valueNum: null, unit: null, position: 0 },
  { key: "storage", label: "Almacenamiento", valueText: null, valueNum: "128", unit: "GB", position: 1 },
  { key: "battery", label: "Bateria", valueText: null, valueNum: "5000", unit: "mAh", position: 2 },
];

for (const item of demoSpecs) {
  await db
    .insert(specItem)
    .values({
      id: uuidv7(),
      specGroupId,
      ...item,
    })
    .onConflictDoNothing();
}

const demoCustomers = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    firstName: "Demo",
    lastName: "Customer",
    displayName: "Demo Customer",
    email: "demo.customer@example.com",
    whatsapp: "+5491134567890",
    notes: "Cliente demo CloudPrime con historial de contactos.",
    tier: CustomerTier.CloudPrime,
    addresses: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        label: "Casa",
        recipientName: "Demo Customer",
        province: "Ciudad Autonoma de Buenos Aires",
        city: "CABA",
        street: "Av. Corrientes",
        streetNumber: "1234",
        betweenStreets: "Libertad y Talcahuano",
        postalCode: "1043",
        isPrimary: true,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc2",
        label: "Oficina",
        recipientName: "Demo Customer",
        province: "Ciudad Autonoma de Buenos Aires",
        city: "CABA",
        street: "Maipu",
        streetNumber: "255",
        betweenStreets: "Sarmiento y Peron",
        postalCode: "1006",
        isPrimary: false,
      },
    ],
    contacts: [
      { id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1", channel: CustomerContactChannel.CALL, direction: CustomerContactDirection.IN, note: "Consulta por garantia extendida" },
      { id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd2", channel: CustomerContactChannel.WHATSAPP, direction: CustomerContactDirection.OUT, note: "Envio de seguimiento postventa" },
      { id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd3", channel: CustomerContactChannel.CALL, direction: CustomerContactDirection.IN, note: "Confirmo recepcion de producto" },
    ],
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
    firstName: "Valentina",
    lastName: "Rios",
    displayName: "Valentina Rios",
    email: "valentina.rios@example.com",
    whatsapp: null,
    notes: "Cliente demo con whatsapp ausente.",
    tier: CustomerTier.CloudPlus,
    addresses: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc3",
        label: "Casa",
        recipientName: "Valentina Rios",
        province: "Buenos Aires",
        city: "La Plata",
        street: "Calle 12",
        streetNumber: null,
        betweenStreets: "54 y 55",
        postalCode: "1900",
        isPrimary: true,
      },
    ],
    contacts: [
      { id: "dddddddd-dddd-4ddd-8ddd-ddddddddddd4", channel: CustomerContactChannel.EMAIL, direction: CustomerContactDirection.OUT, note: "Aviso de promocion" },
    ],
  },
];

for (const demoCustomer of demoCustomers) {
  await db
    .insert(customer)
    .values({
      id: demoCustomer.id,
      firstName: demoCustomer.firstName,
      lastName: demoCustomer.lastName,
      displayName: demoCustomer.displayName,
      email: demoCustomer.email,
      whatsapp: demoCustomer.whatsapp,
      notes: demoCustomer.notes,
      tier: demoCustomer.tier,
    })
    .onConflictDoNothing();

  for (const address of demoCustomer.addresses) {
    await db
      .insert(customerAddress)
      .values({
        customerId: demoCustomer.id,
        ...address,
      })
      .onConflictDoNothing();
  }

  for (const contact of demoCustomer.contacts) {
    await db
      .insert(customerContactLog)
      .values({
        customerId: demoCustomer.id,
        createdBy: ownerId,
        occurredAt: new Date(),
        ...contact,
      })
      .onConflictDoNothing();
  }
}

const demoOrderId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const demoOrderLineId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";
const demoOrderStatusEventId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3";
const demoDocumentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4";
const demoDocumentSequenceId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee5";
const demoFinanceSnapshotId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee6";
const demoOrderTotalMinor = 480_000;
const demoOrderCostMinor = 320_000;
const demoOrderNumber = "ORD-2026-000001";
const demoDocumentDisplayNumber = "R-0001";
const demoIssuedAt = new Date("2026-07-01T12:00:00.000Z");

await db
  .insert(orderTable)
  .values({
    id: demoOrderId,
    orderNumber: demoOrderNumber,
    customerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    status: OrderStatus.CONFIRMED,
    channel: OrderChannel.ADMIN_MANUAL,
    currency: "ARS",
    subtotalMinor: demoOrderTotalMinor,
    shippingMinor: 0,
    discountMinor: 0,
    taxMinor: 0,
    totalMinor: demoOrderTotalMinor,
    shippingMethod: ShippingMethod.STANDARD,
    shippingAddressId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
    placedBy: ownerId,
    notes: "Pedido demo generado por seed.",
    confirmedAt: demoIssuedAt,
    createdAt: demoIssuedAt,
    updatedAt: demoIssuedAt,
  })
  .onConflictDoNothing();

await db
  .insert(orderLine)
  .values({
    id: demoOrderLineId,
    orderId: demoOrderId,
    variantId: "66666666-6666-4666-8666-666666666661",
    productTitleSnapshot: "Smartphone Demo 128GB - Negro / 128GB",
    skuSnapshot: "DEMO-PHONE-128-BLK",
    quantity: 1,
    unitPriceMinor: demoOrderTotalMinor,
    lineTotalMinor: demoOrderTotalMinor,
    supplierCostSnapshotMinor: demoOrderCostMinor,
  })
  .onConflictDoNothing();

await db
  .insert(orderStatusEvent)
  .values({
    id: demoOrderStatusEventId,
    orderId: demoOrderId,
    fromStatus: null,
    toStatus: OrderStatus.CONFIRMED,
    reason: "Seed de pedido demo",
    actorId: ownerId,
    createdAt: demoIssuedAt,
  })
  .onConflictDoNothing();

await db
  .update(stockItem)
  .set({ onHand: 23, reserved: 0, updatedAt: new Date() })
  .where(eq(stockItem.variantId, "66666666-6666-4666-8666-666666666661"));

await db
  .insert(stockMovement)
  .values({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    variantId: "66666666-6666-4666-8666-666666666661",
    type: StockMovementType.SALE,
    quantity: -1,
    reason: "Seed de pedido demo confirmado",
    refType: "order",
    refId: demoOrderId,
    createdBy: ownerId,
    createdAt: demoIssuedAt,
  })
  .onConflictDoNothing();

await db
  .insert(documentSequence)
  .values({
    id: demoDocumentSequenceId,
    type: DocumentType.REMITO,
    series: "A",
    nextNumber: 2,
  })
  .onConflictDoNothing();

const demoDocumentBody = Buffer.from(
  `CloudCommerce Document\n{"displayNumber":"${demoDocumentDisplayNumber}","orderNumber":"${demoOrderNumber}"}\n`,
  "utf8",
);
const demoDocumentStorageKey = "documents/remito/A/R-0001.ccdoc";
const demoDocumentPath = resolve(storageRoot, demoDocumentStorageKey);
await mkdir(dirname(demoDocumentPath), { recursive: true });
await writeFile(demoDocumentPath, demoDocumentBody).catch(() => undefined);

await db
  .insert(commercialDocument)
  .values({
    id: demoDocumentId,
    type: DocumentType.REMITO,
    series: "A",
    number: 1,
    displayNumber: demoDocumentDisplayNumber,
    orderId: demoOrderId,
    customerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    status: DocumentStatus.AVAILABLE,
    issuedAt: demoIssuedAt,
    totalMinor: demoOrderTotalMinor,
    currency: "ARS",
    pdfStorageKey: demoDocumentStorageKey,
    pdfChecksum: "seed-demo-document-checksum",
    contentHash: "seed-demo-document-content",
    relatedDocumentId: null,
    createdBy: ownerId ?? "00000000-0000-0000-0000-000000000000",
    createdAt: demoIssuedAt,
    updatedAt: demoIssuedAt,
  })
  .onConflictDoNothing();

await db
  .insert(financePeriodSnapshot)
  .values({
    id: demoFinanceSnapshotId,
    period: "2026-07",
    currency: "ARS",
    revenueMinor: demoOrderTotalMinor,
    costMinor: demoOrderCostMinor,
    marginMinor: demoOrderTotalMinor - demoOrderCostMinor,
    ordersCount: 1,
    computedAt: demoIssuedAt,
    sourceVersion: "orders.v1",
    isStale: false,
  })
  .onConflictDoNothing();

await sql.end();
