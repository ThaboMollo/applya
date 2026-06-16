import { IsString, MinLength } from 'class-validator';

export class AttachJobDto {
  @IsString()
  @MinLength(50)
  jobDescription: string;
}
