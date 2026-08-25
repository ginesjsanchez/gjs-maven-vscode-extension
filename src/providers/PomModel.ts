import * as vscode from 'vscode';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

/**
 * Lectura estructurada del pom activo para los paneles laterales.
 *
 * Antes cada panel se apañaba con expresiones regulares sobre el texto: se
 * quitaba el bloque *Management* y se tomaba el PRIMER <dependencies>, <plugins>
 * o <properties> del documento. Una expresión regular no sabe a qué profundidad
 * está una etiqueta, y en un pom eso es precisamente lo que la define: las
 * <dependencies> de un <plugin>, las de un <profile> y las del proyecto se leen
 * igual y significan cosas distintas.
 *
 * Aquí se lee el árbol, y cada sección se pide por su ruta exacta.
 */

const parser = new XMLParser({
    ignoreAttributes: true,
    // Sin esto una versión '1.0' se convertiría en el número 1
    parseTagValue: false,
    isArray: name => name === 'dependency' || name === 'plugin' || name === 'profile'
});

/** Declaración concreta de un elemento: la del proyecto o la de un perfil. */
export interface Variant {
    /** id del perfil; ausente en la declaración de nivel superior */
    profile?: string;
    /** lo que se muestra a la derecha: versión, valor de la propiedad... */
    value: string;
}

/**
 * Un elemento del pom, con todas sus declaraciones.
 *
 * Una fila por identidad y nunca más de una: los perfiles existen para que las
 * cosas varíen, así que el mismo plugin o la misma propiedad aparecen
 * habitualmente varias veces. Repetir filas convertiría una propiedad
 * sobreescrita en cinco propiedades distintas, que es sencillamente falso.
 */
export interface Entry {
    id:       string;
    label:    string;
    /** Declaración fuera de todo perfil. Ausente si solo existe en perfiles. */
    base?:    Variant;
    profiles: Variant[];
}

export function readActivePom(): any | undefined {
    const editor = vscode.window.activeTextEditor;
    const file = editor?.document.fileName;
    if (!file || !file.endsWith('pom.xml')) { return undefined; }
    try {
        return parser.parse(fs.readFileSync(editor!.document.uri.fsPath, 'utf8'))?.project;
    } catch {
        return undefined;
    }
}

function asList(value: any): any[] {
    return Array.isArray(value) ? value : (value ? [value] : []);
}

