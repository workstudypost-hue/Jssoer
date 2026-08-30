import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('catalog')
  getCatalog(@Req() req: any) {
    return this.service.getCatalogForRoles(req.user.roles);
  }

  @Post('generate')
  generate(@Body() dto: GenerateReportDto, @Req() req: any) {
    return this.service.generate({
      reportKey: dto.reportKey,
      requesterId: req.user.sub,
      requesterRoles: req.user.roles,
      filters: { dateFrom: dto.dateFrom, dateTo: dto.dateTo, courseId: dto.courseId },
      exportFormat: dto.exportFormat,
    });
  }

  /** Polling لحالة تصدير PDF/XLSX حتى يجهز (status='ready' + fileUrl) */
  @Get(':id/status')
  getStatus(@Param('id') id: string, @Req() req: any) {
    return this.service.getReportStatus(id, req.user.sub);
  }
}
