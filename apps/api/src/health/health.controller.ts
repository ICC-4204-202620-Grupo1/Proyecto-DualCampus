import { Controller, Get } from '@nestjs/common';
import { Publico } from '../common/decorators/publico.decorator';

@Controller('health')
export class HealthController {
  @Publico()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
