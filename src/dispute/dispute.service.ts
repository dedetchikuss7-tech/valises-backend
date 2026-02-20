// src/dispute/dispute.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DisputeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    transactionId: string;
    raisedById: string;
    reason: string;
    evidenceUrl?: string;
  }) {
    return this.prisma.dispute.create({
      data: {
        transactionId: data.transactionId,
        raisedById: data.raisedById,
        reason: data.reason,
        ...(data.evidenceUrl ? { evidenceUrl: data.evidenceUrl } : {}),
      },
    });
  }

  async findAll() {
    // NOTE: On évite orderBy tant qu’on n’a pas figé le champ DateTime (createdAt/openedAt/etc.)
    return this.prisma.dispute.findMany();
  }

  async findOne(id: string) {
    return this.prisma.dispute.findUniqueOrThrow({ where: { id } });
  }
}