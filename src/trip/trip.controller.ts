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
import { TripService } from './trip.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { SubmitTicketDto } from './dto/submit-ticket.dto';
import { AdminVerifyTicketDto } from './dto/admin-verify-ticket.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard)
@Controller()
export class TripController {
  constructor(private readonly tripService: TripService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) throw new UnauthorizedException('Missing auth (Bearer token required)');
    return id;
  }

  @Post('trips')
  create(@Req() req: any, @Body() dto: CreateTripDto) {
    return this.tripService.createDraft(this.userId(req), dto);
  }

  @Get('trips/me')
  myTrips(@Req() req: any) {
    return this.tripService.findMine(this.userId(req));
  }

  @Patch('trips/:id/submit-ticket')
  submitTicket(@Req() req: any, @Param('id') id: string, @Body() dto: SubmitTicketDto) {
    return this.tripService.submitTicket(this.userId(req), id, dto);
  }

  @Patch('trips/:id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.tripService.publish(this.userId(req), id);
  }

  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('admin/trips/:id/verify-ticket')
  adminVerify(@Req() req: any, @Param('id') id: string, @Body() dto: AdminVerifyTicketDto) {
    return this.tripService.adminVerifyTicket(this.userId(req), id, dto.decision);
  }
}