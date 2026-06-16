import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UnitDecision {
  sourceId: string;
  action: 'accept' | 'reject' | 'edit';
  editedText?: string;
}

export class PatchDecisionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnitDecision)
  decisions: UnitDecision[];
}
