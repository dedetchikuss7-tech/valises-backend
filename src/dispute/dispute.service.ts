// src/dispute/dispute.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisputeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: { transactionId: string; raisedById: string; reason: string }) {
  return this.prisma.dispute.create({
    data: {
      reason: data.reason,
      transaction: { connect: { id: data.transactionId } },
      openedBy: { connect: { id: data.raisedById } },
    },
  });
}

  async findAll() {
    return this.prisma.dispute.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    return this.prisma.dispute.findUniqueOrThrow({ where: { id } });
  }
}