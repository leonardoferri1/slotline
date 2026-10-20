import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Database } from './database';
import { expireResource } from './reservations';
@Injectable()
export class Worker implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;
  private readonly logger = new Logger('OutboxWorker');
  constructor(private readonly db: Database) {}
  onModuleInit() {
    if (process.env.WORKER_DISABLED === 'true') return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.tick()
          .catch((e) => this.logger.error(e.message))
          .finally(() => {
            this.running = undefined;
          });
    }, 2000);
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
  async tick() {
    await this.db.transaction(async (client) => {
      const resources = await client.query(
        "SELECT id FROM resources WHERE id IN(SELECT resource_id FROM reservations WHERE status='held' AND expires_at<=now()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100",
      );
      for (const resource of resources.rows) await expireResource(client, resource.id);
    });
    await this.db.transaction(async (client) => {
      const events = await client.query(
        'SELECT * FROM outbox WHERE delivered_at IS NULL ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 100',
      );
      for (const event of events.rows) {
        await client.query(
          'INSERT INTO notifications(event_id,user_id,reservation_id,type) SELECT $1,user_id,id,$3 FROM reservations WHERE id=$2 ON CONFLICT(event_id) DO NOTHING',
          [event.id, event.reservation_id, event.type],
        );
        await client.query('UPDATE outbox SET delivered_at=now() WHERE id=$1', [event.id]);
      }
    });
  }
}
