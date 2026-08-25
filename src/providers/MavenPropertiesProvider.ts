import * as vscode from 'vscode';
import {
    SectionName, collect, readActivePom,
    PomEntryItem, PomVariantItem, makeInfoItem
} from './PomModel';

/**
 * Propiedades del pom.
 *
 * Es el panel al que más le afectan los perfiles: sobreescribir una propiedad
 * por perfil es el uso más corriente que tienen. Por eso cada nombre ocupa una
 * fila y sus variantes cuelgan de ella — una lista plana mostraría la misma
 * propiedad tantas veces como perfiles la toquen, y eso se lee como si fueran
 * propiedades distintas.
 */
export class MavenPropertiesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<void>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly section: SectionName = 'properties';

    refresh(): void { this._onDidChangeTreeData.fire(); }
    getTreeItem(e: vscode.TreeItem): vscode.TreeItem { return e; }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (element instanceof PomEntryItem) {
            return element.entry.profiles.map(v => new PomVariantItem(v));
        }
        if (element) { return []; }

        const project = readActivePom();
        if (!project) { return [makeInfoItem('Open a pom.xml to see properties')]; }

        const entries = collect(project, this.section);
        if (entries.length === 0) { return [makeInfoItem('No properties configured')]; }

        const icon = new vscode.ThemeIcon('symbol-property');
        return entries.map(e => new PomEntryItem(e, icon));
    }
}
