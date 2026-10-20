import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { Request, Response } from 'express';
import { Database } from './database';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
const scrypt = promisify(scryptCallback);
export type Actor = {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
};
export type AuthRequest = Request & { actor: Actor };
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(value: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(value, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
async function verify(value: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  const actual = (await scrypt(value, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly db: Database) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const token = req.cookies?.slotline;
    if (!token || typeof token !== 'string') throw new UnauthorizedException('Entre na sua conta.');
    const result = await this.db.pool.query(
      'SELECT u.id,u.organization_id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
      [digest(token)],
    );
    if (!result.rowCount) throw new UnauthorizedException('Sessão expirada. Entre novamente.');
    req.actor = result.rows[0];
    return true;
  }
}
class LoginDto {
  @ApiProperty({ example: 'alex@slotline.local' })
  @IsEmail()
  @MaxLength(200)
  email!: string;
  @ApiProperty({ example: 'Slotline-demo-2026!', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly db: Database) {}
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.db.pool.query('SELECT * FROM users WHERE email=$1', [
      body.email.toLowerCase(),
    ]);
    // Perform a password derivation for unknown users too.
    const fallback = '00000000000000000000000000000000:' + '00'.repeat(64);
    const valid = await verify(body.password, result.rows[0]?.password_hash ?? fallback);
    if (!valid || !result.rowCount) throw new UnauthorizedException('Email ou senha inválidos.');
    const token = randomBytes(32).toString('hex');
    await this.db.pool.query("INSERT INTO sessions VALUES($1,$2,now()+interval '8 hours')", [
      digest(token),
      result.rows[0].id,
    ]);
    res.cookie('slotline', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 3600000,
      path: '/api',
    });
    const { password_hash, ...user } = result.rows[0];
    return user;
  }
  @Get('me') @UseGuards(SessionGuard) me(@Req() req: AuthRequest) {
    return req.actor;
  }
  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    await this.db.pool.query('DELETE FROM sessions WHERE token_hash=$1', [
      digest(req.cookies.slotline),
    ]);
    res.clearCookie('slotline', { path: '/api' });
  }
}
