import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) throw new UnauthorizedException('Missing auth (Bearer token required)');
    return id;
  }

  @Post('packages')
  create(@Req() req: any, @Body() dto: CreatePackageDto) {
    return this.packageService.createDraft(this.userId(req), dto);
  }

  @Get('packages/me')
  mine(@Req() req: any) {
    return this.packageService.findMine(this.userId(req));
  }

  @Patch('packages/:id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.packageService.publish(this.userId(req), id);
  }

  @Patch('packages/:id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.packageService.cancel(this.userId(req), id);
  }
}