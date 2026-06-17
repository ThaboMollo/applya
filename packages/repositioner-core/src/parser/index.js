"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DoclingClient = exports.MvpStubParser = void 0;
class MvpStubParser {
    async parse(fileBuffer, mimeType) {
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return this.parseDocx(fileBuffer);
        }
        if (mimeType === 'application/pdf') {
            return this.parsePdf(fileBuffer);
        }
        throw new Error(`Unsupported MIME type: ${mimeType}. Only PDF and DOCX are supported.`);
    }
    async parseDocx(buffer) {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value, sections: [], fullyParsed: false };
    }
    async parsePdf(buffer) {
        const pdfParse = require('pdf-parse');
        const result = await pdfParse(buffer);
        return { text: result.text, sections: [], fullyParsed: false };
    }
}
exports.MvpStubParser = MvpStubParser;
class DoclingClient {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async parse(fileBuffer, mimeType) {
        await this.assertHealthy();
        const ext = mimeType.includes('pdf') ? 'pdf' : 'docx';
        const filename = `resume.${ext}`;
        const body = {
            file_source: {
                base64_string: fileBuffer.toString('base64'),
                filename,
                media_type: mimeType,
            },
            options: {
                to_formats: ['md', 'text'],
                return_as_file: false,
            },
        };
        const response = await fetch(`${this.baseUrl}/v1alpha/convert/source`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(120_000),
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => response.statusText);
            throw new Error(`Docling Serve error ${response.status}: ${detail}`);
        }
        const data = await response.json();
        return extractParsedDocument(data);
    }
    async assertHealthy() {
        const deadline = Date.now() + 120_000;
        const interval = 5_000;
        while (Date.now() < deadline) {
            try {
                const res = await fetch(`${this.baseUrl}/health`, {
                    signal: AbortSignal.timeout(5_000),
                });
                if (res.ok)
                    return;
            }
            catch {
            }
            await new Promise((r) => setTimeout(r, interval));
        }
        throw new Error(`Docling Serve at ${this.baseUrl} did not become healthy within 2 minutes. ` +
            `Check the deployment logs on Fly.io / Railway.`);
    }
}
exports.DoclingClient = DoclingClient;
function extractParsedDocument(data) {
    const doc = data.document ?? data.result ?? {};
    const text = doc.export_formats?.md ??
        doc.export_formats?.text ??
        doc.md_content ??
        doc.text_content ??
        '';
    if (!text) {
        throw new Error('Docling Serve returned an empty document — the file may be image-only or corrupt.');
    }
    const sections = (doc.sections ?? []).map((s) => ({
        heading: s.heading ?? null,
        body: s.text ?? '',
    }));
    return {
        text,
        sections,
        fullyParsed: true,
        rawDoclingDocument: data,
    };
}
//# sourceMappingURL=index.js.map