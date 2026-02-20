import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisputeService {
  constructor(private prisma: PrismaService) {}

  async create(transactionId: string, raisedById: string, reason: string) {
    return this.prisma.dispute.create({
      data: {
        transactionId,
        raisedById,
        reason,
      },
    });
  }

  async findAll() {
    return this.prisma.dispute.findMany({
      include: {
        transaction: true,
        raisedBy: true,
      },
    });
  }
}
