import { SetMetadata } from '@nestjs/common';
import { SKIP_USER_STATUS_CHECK } from '../guards/user-status.guard';

export const SkipUserStatusCheck = () => SetMetadata(SKIP_USER_STATUS_CHECK, true);
