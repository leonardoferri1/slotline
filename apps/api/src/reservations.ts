import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsString, IsUUID, Length, Matches } from 'class-validator';
import { PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { Actor, AuthRequest, SessionGuard, digest } from './auth';
import { Database } from './database';

export class HoldDto {
  @ApiProperty() @IsUUID() resourceId!: string;
  @ApiProperty({ example: 'Planejamento do produto' })
  @IsString()
  @Length(3, 100)
  @Matches(/\S/)
  title!: string;
  @ApiProperty({ example: '2027-01-10T13:00:00Z' })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  startsAt!: string;
  @ApiProperty({ example: '2027-01-10T14:00:00Z' })
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  endsAt!: string;
}
class DayDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) day!: string;
}
export async function recordEvent(
  client: PoolClient,
  reservation: any,
  type: string,
  actorId: string | null,
) {
  await client.query(
    'INSERT INTO audit_events(organization_id,reservation_id,actor_id,type) VALUES($1,$2,$3,$4)',
    [reservation.organization_id, reservation.id, actorId, type],
  );
  await client.query('INSERT INTO outbox(reservation_id,type) VALUES($1,$2)', [
    reservation.id,
    type,
  ]);
}
// Every state-changing path takes the resource row lock first. Database EXCLUDE
// remains the final integrity boundary, including for writers outside this API.
export async function expireResource(client: PoolClient, resourceId: string) {
  const expired = await client.query(
    "UPDATE reservations SET status='expired' WHERE resource_id=$1 AND status='held' AND expires_at<=clock_timestamp() RETURNING *",
    [resourceId],
  );
  for (const reservation of expired.rows) await recordEvent(client, reservation, 'expired', null);
  return expired.rowCount ?? 0;
}
@Injectable()
export class ReservationsService {
  constructor(private readonly db: Database) {}
  async hold(actor: Actor, body: HoldDto, key: string) {
    if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
      throw new BadRequestException('Envie uma Idempotency-Key com 8 a 100 caracteres.');
    const start = new Date(body.startsAt),
      end = new Date(body.endsAt);
    if (
      !Number.isFinite(+start) ||
      !Number.isFinite(+end) ||
      +end <= +start ||
      +end - +start > 8 * 3600000
    )
      throw new BadRequestException('A reserva deve durar entre 1 minuto e 8 horas.');
    if (+end - +start < 60000) throw new BadRequestException('Duração mínima de 1 minuto.');
    const fingerprint = digest(
      JSON.stringify([body.resourceId, body.title.trim(), start.toISOString(), end.toISOString()]),
    );
    try {
      return await this.db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          actor.id + ':' + key,
        ]);
        const prior = await client.query(
          'SELECT * FROM idempotency_keys WHERE user_id=$1 AND key=$2',
          [actor.id, key],
        );
        if (prior.rowCount) {
          if (prior.rows[0].fingerprint !== fingerprint)
            throw new ConflictException('Esta chave já foi usada com outros dados.');
          return (
            await client.query('SELECT * FROM reservations WHERE id=$1', [
              prior.rows[0].reservation_id,
            ])
          ).rows[0];
        }
        const resource = await client.query(
          'SELECT id FROM resources WHERE id=$1 AND organization_id=$2 FOR UPDATE',
          [body.resourceId, actor.organization_id],
        );
        if (!resource.rowCount) throw new NotFoundException('Recurso não encontrado.');
        const {
          rows: [{ valid }],
        } = await client.query(
          "SELECT $1::timestamptz>clock_timestamp() AND $1::timestamptz<clock_timestamp()+interval '90 days' AS valid",
          [start],
        );
        if (!valid)
          throw new BadRequestException('Escolha um horário futuro nos próximos 90 dias.');
        await expireResource(client, body.resourceId);
        const result = await client.query(
          "INSERT INTO reservations(id,organization_id,resource_id,user_id,title,starts_at,ends_at,status,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,'held',clock_timestamp()+interval '5 minutes') RETURNING *",
          [
            randomUUID(),
            actor.organization_id,
            body.resourceId,
            actor.id,
            body.title.trim(),
            start,
            end,
          ],
        );
        const reservation = result.rows[0];
        await client.query(
          'INSERT INTO idempotency_keys(user_id,key,fingerprint,reservation_id) VALUES($1,$2,$3,$4)',
          [actor.id, key, fingerprint, reservation.id],
        );
        await recordEvent(client, reservation, 'held', actor.id);
        return reservation;
      });
    } catch (error: any) {
      if (error.code === '23P01')
        throw new ConflictException(
          'Este horário acabou de ser reservado. Escolha outro intervalo.',
        );
      throw error;
    }
  }
  async transition(actor: Actor, id: string, target: 'confirmed' | 'cancelled') {
    const result = await this.db.transaction(async (client) => {
      const found = await client.query(
        'SELECT * FROM reservations WHERE id=$1 AND organization_id=$2',
        [id, actor.organization_id],
      );
      if (!found.rowCount) throw new NotFoundException('Reserva não encontrada.');
      if (found.rows[0].user_id !== actor.id && actor.role !== 'admin')
        throw new ForbiddenException('Você só pode alterar suas próprias reservas.');
      await client.query('SELECT id FROM resources WHERE id=$1 FOR UPDATE', [
        found.rows[0].resource_id,
      ]);
      await expireResource(client, found.rows[0].resource_id);
      const reservation = (await client.query('SELECT * FROM reservations WHERE id=$1', [id]))
        .rows[0];
      if (reservation.status === target) return { reservation };
      if (reservation.status === 'expired' || reservation.status === 'cancelled')
        return { error: 'Esta reserva já foi encerrada.' };
      if (target === 'confirmed' && reservation.status !== 'held')
        return { error: 'Não é possível confirmar esta reserva.' };
      if (target === 'confirmed' && +new Date(reservation.starts_at) <= Date.now())
        return { error: 'O horário de início já passou.' };
      const updated = (
        await client.query('UPDATE reservations SET status=$2 WHERE id=$1 RETURNING *', [
          id,
          target,
        ])
      ).rows[0];
      await recordEvent(client, updated, target, actor.id);
      return { reservation: updated };
    });
    // Expiry must commit even when confirmation is rejected.
    if (result.error) throw new ConflictException(result.error);
    return result.reservation;
  }
}
@ApiTags('Reservations')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller()
export class ReservationsController {
  constructor(
    private readonly db: Database,
    private readonly reservations: ReservationsService,
  ) {}
  @Get('resources') async resources(@Req() req: AuthRequest) {
    return (
      await this.db.pool.query('SELECT * FROM resources WHERE organization_id=$1 ORDER BY name', [
        req.actor.organization_id,
      ])
    ).rows;
  }
  @Get('reservations') async list(@Req() req: AuthRequest, @Query() query: DayDto) {
    if (
      !Number.isFinite(Date.parse(query.day)) ||
      new Date(query.day).toISOString().slice(0, 10) !== query.day
    )
      throw new BadRequestException('Data inválida.');
    // The workspace calendar uses America/Sao_Paulo, independently of browser timezone.
    return (
      await this.db.pool.query(
        `SELECT r.id,r.resource_id,r.starts_at,r.ends_at,r.expires_at,r.created_at,
   CASE WHEN r.status='held' AND r.expires_at<=now() THEN 'expired' ELSE r.status END AS status,
   CASE WHEN r.user_id=$1 OR $3='admin' THEN r.title ELSE 'Ocupado' END AS title,
   r.user_id=$1 AS is_owner
   FROM reservations r WHERE r.organization_id=$2
   AND r.starts_at < (($4::date+1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
   AND r.ends_at > ($4::date::timestamp AT TIME ZONE 'America/Sao_Paulo') ORDER BY r.starts_at`,
        [req.actor.id, req.actor.organization_id, req.actor.role, query.day],
      )
    ).rows;
  }
  @Post('reservations')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  hold(@Req() req: AuthRequest, @Body() body: HoldDto, @Headers('idempotency-key') key: string) {
    return this.reservations.hold(req.actor, body, key);
  }
  @Post('reservations/:id/confirm') confirm(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservations.transition(req.actor, id, 'confirmed');
  }
  @Post('reservations/:id/cancel') cancel(
    @Req() req: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservations.transition(req.actor, id, 'cancelled');
  }
  @Get('activity') async activity(@Req() req: AuthRequest) {
    return (
      await this.db.pool.query(
        `SELECT a.id,a.type,a.created_at,r.title,s.name AS resource_name,u.name AS actor_name
   FROM audit_events a JOIN reservations r ON r.id=a.reservation_id JOIN resources s ON s.id=r.resource_id
   LEFT JOIN users u ON u.id=a.actor_id WHERE a.organization_id=$1 AND (r.user_id=$2 OR $3='admin') ORDER BY a.id DESC LIMIT 30`,
        [req.actor.organization_id, req.actor.id, req.actor.role],
      )
    ).rows;
  }
  @Get('notifications') async notifications(@Req() req: AuthRequest) {
    return (
      await this.db.pool.query(
        'SELECT n.*,r.title FROM notifications n JOIN reservations r ON r.id=n.reservation_id WHERE n.user_id=$1 ORDER BY n.event_id DESC LIMIT 30',
        [req.actor.id],
      )
    ).rows;
  }
}
