// src/user/user.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, Role, KycStatus } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(email: string, password: string, role?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const hashed = await bcrypt.hash(password, 10);

    // Par défaut USER (on durcira plus tard avec RBAC)
    const finalRole: Role = role === Role.ADMIN ? Role.ADMIN : Role.USER;

    const data: Prisma.UserCreateInput = {
      email: normalizedEmail,
      password: hashed,
      role: finalRole,
      kycStatus: KycStatus.NOT_STARTED,
    };

    const user = await this.prisma.user.create({ data });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.prisma.user.findUniqueOrThrow({
      where: { email: normalizedEmail },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      kycStatus: user.kycStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      kycStatus: u.kycStatus,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }
}