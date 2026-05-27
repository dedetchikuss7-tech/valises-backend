import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { bannedAt: true },
    });

    if (dbUser?.bannedAt) {
      const tokenIssuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
      if (!tokenIssuedAt || dbUser.bannedAt > tokenIssuedAt) {
        throw new UnauthorizedException('Account banned.');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}