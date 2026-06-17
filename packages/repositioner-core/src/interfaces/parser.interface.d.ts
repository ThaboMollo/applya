export interface DocumentParser {
    parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument>;
}
export interface ParsedDocument {
    text: string;
    sections: ParsedSection[];
    fullyParsed: boolean;
    rawDoclingDocument?: unknown;
}
export interface ParsedSection {
    heading: string | null;
    body: string;
}
