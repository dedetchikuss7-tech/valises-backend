import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AmlService } from './aml.service';
import { AmlCaseResponseDto } from './dto/aml-case-response.dto';
import { EvaluateTransactionAmlResponseDto } from './dto/evaluate-transaction-aml-response.dto';
import { ListAmlCasesQueryDto } from './dto/list-aml-cases-query.dto';
import { ResolveAmlCaseDto } from './dto/resolve-aml-case.dto';

@ApiTags('AML')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('aml')
export class AmlController {
  constructor(private readonly amlService: AmlService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Post('transactions/:transactionId/evaluate')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Evaluate one transaction against AML light rules',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiOkResponse({ type: EvaluateTransactionAmlResponseDto })
  async evaluateTransaction(
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.amlService.evaluateTransaction(transactionId);
  }

  @Get('cases')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List AML cases with operational filters',
  })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'currentAction', required: false, type: String })
  @ApiQuery({ name: 'riskLevel', required: false, type: String })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'requiresAction', required: false, type: Boolean })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async listCases(@Query() query: ListAmlCasesQueryDto) {
    return this.amlService.listCases(query);
  }

  @Get('cases/:id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get one AML case',
  })
  @ApiParam({ name: 'id', description: 'AML case UUID' })
  @ApiOkResponse({ type: AmlCaseResponseDto })
  async getCase(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.amlService.getCase(id);
  }

  @Post('cases/:id/resolve')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Resolve an AML case',
  })
  @ApiParam({ name: 'id', description: 'AML case UUID' })
  @ApiBody({ type: ResolveAmlCaseDto })
  @ApiOkResponse({ type: AmlCaseResponseDto })
  async resolveCase(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ResolveAmlCaseDto,
    @Req() req: any,
  ) {
    return this.amlService.resolveCase(id, dto, this.userId(req));
  }
}