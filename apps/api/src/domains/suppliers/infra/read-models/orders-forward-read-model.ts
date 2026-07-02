import { customerAddress, order, orderLine } from "@cloudcommerce/database";
import { OrderStatus } from "@cloudcommerce/types";
import { eq } from "drizzle-orm";
import type { Database } from "../../../../infrastructure/database/client.js";
import type { ForwardableOrder } from "../../application/ports.js";

/**
 * Read model autorizado de solo lectura sobre orders/customers: arma el
 * payload mínimo del forward. Las escrituras de envío pasan por OrderService.
 */
export class OrdersForwardReadModel {
  public constructor(private readonly db: Database) {}

  public async getForwardableOrder(orderId: string): Promise<ForwardableOrder | null> {
    const orderRow = await this.db.query.order.findFirst({ where: eq(order.id, orderId) });
    if (!orderRow) {
      return null;
    }
    const lines = await this.db
      .select({
        variantId: orderLine.variantId,
        quantity: orderLine.quantity,
        title: orderLine.productTitleSnapshot,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, orderId));
    const address = orderRow.shippingAddressId
      ? await this.db.query.customerAddress.findFirst({ where: eq(customerAddress.id, orderRow.shippingAddressId) })
      : null;
    const confirmedStatuses: OrderStatus[] = [
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY_TO_SHIP,
    ];
    return {
      orderId: orderRow.id,
      orderNumber: orderRow.orderNumber,
      isConfirmed: confirmedStatuses.includes(orderRow.status as OrderStatus),
      lines,
      shippingAddress: address
        ? {
            recipientName: address.recipientName,
            province: address.province,
            city: address.city,
            street: address.street,
            streetNumber: address.streetNumber,
            postalCode: address.postalCode,
          }
        : null,
    };
  }
}