function str(node: any, name: string): string {
    const value = node?.[name];
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Perfiles del pom. El <id> es obligatorio en Maven, pero un fichero puede
 * estar a medio escribir y un panel no es quien para romperse por eso.
 */
function profilesOf(project: any): { id: string; node: any }[] {
    return asList(project?.profiles?.profile).map((node, i) => ({
        id: str(node, 'id') || `#${i + 1}`,
        node
    }));
}

//  Rutas de cada sección, iguales en <project> y dentro de un <profile>

const SECTIONS = {
    dependencies:      (n: any) => asList(n?.dependencies?.dependency),
    managedDependencies: (n: any) => asList(n?.dependencyManagement?.dependencies?.dependency),
    plugins:           (n: any) => asList(n?.build?.plugins?.plugin),
    managedPlugins:    (n: any) => asList(n?.build?.pluginManagement?.plugins?.plugin),
    properties:        (n: any) => {
        const props = n?.properties;
        if (!props || typeof props !== 'object' || Array.isArray(props)) { return []; }
        // Una propiedad con XML dentro no es un valor mostrable; se deja vacía
        return Object.entries(props).map(([name, value]) => ({
            name,
            value: typeof value === 'string' ? value.trim() : ''
        }));
    }
};

export type SectionName = keyof typeof SECTIONS;

/**
 * Identidad de una dependencia. groupId:artifactId no basta: el mismo par con
 * distinto <type> o <classifier> son dependencias diferentes y legítimas — un
 * test-jar, un sources, un nativo con clasificador de plataforma. Fundirlas en
 * una fila sería el mismo error que repetirlas.
 */
function dependencyId(d: any): string {
    const type = str(d, 'type') || 'jar';
    const classifier = str(d, 'classifier');
    return `${str(d, 'groupId')}:${str(d, 'artifactId')}:${type}${classifier ? ':' + classifier : ''}`;
}

/** Un plugin solo puede aparecer una vez por bloque, así que basta con G:A. */
function pluginId(p: any): string {
    return `${str(p, 'groupId') || 'org.apache.maven.plugins'}:${str(p, 'artifactId')}`;
}

function describe(section: SectionName, item: any): { id: string; label: string; value: string } {
    switch (section) {
        case 'properties':
            return { id: item.name, label: item.name, value: item.value };
        case 'plugins':
        case 'managedPlugins':
            return {
                id: pluginId(item),
                label: str(item, 'artifactId') || '?',
                value: str(item, 'version') || '(managed)'
            };
        default: {
            const classifier = str(item, 'classifier');
            const scope = str(item, 'scope') || 'compile';
            const version = str(item, 'version') || '(managed)';
            return {
                id: dependencyId(item),
                label: str(item, 'artifactId') || '?',
                value: `${version} [${scope}]${classifier ? ' :' + classifier : ''}`
            };
        }
    }
}

/**
 * Todas las declaraciones de una sección, agrupadas por identidad: primero las
 * del proyecto, en su orden, y después las que solo existen dentro de perfiles.
 */
export function collect(project: any, section: SectionName): Entry[] {
    const select = SECTIONS[section];
    const entries = new Map<string, Entry>();

    for (const item of select(project)) {
        const { id, label, value } = describe(section, item);
        if (!entries.has(id)) { entries.set(id, { id, label, profiles: [] }); }
        entries.get(id)!.base = { value };
    }

    for (const profile of profilesOf(project)) {
        for (const item of select(profile.node)) {
            const { id, label, value } = describe(section, item);
            if (!entries.has(id)) { entries.set(id, { id, label, profiles: [] }); }
            entries.get(id)!.profiles.push({ profile: profile.id, value });
        }
    }

    return [...entries.values()];
}

//  Perfiles declarados, para la ayuda del panel de perfiles

export interface DeclaredProfile {
    id: string;
    /** Resumen de <activation>; vacío si solo se activa a mano con -P */
    activation: string;
    /** Qué aporta el perfil, para saber si es el que se busca */
    contributes: string;
}

export function declaredProfiles(project: any): DeclaredProfile[] {
    return profilesOf(project).map(({ id, node }) => ({
        id,
        activation: describeActivation(node?.activation),
        contributes: describeContributions(node)
    }));
}

/**
 * Un perfil no se activa solo con -P: también por JDK, por sistema operativo,
 * por una propiedad, por la presencia de un fichero o por defecto. Saber cuál
 * es el caso evita teclear un -P que ya sobraba, o buscar por qué se activó uno
 * que nadie pidió.
 */
function describeActivation(activation: any): string {
    if (!activation || typeof activation !== 'object') { return ''; }
    const parts: string[] = [];

    if (str(activation, 'activeByDefault') === 'true') { parts.push('por defecto'); }

    const jdk = str(activation, 'jdk');
    if (jdk) { parts.push(`jdk ${jdk}`); }

    const os = activation.os;
    if (os && typeof os === 'object') {
        const bits = ['name', 'family', 'arch', 'version'].map(k => str(os, k)).filter(Boolean);
        if (bits.length) { parts.push(`so ${bits.join('/')}`); }
    }

    const property = activation.property;
    if (property && typeof property === 'object') {
        const name = str(property, 'name');
        const value = str(property, 'value');
        if (name) { parts.push(value ? `${name}=${value}` : name); }
    }

    const file = activation.file;
    if (file && typeof file === 'object') {
        const exists = str(file, 'exists');
        const missing = str(file, 'missing');
        if (exists) { parts.push(`existe ${exists}`); }
        if (missing) { parts.push(`falta ${missing}`); }
    }

    return parts.join(', ');
}

function describeContributions(node: any): string {
    const counts: string[] = [];
    const add = (n: number, label: string) => { if (n > 0) { counts.push(`${n} ${label}`); } };

    add(SECTIONS.properties(node).length, 'prop.');
    add(SECTIONS.dependencies(node).length + SECTIONS.managedDependencies(node).length, 'dep.');
    add(SECTIONS.plugins(node).length + SECTIONS.managedPlugins(node).length, 'plugins');
    add(asList(node?.modules?.module).length, 'módulos');

    return counts.join(' · ');
}

//  Items del árbol

/**
 * Fila de un elemento. El galón de desplegar es la única marca cuando hay
 * variantes: estas líneas tienen poco sitio y el detalle cabe en el tooltip.
 * Lo que sí se marca en la propia etiqueta, con un asterisco, es lo que no
 * existe fuera de los perfiles — ahí no hay valor base con el que confundirlo.
 */
export class PomEntryItem extends vscode.TreeItem {
    constructor(public readonly entry: Entry, icon: vscode.ThemeIcon) {
        const onlyInProfiles = !entry.base;
        super(
            onlyInProfiles ? `* ${entry.label}` : entry.label,
            entry.profiles.length > 0
                ? vscode.TreeItemCollapsibleState.Collapsed
                : vscode.TreeItemCollapsibleState.None
        );

        this.description = summarise(entry);
        this.iconPath = icon;
        this.contextValue = 'pomEntry';
        this.tooltip = buildTooltip(entry);
    }
}

/** Fila hija: lo que aporta un perfil concreto. */
export class PomVariantItem extends vscode.TreeItem {
    constructor(variant: Variant) {
        super(`perfil: ${variant.profile}`, vscode.TreeItemCollapsibleState.None);
        this.description = variant.value;
        this.iconPath = new vscode.ThemeIcon('filter');
        this.contextValue = 'pomVariant';
    }
}

/**
 * Valor resumido de la fila.
 *
 * Sin declaración base solo cabe describir las variantes, y ahí '(varía)' solo
 * es cierto si de verdad varían: un plugin declarado en dos perfiles con la
 * misma versión no varía, y decir que sí obligaría a desplegar para descubrir
 * que no había nada que ver. Una propiedad declarada vacía tampoco es lo mismo
 * que una sin declarar, así que se distingue.
 */
function summarise(entry: Entry): string {
    if (entry.base) { return entry.base.value || '(vacío)'; }

    const values = new Set(entry.profiles.map(v => v.value));
    if (values.size === 1) { return entry.profiles[0].value || '(vacío)'; }
    return '(varía)';
}

function buildTooltip(entry: Entry): vscode.MarkdownString {
    const lines = [`**${entry.id}**`, ''];
    if (entry.base) {
        lines.push(`- fuera de perfiles: \`${entry.base.value || '(vacío)'}\``);
    } else {
        lines.push('- no se declara fuera de ningún perfil');
    }
    for (const variant of entry.profiles) {
        lines.push(`- perfil \`${variant.profile}\`: \`${variant.value || '(vacío)'}\``);
    }
    return new vscode.MarkdownString(lines.join('\n'));
}

export function makeInfoItem(label: string): vscode.TreeItem {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
