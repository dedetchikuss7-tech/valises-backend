import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { AddAdminCaseNoteDto } from './dto/add-admin-case-note.dto';
import { AdminCaseManagementResponseDto } from './dto/admin-case-management-response.dto';
import { AdminCaseTransitionDto } from './dto/admin-case-transition.dto';
import { BulkAdminCaseActionDto } from './dto/bulk-admin-case-action.dto';
import {
  AdminCaseSourceType,
  ListAdminCaseManagementQueryDto,
} from './dto/list-admin-case-management-query.dto';
import { OpenAdminCaseFromSourceDto } from './dto/open-admin-case-from-source.dto';
import { AdminCaseManagementService } from './admin-case-management.service';

@ApiTags('Admin Case Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/case-management')
export class AdminCaseManagementController {
  constructor(
    private readonly adminCaseManagementService: AdminCaseManagementService,
  ) {}

  private adminId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List transverse admin cases',
  })
  async listCases(@Query() query: ListAdminCaseManagementQueryDto) {
    return this.adminCaseManagementService.listCases(query);
  }

  @Get('cases/:sourceType/:sourceId')
  @ApiOperation({
    summary: 'Get one transverse admin case',
  })
  @ApiOkResponse({ type: AdminCaseManagementResponseDto })
  async getCase(
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
  ) {
    return this.adminCaseManagementService.getCase(sourceType, sourceId);
  }

  @Post('cases/open')
  @ApiOperation({
    summary: 'Open one case from a source object',
  })
  @ApiBody({ type: OpenAdminCaseFromSourceDto })
  async openFromSource(
    @Req() req: any,
    @Body() body: OpenAdminCaseFromSourceDto,
  ) {
    return this.adminCaseManagementService.openFromSource(
      body,
      this.adminId(req),
    );
  }

  @Post('cases/:sourceType/:sourceId/take')
  async takeCase(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AdminCaseTransitionDto,
  ) {
    return this.adminCaseManagementService.takeCase(
      sourceType,
      sourceId,
      this.adminId(req),
      body,
    );
  }

  @Post('cases/:sourceType/:sourceId/release')
  async releaseCase(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AdminCaseTransitionDto,
  ) {
    return this.adminCaseManagementService.releaseCase(
      sourceType,
      sourceId,
      this.adminId(req),
      body,
    );
  }

  @Post('cases/:sourceType/:sourceId/resolve')
  async resolveCase(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AdminCaseTransitionDto,
  ) {
    return this.adminCaseManagementService.resolveCase(
      sourceType,
      sourceId,
      this.adminId(req),
      body,
    );
  }

  @Post('cases/:sourceType/:sourceId/notes')
  async addNote(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AddAdminCaseNoteDto,
  ) {
    return this.adminCaseManagementService.addNote(
      sourceType,
      sourceId,
      this.adminId(req),
      body,
    );
  }

  @Post('cases/bulk/take')
  @ApiOperation({
    summary: 'Bulk take transverse admin cases',
  })
  @ApiBody({ type: BulkAdminCaseActionDto })
  @ApiOkResponse({ type: BulkActionResultDto })
  async bulkTake(
    @Req() req: any,
    @Body() body: BulkAdminCaseActionDto,
  ) {
    return this.adminCaseManagementService.bulkTakeCases(
      this.adminId(req),
      body,
    );
  }

  @Post('cases/bulk/release')
  @ApiOperation({
    summary: 'Bulk release transverse admin cases',
  })
  @ApiBody({ type: BulkAdminCaseActionDto })
  @ApiOkResponse({ type: BulkActionResultDto })
  async bulkRelease(
    @Req() req: any,
    @Body() body: BulkAdminCaseActionDto,
  ) {
    return this.adminCaseManagementService.bulkReleaseCases(
      this.adminId(req),
      body,
    );
  }

  @Post('cases/bulk/resolve')
  @ApiOperation({
    summary: 'Bulk resolve transverse admin cases',
  })
  @ApiBody({ type: BulkAdminCaseActionDto })
  @ApiOkResponse({ type: BulkActionResultDto })
  async bulkResolve(
    @Req() req: any,
    @Body() body: BulkAdminCaseActionDto,
  ) {
    return this.adminCaseManagementService.bulkResolveCases(
      this.adminId(req),
      body,
    );
  }
}