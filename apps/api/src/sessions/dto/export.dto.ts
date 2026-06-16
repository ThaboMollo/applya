import { IsEnum, IsString } from 'class-validator';

export class ExportDto {
  @IsString()
  templateId: string;

  @IsEnum(['docx', 'pdf'])
  format: 'docx' | 'pdf';
}
