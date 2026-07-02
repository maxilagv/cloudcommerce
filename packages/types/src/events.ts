export type DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  occurredAt: Date;
};
