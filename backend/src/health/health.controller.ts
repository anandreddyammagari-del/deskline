import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('health')
  checkDirectHealth() {
    return {
      status: 'ok',
      service: 'deskline-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('api/health')
  checkPrefixedHealth() {
    return {
      status: 'ok',
      service: 'deskline-api',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
