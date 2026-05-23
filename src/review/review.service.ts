import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TransactionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async createReview(
    reviewerId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      select: {
        id: true,
        senderId: true,
        travelerId: true,
        status: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== TransactionStatus.DELIVERED) {
      throw new BadRequestException(
        'Reviews can only be submitted for DELIVERED transactions',
      );
    }

    const isSender = transaction.senderId === reviewerId;
    const isTraveler = transaction.travelerId === reviewerId;

    if (!isSender && !isTraveler) {
      throw new ForbiddenException(
        'Only a party to the transaction can submit a review',
      );
    }

    const role = isSender ? 'SENDER' : 'TRAVELER';
    const revieweeId = isSender ? transaction.travelerId : transaction.senderId;

    const existing = await this.prisma.review.findUnique({
      where: {
        transactionId_reviewerId: {
          transactionId: dto.transactionId,
          reviewerId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'You have already submitted a review for this transaction',
      );
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          transactionId: dto.transactionId,
          reviewerId,
          revieweeId,
          role,
          rating: dto.rating,
          comment: dto.comment ?? null,
        },
      });

      // Recalculate reviewee stats from all their reviews
      const agg = await tx.review.aggregate({
        where: { revieweeId },
        _avg: { rating: true },
        _count: { id: true },
      });

      await tx.user.update({
        where: { id: revieweeId },
        data: {
          averageRating: agg._avg.rating ?? 0,
          reviewCount: agg._count.id,
        },
      });

      return created;
    });

    return this.mapReview(review);
  }

  async getReviewsByUser(userId: string): Promise<ReviewResponseDto[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const reviews = await this.prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapReview(r));
  }

  async getMyReviews(userId: string): Promise<ReviewResponseDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { revieweeId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return reviews.map((r) => this.mapReview(r));
  }

  private mapReview(row: {
    id: string;
    transactionId: string;
    reviewerId: string;
    revieweeId: string;
    role: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
  }): ReviewResponseDto {
    return {
      id: row.id,
      transactionId: row.transactionId,
      reviewerId: row.reviewerId,
      revieweeId: row.revieweeId,
      role: row.role,
      rating: row.rating,
      comment: row.comment,
      createdAt: row.createdAt,
    };
  }
}
