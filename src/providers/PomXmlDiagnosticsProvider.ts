import * as vscode from 'vscode';

export class PomXmlDiagnosticsProvider {
    private collection: vscode.DiagnosticCollection;

    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('gjs-maven-vscode-extension');
    }

    validate(document: vscode.TextDocument): void {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // ── 1. Required root elements ──────────────────────────────────────
        const required = ['modelVersion', 'groupId', 'artifactId', 'version'];
        for (const el of required) {
            if (!new RegExp(`<${el}>`).test(text)) {
                const d = new vscode.Diagnostic(
                    new vscode.Range(0, 0, 0, 0),
                    `pom.xml is missing required element <${el}>`,
                    vscode.DiagnosticSeverity.Warning
                );
                d.source = 'Gjs Maven VS Code Extension';
                d.code = `missing-${el}`;
                diagnostics.push(d);
            }
        }

        // ── 2. SNAPSHOT in release build hint ──────────────────────────────
        const versionMatch = text.match(/<version>([^<]+)<\/version>/);
        if (versionMatch && !versionMatch[1].includes('SNAPSHOT')) {
            // check if parent/dependency versions still have SNAPSHOT
            const depSnap = text.match(/<dependency>[\s\S]*?<version>([^<]*SNAPSHOT[^<]*)<\/version>/);
            if (depSnap) {
                const idx = text.indexOf(depSnap[0]);
                const pos = document.positionAt(idx);
                const d = new vscode.Diagnostic(
                    new vscode.Range(pos, pos.translate(0, depSnap[0].length)),
                    `Dependency uses SNAPSHOT version '${depSnap[1]}' — ensure this is intentional for a release build.`,
                    vscode.DiagnosticSeverity.Information
                );
                d.source = 'Gjs Maven VS Code Extension';
                diagnostics.push(d);
            }
        }

        // ── 3. Dependency without version outside dependencyManagement ─────
        const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
        let m: RegExpExecArray | null;
        while ((m = depRegex.exec(text)) !== null) {
            const depBlock = m[1];
            const hasVersion = /<version>/.test(depBlock);
            const isInMgmt = this.isInsideDependencyManagement(text, m.index);
            if (!hasVersion && !isInMgmt) {
                const pos = document.positionAt(m.index);
                const artifactMatch = depBlock.match(/<artifactId>([^<]+)<\/artifactId>/);
                const name = artifactMatch ? artifactMatch[1] : 'dependency';
                const d = new vscode.Diagnostic(
                    new vscode.Range(pos, pos.translate(0, 12)),
                    `Dependency '${name}' has no <version>. It must be managed in <dependencyManagement> or a BOM.`,
                    vscode.DiagnosticSeverity.Warning
                );
                d.source = 'Gjs Maven VS Code Extension';
                diagnostics.push(d);
            }
        }

        // ── 4. Duplicate dependencies ──────────────────────────────────────
        const coords: string[] = [];
        const dupRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
        while ((m = dupRegex.exec(text)) !== null) {
            const block = m[1];
            const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
            const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '';
            const coord = `${g}:${a}`;
            if (coords.includes(coord) && g && a) {
                const pos = document.positionAt(m.index);
                const d = new vscode.Diagnostic(
                    new vscode.Range(pos, pos.translate(0, 12)),
                    `Duplicate dependency: ${coord}`,
                    vscode.DiagnosticSeverity.Warning
                );
                d.source = 'Gjs Maven VS Code Extension';
                diagnostics.push(d);
            } else {
                coords.push(coord);
            }
        }

        // ── 5. Bad XML: unclosed tags (simple heuristic) ───────────────────
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            const openTags = (line.match(/<[a-zA-Z][^/!>]*>/g) || []).length;
            const closeTags = (line.match(/<\/[a-zA-Z][^>]*>/g) || []).length;
            const selfClose = (line.match(/<[^>]+\/>/g) || []).length;
            if (openTags !== closeTags + selfClose && openTags > 0) {
                // Multi-line tag — skip
            }
        });

        this.collection.set(document.uri, diagnostics);
    }

    private isInsideDependencyManagement(text: string, idx: number): boolean {
        const before = text.substring(0, idx);
        const dmOpen = before.lastIndexOf('<dependencyManagement>');
        const dmClose = before.lastIndexOf('</dependencyManagement>');
        return dmOpen > dmClose;
    }

    dispose(): void {
        this.collection.dispose();
    }
}
