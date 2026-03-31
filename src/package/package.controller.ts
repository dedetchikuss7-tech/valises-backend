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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { PackageResponseDto } from './dto/package-response.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@ApiTags('Packages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Post('packages')
  @ApiOperation({
    summary: 'Create package draft',
    description:
      'Creates a new package in DRAFT status for the authenticated sender.',
  })
  @ApiBody({ type: CreatePackageDto })
  @ApiOkResponse({
    description: 'Created package draft',
    type: PackageResponseDto,
  })
  create(@Req() req: any, @Body() dto: CreatePackageDto) {
    return this.packageService.createDraft(this.userId(req), dto);
  }

  @Get('packages/me')
  @ApiOperation({
    summary: 'List my packages',
    description:
      'Returns the packages belonging to the authenticated user, ordered by most recent first.',
  })
  @ApiOkResponse({
    description: 'Packages owned by the authenticated user',
    type: PackageResponseDto,
    isArray: true,
  })
  mine(@Req() req: any) {
    return this.packageService.findMine(this.userId(req));
  }

  @Patch('packages/:id/publish')
  @ApiOperation({
    summary: 'Publish package',
    description:
      'Publishes a draft package owned by the authenticated user.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOkResponse({
    description: 'Published package',
    type: PackageResponseDto,
  })
  publish(@Req() req: any, @Param('id') id: string) {
    return this.packageService.publish(this.userId(req), id);
  }

  @Patch('packages/:id/cancel')
  @ApiOperation({
    summary: 'Cancel package',
    description:
      'Cancels a package owned by the authenticated user when cancellation is allowed by business rules.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOkResponse({
    description: 'Cancelled package or already cancelled package',
    type: PackageResponseDto,
  })
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.packageService.cancel(this.userId(req), id);
  }
}