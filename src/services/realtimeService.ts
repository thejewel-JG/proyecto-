import { Response } from 'express';

interface ClientConnection {
  id: string;
  userId: string;
  res: Response;
}

class RealtimeHub {
  private clients: Map<string, ClientConnection> = new Map();

  addClient(connectionId: string, userId: string, res: Response) {
    this.clients.set(connectionId, { id: connectionId, userId, res });
  }

  removeClient(connectionId: string) {
    this.clients.delete(connectionId);
  }

  emitToUser(userId: string, event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        try {
          client.res.write(payload);
        } catch {
          this.clients.delete(client.id);
        }
      }
    }
  }

  broadcast(event: string, data: any) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this.clients.values()) {
      try {
        client.res.write(payload);
      } catch {
        this.clients.delete(client.id);
      }
    }
  }

  getOnlineUserIds(): string[] {
    const set = new Set<string>();
    for (const client of this.clients.values()) {
      if (client.userId && client.userId !== 'guest') {
        set.add(client.userId);
      }
    }
    return Array.from(set);
  }
}

export const realtimeHub = new RealtimeHub();
