import { Pool } from 'pg';
import { hashPassword } from './auth';
export const ids = {
  org: '10000000-0000-4000-8000-000000000001',
  otherOrg: '10000000-0000-4000-8000-000000000002',
  admin: '20000000-0000-4000-8000-000000000001',
  member: '20000000-0000-4000-8000-000000000002',
  outsider: '20000000-0000-4000-8000-000000000003',
  room: '30000000-0000-4000-8000-000000000001',
  studio: '30000000-0000-4000-8000-000000000002',
  desk: '30000000-0000-4000-8000-000000000003',
  lab: '30000000-0000-4000-8000-000000000004',
};
export async function seed(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO organizations VALUES($1,$2),($3,$4) ON CONFLICT DO NOTHING', [
      ids.org,
      'Ateliê Collective',
      ids.otherOrg,
      'Outra organização',
    ]);
    const hash = await hashPassword('Slotline-demo-2026!');
    for (const [id, org, name, email, role] of [
      [ids.admin, ids.org, 'Alex Morgan', 'alex@slotline.local', 'admin'],
      [ids.member, ids.org, 'Sam Costa', 'sam@slotline.local', 'member'],
      [ids.outsider, ids.otherOrg, 'Taylor Silva', 'taylor@slotline.local', 'member'],
    ]) {
      await client.query('INSERT INTO users VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [
        id,
        org,
        name,
        email,
        hash,
        role,
      ]);
    }
    for (const [id, name, kind, capacity, description] of [
      [
        ids.room,
        'Sala Horizonte',
        'Reunião',
        8,
        'Luz natural, tela 4K e espaço para grandes ideias.',
      ],
      [
        ids.studio,
        'Estúdio Forma',
        'Criação',
        4,
        'Um ambiente silencioso para gravar, criar e experimentar.',
      ],
      [ids.desk, 'Mesa Jardim', 'Foco', 1, 'Seu próximo estado de fluxo começa aqui.'],
      [
        ids.lab,
        'Laboratório de concorrência',
        'Laboratório',
        2,
        'Recurso dedicado a experimentar disputas sem afetar a agenda.',
      ],
    ]) {
      await client.query('INSERT INTO resources VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING', [
        id,
        ids.org,
        name,
        kind,
        capacity,
        description,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
