import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class InventoryEditItem {
  id: string;
  field: string;
  value: unknown;
}

export class InventoryAttestItem {
  name: string;
  category: 'skill' | 'tool' | 'certification';
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
