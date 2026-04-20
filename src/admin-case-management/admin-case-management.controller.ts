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
import { AddAdminCaseNoteDto } from './dto/add-admin-case-note.dto';
import { AdminCaseManagementResponseDto } from './dto/admin-case-management-response.dto';
import { AdminCaseTransitionDto } from './dto/admin-case-transition.dto';
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

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get()
  @ApiOperation({
    summary: 'List transverse admin-managed cases',
    description:
      'Returns admin-manageable cases across AML, disputes, payouts, refunds, and abandonment with derived case status.',
  })
  @ApiOkResponse({
    description: 'Transverse admin-managed cases',
    type: AdminCaseManagementResponseDto,
    isArray: true,
  })
  async listCases(@Query() query: ListAdminCaseManagementQueryDto) {
    return this.adminCaseManagementService.listCases(query);
  }

  @Get(':sourceType/:sourceId')
  @ApiOperation({
    summary: 'Get one transverse admin-managed case',
    description:
      'Returns one transverse admin-managed case by source type and source id.',
  })
  @ApiParam({ name: 'sourceType', enum: AdminCaseSourceType })
  @ApiParam({ name: 'sourceId', description: 'Underlying source object id' })
  @ApiOkResponse({
    description: 'One transverse admin-managed case',
    type: AdminCaseManagementResponseDto,
  })
  async getCase(
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
  ) {
    return this.adminCaseManagementService.getCase(sourceType, sourceId);
  }

  @Post('open-from-source')
  @ApiOperation({
    summary: 'Open a transverse case from a source object',
    description:
      'Creates an admin action audit entry opening a transverse case from an AML, dispute, payout, refund, or abandonment source.',
  })
  @ApiBody({ type: OpenAdminCaseFromSourceDto })
  @ApiOkResponse({
    description: 'Opened transverse case',
    type: AdminCaseManagementResponseDto,
  })
  async openFromSource(
    @Req() req: any,
    @Body() body: OpenAdminCaseFromSourceDto,
  ) {
    return this.adminCaseManagementService.openFromSource(
      body,
      this.userId(req),
    );
  }

  @Post(':sourceType/:sourceId/take')
  @ApiOperation({
    summary: 'Take ownership of a transverse case',
    description: 'Marks a case as in progress and assigns it to the current admin.',
  })
  @ApiBody({ type: AdminCaseTransitionDto })
  @ApiOkResponse({
    description: 'Taken transverse case',
    type: AdminCaseManagementResponseDto,
  })
  async takeCase(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AdminCaseTransitionDto,
  ) {
    return this.adminCaseManagementService.takeCase(
      sourceType,
      sourceId,
      this.userId(req),
      body,
    );
  }

  @Post(':sourceType/:sourceId/release')
  @ApiOperation({
    summary: 'Release a transverse case',
    description: 'Releases ownership of a transverse case back to open state.',
  })
  @ApiBody({ type: AdminCaseTransitionDto })
  @ApiOkResponse({
    description: 'Released transverse case',
    type: AdminCaseManagementResponseDto,
  })
  async releaseCase(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AdminCaseTransitionDto,
  ) {
    return this.adminCaseManagementService.releaseCase(
      sourceType,
      sourceId,
      this.userId(req),
      body,
    );
  }

  @Post(':sourceType/:sourceId/resolve')
  @ApiOperation({
    summary: 'Resolve a transverse case',
    description: 'Marks a transverse case as resolved.',
  })
  @ApiBody({ type: AdminCaseTransitionDto })
  @ApiOkResponse({
    description: 'Resolved transverse case',
    type: AdminCaseManagementResponseDto,
  })
  async resolveCase(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AdminCaseTransitionDto,
  ) {
    return this.adminCaseManagementService.resolveCase(
      sourceType,
      sourceId,
      this.userId(req),
      body,
    );
  }

  @Post(':sourceType/:sourceId/notes')
  @ApiOperation({
    summary: 'Add admin note to a transverse case',
    description: 'Appends an admin note to a transverse case timeline.',
  })
  @ApiBody({ type: AddAdminCaseNoteDto })
  @ApiOkResponse({
    description: 'Case with appended note',
    type: AdminCaseManagementResponseDto,
  })
  async addNote(
    @Req() req: any,
    @Param('sourceType') sourceType: AdminCaseSourceType,
    @Param('sourceId') sourceId: string,
    @Body() body: AddAdminCaseNoteDto,
  ) {
    return this.adminCaseManagementService.addNote(
      sourceType,
      sourceId,
      this.userId(req),
      body,
    );
  }
}