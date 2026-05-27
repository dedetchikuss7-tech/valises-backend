import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const SKIP_USER_STATUS_CHECK = 'skipUserStatusCheck';

@Injectable()
export class UserStatusGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_USER_STATUS_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.userId) return true;

    if (user.role === 'ADMIN') return true;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        bannedAt: true,
        suspendedAt: true,
        suspendedUntil: true,
      },
    });

    if (!dbUser) return true;

    if (dbUser.bannedAt) {
      throw new UnauthorizedException('Your account has been banned.');
    }

    if (dbUser.suspendedAt) {
      const isStillSuspended =
        !dbUser.suspendedUntil || dbUser.suspendedUntil > new Date();
      if (isStillSuspended) {
        throw new ForbiddenException('Your account is currently suspended.');
      }
    }

    return true;
  }
}
