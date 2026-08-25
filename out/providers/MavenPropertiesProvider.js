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
exports.MavenPropertiesProvider = void 0;
const vscode = __importStar(require("vscode"));
const PomModel_1 = require("./PomModel");
/**
 * Propiedades del pom.
 *
 * Es el panel al que más le afectan los perfiles: sobreescribir una propiedad
 * por perfil es el uso más corriente que tienen. Por eso cada nombre ocupa una
 * fila y sus variantes cuelgan de ella — una lista plana mostraría la misma
 * propiedad tantas veces como perfiles la toquen, y eso se lee como si fueran
 * propiedades distintas.
 */
class MavenPropertiesProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.section = 'properties';
    }
    refresh() { this._onDidChangeTreeData.fire(); }
    getTreeItem(e) { return e; }
    getChildren(element) {
        if (element instanceof PomModel_1.PomEntryItem) {
            return element.entry.profiles.map(v => new PomModel_1.PomVariantItem(v));
        }
        if (element) {
            return [];
        }
        const project = (0, PomModel_1.readActivePom)();
        if (!project) {
            return [(0, PomModel_1.makeInfoItem)('Open a pom.xml to see properties')];
        }
        const entries = (0, PomModel_1.collect)(project, this.section);
        if (entries.length === 0) {
            return [(0, PomModel_1.makeInfoItem)('No properties configured')];
        }
        const icon = new vscode.ThemeIcon('symbol-property');
        return entries.map(e => new PomModel_1.PomEntryItem(e, icon));
    }
}
exports.MavenPropertiesProvider = MavenPropertiesProvider;
//# sourceMappingURL=MavenPropertiesProvider.js.map