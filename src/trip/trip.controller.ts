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
import { TripService } from './trip.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { AdminVerifyTicketDto } from './dto/admin-verify-ticket.dto';
import { TripResponseDto } from './dto/trip-response.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TripController {
  constructor(private readonly tripService: TripService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Post('trips')
  @ApiOperation({
    summary: 'Create trip draft',
    description:
      'Creates a new trip in DRAFT status for the authenticated traveler/carrier.',
  })
  @ApiBody({ type: CreateTripDto })
  @ApiOkResponse({
    description: 'Created trip draft',
    type: TripResponseDto,
  })
  create(@Req() req: any, @Body() dto: CreateTripDto) {
    return this.tripService.createDraft(this.userId(req), dto);
  }

  @Get('trips/me')
  @ApiOperation({
    summary: 'List my trips',
    description:
      'Returns the trips belonging to the authenticated user, ordered by most recent first.',
  })
  @ApiOkResponse({
    description: 'Trips owned by the authenticated user',
    type: TripResponseDto,
    isArray: true,
  })
  myTrips(@Req() req: any) {
    return this.tripService.findMine(this.userId(req));
  }

  @Patch('trips/:id/submit-ticket')
  @ApiOperation({
    summary: 'Submit trip ticket',
    description:
      'Marks the flight ticket as provided for a draft trip owned by the authenticated user.',
  })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: SubmitTicketDto })
  @ApiOkResponse({
    description: 'Trip updated after ticket submission',
    type: TripResponseDto,
  })
  submitTicket(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitTicketDto,
  ) {
    return this.tripService.submitTicket(this.userId(req), id, dto);
  }

  @Patch('trips/:id/publish')
  @ApiOperation({
    summary: 'Publish trip',
    description:
      'Publishes a draft trip after the flight ticket has been verified.',
  })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiOkResponse({
    description: 'Published trip',
    type: TripResponseDto,
  })
  publish(@Req() req: any, @Param('id') id: string) {
    return this.tripService.publish(this.userId(req), id);
  }

  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/trips/:id/verify-ticket')
  @ApiOperation({
    summary: 'Admin verify trip ticket',
    description:
      'Admin-only endpoint that verifies or rejects the submitted flight ticket for a trip.',
  })
  @ApiParam({ name: 'id', description: 'Trip ID' })
  @ApiBody({ type: AdminVerifyTicketDto })
  @ApiOkResponse({
    description: 'Trip updated after admin ticket review',
    type: TripResponseDto,
  })
  adminVerify(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AdminVerifyTicketDto,
  ) {
    return this.tripService.adminVerifyTicket(this.userId(req), id, dto.decision);
  }
}