import { Module } from '@nestjs/common';
import { AdminRunbooksController } from './admin-runbooks.controller';

@Module({
  controllers: [AdminRunbooksController],
})
export class AdminRunbooksModule {}
