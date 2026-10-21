// VoteType is defined in shared/contracts/values.ts (session 01).
// Session 01 did not complete in this run; this import will resolve once it does.
import type { VoteType } from '../../shared/contracts/values';
import { logger } from './logger';

export type DomainEvent =
  | { type: 'vote.recorded'; assetId: string; userId: string; voteType: VoteType; campaignIds: string[] }
  | { type: 'vote.milestone'; userId: string; badge: string }
  | { type: 'asset.certified'; assetId: string }
  | { type: 'asset.registered'; assetId: string; isNewVersion: boolean }
  | { type: 'campaign.created'; campaignId: string }
  | { type: 'campaign.completed'; campaignId: string };

type EventType = DomainEvent['type'];
type EventOfType<T extends EventType> = Extract<DomainEvent, { type: T }>;
type EventHandler<T extends EventType> = (event: EventOfType<T>) => Promise<void>;

export class EventBus {
  private handlers = new Map<string, EventHandler<EventType>[]>();

  on<T extends EventType>(type: T, handler: EventHandler<T>): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as EventHandler<EventType>);
    this.handlers.set(type, existing);
  }

  emit(event: DomainEvent): void {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      // Fire-and-forget: handler errors are logged, not thrown
      handler(event).catch((err: unknown) => {
        logger.error('Event handler failed', {
          eventType: event.type,
          error: (err as Error).message,
        });
      });
    }
  }
}
