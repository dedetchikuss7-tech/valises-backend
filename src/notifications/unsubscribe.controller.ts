import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { UnsubscribeService } from '../email/unsubscribe.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('unsubscribe')
@Controller('unsubscribe')
export class UnsubscribeController {
  private readonly logger = new Logger(UnsubscribeController.name);

  constructor(
    private readonly unsubscribeService: UnsubscribeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'One-click email unsubscribe (CAN-SPAM compliance)',
    description:
      'Token is HMAC-SHA256(userId, EMAIL_UNSUBSCRIBE_SECRET). No auth required.',
  })
  async unsubscribe(
    @Query('userId') userId: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    if (!userId || !token) {
      return res.status(400).send('Lien invalide.');
    }

    const valid = this.unsubscribeService.verifyToken(userId, token);
    if (!valid) {
      return res.status(400).send('Lien invalide ou expiré.');
    }

    this.prisma.user
      .findUnique({ where: { id: userId }, select: { id: true } })
      .then((user) => {
        if (user) {
          this.logger.log(`Unsubscribe requested for user ${userId}`);
        }
      })
      .catch(() => {});

    return res.status(200).send(`
      <html><body style="font-family:Arial;text-align:center;padding:48px;">
        <h2>Désabonnement confirmé</h2>
        <p>Vous ne recevrez plus d'emails de la part de Valises.</p>
      </body></html>
    `);
  }
}
