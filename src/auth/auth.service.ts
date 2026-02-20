import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // IMPORTANT: le hash est dans user.password (pas passwordHash)
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const payload = { sub: user.id, role: user.role };

    const access_token = await this.jwt.signAsync(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
      },
    };
  }
}