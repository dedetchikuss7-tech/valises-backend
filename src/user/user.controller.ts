import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '@prisma/client';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // Create user (for now kept simple; you can restrict to ADMIN later)
  @Post()
  async create(@Body() body: { email: string; password: string; role?: Role }) {
    return this.userService.createUser(body.email, body.password, body.role);
  }

  // List users (restricted)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  // Get user by id (restricted)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}