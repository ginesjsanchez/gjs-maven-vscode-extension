"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PomXmlDiagnosticsProvider = void 0;
const vscode = __importStar(require("vscode"));
class PomXmlDiagnosticsProvider {
    constructor() {
        this.collection = vscode.languages.createDiagnosticCollection('gjs-maven-vscode-extension');
    }
    validate(document) {
        const diagnostics = [];
        const text = document.getText();
        //  1. Required root elements 
        const required = ['modelVersion', 'groupId', 'artifactId', 'version'];
        for (const el of required) {
            if (!new RegExp(`<${el}>`).test(text)) {
                const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `pom.xml is missing required element <${el}>`, vscode.DiagnosticSeverity.Warning);
                d.source = 'Gjs Maven VS Code Extension';
                d.code = `missing-${el}`;
                diagnostics.push(d);
            }
        }
        //  2. SNAPSHOT in release build hint 
        const versionMatch = text.match(/<version>([^<]+)<\/version>/);
        if (versionMatch && !versionMatch[1].includes('SNAPSHOT')) {
            // check if parent/dependency versions still have SNAPSHOT
            const depSnap = text.match(/<dependency>[\s\S]*?<version>([^<]*SNAPSHOT[^<]*)<\/version>/);
            if (depSnap) {
                const idx = text.indexOf(depSnap[0]);
                const pos = document.positionAt(idx);
                const d = new vscode.Diagnostic(new vscode.Range(pos, pos.translate(0, depSnap[0].length)), `Dependency uses SNAPSHOT version '${depSnap[1]}' — ensure this is intentional for a release build.`, vscode.DiagnosticSeverity.Information);
                d.source = 'Gjs Maven VS Code Extension';
                diagnostics.push(d);
            }
        }
        // Desactivada hasta tener el pom efectivo
        //  3. Dependency without version outside dependencyManagement 
        //const depRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
        //let m: RegExpExecArray | null;
        //while ((m = depRegex.exec(text)) !== null) {
        //    const depBlock = m[1];
        //    const hasVersion = /<version>/.test(depBlock);
        //    const isInMgmt = this.isInsideDependencyManagement(text, m.index);
        //    if (!hasVersion && !isInMgmt) {
        //        const pos = document.positionAt(m.index);
        //        const artifactMatch = depBlock.match(/<artifactId>([^<]+)<\/artifactId>/);
        //        const name = artifactMatch ? artifactMatch[1] : 'dependency';
        //        const d = new vscode.Diagnostic(
        //            new vscode.Range(pos, pos.translate(0, 12)),
        //            `Dependency '${name}' has no <version>. It must be managed in <dependencyManagement> or a BOM.`,
        //            vscode.DiagnosticSeverity.Warning
        //        );
        //        d.source = 'Gjs Maven VS Code Extension';
        //        diagnostics.push(d);
        //    }
        //}
        //  4. Duplicate dependencies 
        const textWithoutMgmt = text.replace(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/g, '');
        const coords = [];
        const dupRegex = /<dependency>([\s\S]*?)<\/dependency>/g;
        let m;
        while ((m = dupRegex.exec(textWithoutMgmt)) !== null) {
            const block = m[1];
            const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
            const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '';
            const coord = `${g}:${a}`;
            if (coords.includes(coord) && g && a) {
                const pos = document.positionAt(m.index);
                const d = new vscode.Diagnostic(new vscode.Range(pos, pos.translate(0, 12)), `Duplicate dependency: ${coord}`, vscode.DiagnosticSeverity.Warning);
                d.source = 'Gjs Maven VS Code Extension';
                diagnostics.push(d);
            }
            else {
                coords.push(coord);
            }
        }
        //  5. Duplicate plugin 
        const textWithoutMgmtPlugin = text.replace(/<pluginManagement>[\s\S]*?<\/pluginManagement>/g, '');
        const coordsPlugin = [];
        const dupRegexPlugin = /<plugin>([\s\S]*?)<\/plugin>/g;
        while ((m = dupRegexPlugin.exec(textWithoutMgmtPlugin)) !== null) {
            const block = m[1];
            const g = (block.match(/<groupId>([^<]+)/) || [])[1] || '';
            const a = (block.match(/<artifactId>([^<]+)/) || [])[1] || '';
            const coord = `${g}:${a}`;
            if (coordsPlugin.includes(coord) && g && a) {
                const pos = document.positionAt(m.index);
                const d = new vscode.Diagnostic(new vscode.Range(pos, pos.translate(0, 12)), `Duplicate plugin: ${coord}`, vscode.DiagnosticSeverity.Warning);
                d.source = 'Gjs Maven VS Code Extension';
                diagnostics.push(d);
            }
            else {
                coordsPlugin.push(coord);
            }
        }
        //  6. Bad XML: unclosed tags (simple heuristic) 
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
    isInsideDependencyManagement(text, idx) {
        const before = text.substring(0, idx);
        const dmOpen = before.lastIndexOf('<dependencyManagement>');
        const dmClose = before.lastIndexOf('</dependencyManagement>');
        return dmOpen > dmClose;
    }
    dispose() {
        this.collection.dispose();
    }
}
exports.PomXmlDiagnosticsProvider = PomXmlDiagnosticsProvider;
//# sourceMappingURL=PomXmlDiagnosticsProvider.js.map