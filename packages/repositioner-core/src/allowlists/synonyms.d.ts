export interface SynonymGroup {
    canonical: string;
    aliases: string[];
}
export declare const SYNONYM_GROUPS: SynonymGroup[];
export declare function buildSynonymLookup(groups?: SynonymGroup[]): Map<string, string>;
export declare function resolveCanonical(term: string, lookup?: Map<string, string>): string;
