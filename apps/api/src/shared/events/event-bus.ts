import type { DomainEvent } from "./domain-event.js";

type Handler<TEvent extends DomainEvent> = (event: TEvent) => Promise<void> | void;

export class InMemoryEventBus {
  private readonly handlers = new Map<string, Array<Handler<DomainEvent>>>();

  public subscribe<TEvent extends DomainEvent>(eventType: string, handler: Handler<TEvent>): void {
    const handlers = this.handlers.get(eventType) ?? [];
    handlers.push(handler as Handler<DomainEvent>);
    this.handlers.set(eventType, handlers);
  }

  public async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }
}
