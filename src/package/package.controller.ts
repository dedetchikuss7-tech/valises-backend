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
import { Role } from '@prisma/client';
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

  private userRole(req: any): Role {
    const role = req?.user?.role;
    if (!role) {
      throw new UnauthorizedException('Missing auth role');
    }
    return role as Role;
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

  @Patch('packages/:id/declare-handover')
  @ApiOperation({
    summary: 'Declare package handover',
    description:
      'Non-blocking handover signal. The sender or an admin can record that the physical handover of the package has taken place. This does not prove inspection and does not block or unlock the transaction flow in V1.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          nullable: true,
          description: 'Optional handover notes',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Package updated with handover declaration metadata',
    type: PackageResponseDto,
  })
  declareHandover(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { notes?: string },
  ) {
    return this.packageService.declareHandover(
      this.userId(req),
      this.userRole(req),
      id,
      body?.notes,
    );
  }

  @Patch('packages/:id/acknowledge-traveler-responsibility')
  @ApiOperation({
    summary: 'Acknowledge traveler responsibility',
    description:
      'Non-blocking traveler-side acknowledgement that it is the traveler’s responsibility to verify as much as reasonably possible the apparent nature and acceptability of the package before transport. This is an informational trace only in V1.',
  })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiOkResponse({
    description: 'Package updated with traveler responsibility acknowledgement metadata',
    type: PackageResponseDto,
  })
  acknowledgeTravelerResponsibility(
    @Req() req: any,
    @Param('id') id: string,
  ) {
    return this.packageService.acknowledgeTravelerResponsibility(
      this.userId(req),
      this.userRole(req),
      id,
    );
  }
}