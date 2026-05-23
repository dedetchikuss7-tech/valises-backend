// src/user/user.controller.ts
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async create(@Body() body: CreateUserDto) {
    return this.userService.createUser(body.email, body.password, body.role);
  }

  @Get()
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  @ApiForbiddenResponse({ description: 'Admin role required.' })
  async findById(@Param('id') id: string) {
    return this.userService.findById(id);
  }
}
