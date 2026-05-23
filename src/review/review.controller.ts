import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';

@ApiTags('Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Post()
  @ApiOperation({ summary: 'Submit a review for a delivered transaction' })
  @ApiBody({ type: CreateReviewDto })
  @ApiOkResponse({ type: ReviewResponseDto })
  async createReview(@Body() dto: CreateReviewDto, @Req() req: any) {
    return this.reviewService.createReview(this.userId(req), dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my received reviews' })
  @ApiOkResponse({ type: ReviewResponseDto, isArray: true })
  async getMyReviews(@Req() req: any) {
    return this.reviewService.getMyReviews(this.userId(req));
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get reviews for a given user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiOkResponse({ type: ReviewResponseDto, isArray: true })
  async getReviewsByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ) {
    return this.reviewService.getReviewsByUser(userId);
  }
}
