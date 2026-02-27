import { Module } from '@nestjs/common';
import { ScenarioCompatController } from './scenario-compat.controller';
import { ScenarioCompatService } from './scenario-compat.service';

@Module({
  controllers: [ScenarioCompatController],
  providers: [ScenarioCompatService],
})
export class ScenarioCompatModule {}