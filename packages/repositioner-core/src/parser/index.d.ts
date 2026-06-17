import { DocumentParser, ParsedDocument } from '../interfaces/parser.interface';
export declare class MvpStubParser implements DocumentParser {
    parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument>;
    private parseDocx;
    private parsePdf;
}
export declare class DoclingClient implements DocumentParser {
    private readonly baseUrl;
    constructor(baseUrl: string);
    parse(fileBuffer: Buffer, mimeType: string): Promise<ParsedDocument>;
    private assertHealthy;
}
