import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(email: string, password: string, role: Role = Role.USER) {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('Email is required');
    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new BadRequestException('Email already in use');

    const hashedPassword = await bcrypt.hash(password, 10);

    const created = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        // IMPORTANT: on stocke le hash dans "password"
        password: hashedPassword,
        role,
        // si ton schema a un default Prisma pour kycStatus, tu peux ne rien mettre ici.
        // sinon, décommente et adapte si nécessaire :
        // kycStatus: KycStatus.NOT_STARTED,
      },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return created;
  }

  async findByEmail(email: string) {
    const normalizedEmail = (email ?? '').trim().toLowerCase();
    if (!normalizedEmail) return null;

    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteById(id: string) {
    await this.findById(id);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}