import { EventEmitter } from 'events';

// Global singleton event emitter across hot reloads
declare global {
  // eslint-disable-next-line no-var
  var globalEventEmitter: EventEmitter | undefined;
}

const eventEmitter: EventEmitter = global.globalEventEmitter || new EventEmitter();
eventEmitter.setMaxListeners(200);

if (process.env.NODE_ENV !== 'production') {
  global.globalEventEmitter = eventEmitter;
}

export interface RealtimePayload {
  type:
    | 'comment:created'
    | 'comment:updated'
    | 'comment:resolved'
    | 'comment:deleted'
    | 'status:changed'
    | 'version:created'
    | 'version:deleted'
    | 'asset:deleted'
    | 'notification:created';
  projectId?: string;
  assetId?: string;
  data: any;
  actorId?: string;
  timestamp: string;
}

export function emitRealtimeEvent(payload: RealtimePayload) {
  const channel = payload.assetId
    ? `asset:${payload.assetId}`
    : payload.projectId
    ? `project:${payload.projectId}`
    : 'global';

  eventEmitter.emit(channel, payload);
  eventEmitter.emit('all', payload);
}

export function subscribeToRealtimeEvents(
  channel: string,
  callback: (payload: RealtimePayload) => void
): () => void {
  eventEmitter.on(channel, callback);
  return () => {
    eventEmitter.off(channel, callback);
  };
}
