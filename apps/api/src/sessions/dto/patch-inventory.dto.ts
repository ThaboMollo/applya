import { IsArray, IsOptional, ValidateNested, IsString, IsNotEmpty, IsIn, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryEditItem {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsDefined()
  value: unknown;
}

export class InventoryAttestItem {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['skill', 'tool', 'certification'])
  category: 'skill' | 'tool' | 'certification';

  @IsOptional()
  @IsString()
  note?: string;
}

export class PatchInventoryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryEditItem)
  edits?: InventoryEditItem[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryAttestItem)
  attestations?: InventoryAttestItem[];
}
