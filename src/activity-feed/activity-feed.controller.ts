import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityFeedItemResponseDto } from './dto/activity-feed-item-response.dto';
import { ListActivityFeedQueryDto } from './dto/list-activity-feed-query.dto';

@ApiTags('Activity Feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activity-feed')
export class ActivityFeedController {
  constructor(private readonly activityFeedService: ActivityFeedService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('me')
  @ApiOperation({
    summary: 'List my activity feed',
    description:
      'Returns a unified chronological activity feed for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'User activity feed',
    type: ActivityFeedItemResponseDto,
    isArray: true,
  })
  async listMine(@Req() req: any, @Query() query: ListActivityFeedQueryDto) {
    return this.activityFeedService.listMyFeed(this.userId(req), query);
  }

  @Get('admin')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List admin activity feed',
    description:
      'Returns a unified chronological activity feed for admin and operations.',
  })
  @ApiOkResponse({
    description: 'Admin activity feed',
    type: ActivityFeedItemResponseDto,
    isArray: true,
  })
  async listAdmin(@Query() query: ListActivityFeedQueryDto) {
    return this.activityFeedService.listAdminFeed(query);
  }
}