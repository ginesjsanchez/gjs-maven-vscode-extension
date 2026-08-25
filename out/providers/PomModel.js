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
exports.PomVariantItem = exports.PomEntryItem = void 0;
exports.readActivePom = readActivePom;
exports.collect = collect;
exports.declaredProfiles = declaredProfiles;
exports.makeInfoItem = makeInfoItem;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const fast_xml_parser_1 = require("fast-xml-parser");
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
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: true,
    // Sin esto una versión '1.0' se convertiría en el número 1
    parseTagValue: false,
    isArray: name => name === 'dependency' || name === 'plugin' || name === 'profile'
});
function readActivePom() {
    const editor = vscode.window.activeTextEditor;
    const file = editor?.document.fileName;
    if (!file || !file.endsWith('pom.xml')) {
        return undefined;
    }
    try {
        return parser.parse(fs.readFileSync(editor.document.uri.fsPath, 'utf8'))?.project;
    }
    catch {
        return undefined;
    }
}
function asList(value) {
    return Array.isArray(value) ? value : (value ? [value] : []);
}
function str(node, name) {
    const value = node?.[name];
    return typeof value === 'string' ? value.trim() : '';
}
/**
 * Perfiles del pom. El <id> es obligatorio en Maven, pero un fichero puede
 * estar a medio escribir y un panel no es quien para romperse por eso.
 */
function profilesOf(project) {
    return asList(project?.profiles?.profile).map((node, i) => ({
        id: str(node, 'id') || `#${i + 1}`,
        node
    }));
}
//  Rutas de cada sección, iguales en <project> y dentro de un <profile>
const SECTIONS = {
    dependencies: (n) => asList(n?.dependencies?.dependency),
    managedDependencies: (n) => asList(n?.dependencyManagement?.dependencies?.dependency),
    plugins: (n) => asList(n?.build?.plugins?.plugin),
    managedPlugins: (n) => asList(n?.build?.pluginManagement?.plugins?.plugin),
    properties: (n) => {
        const props = n?.properties;
        if (!props || typeof props !== 'object' || Array.isArray(props)) {
            return [];
        }
        // Una propiedad con XML dentro no es un valor mostrable; se deja vacía
        return Object.entries(props).map(([name, value]) => ({
            name,
            value: typeof value === 'string' ? value.trim() : ''
        }));
    }
};
/**
 * Identidad de una dependencia. groupId:artifactId no basta: el mismo par con
 * distinto <type> o <classifier> son dependencias diferentes y legítimas — un
 * test-jar, un sources, un nativo con clasificador de plataforma. Fundirlas en
 * una fila sería el mismo error que repetirlas.
 */
function dependencyId(d) {
    const type = str(d, 'type') || 'jar';
    const classifier = str(d, 'classifier');
    return `${str(d, 'groupId')}:${str(d, 'artifactId')}:${type}${classifier ? ':' + classifier : ''}`;
}
/** Un plugin solo puede aparecer una vez por bloque, así que basta con G:A. */
function pluginId(p) {
    return `${str(p, 'groupId') || 'org.apache.maven.plugins'}:${str(p, 'artifactId')}`;
}
function describe(section, item) {
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
function collect(project, section) {
    const select = SECTIONS[section];
    const entries = new Map();
    for (const item of select(project)) {
        const { id, label, value } = describe(section, item);
        if (!entries.has(id)) {
            entries.set(id, { id, label, profiles: [] });
        }
        entries.get(id).base = { value };
    }
    for (const profile of profilesOf(project)) {
        for (const item of select(profile.node)) {
            const { id, label, value } = describe(section, item);
            if (!entries.has(id)) {
                entries.set(id, { id, label, profiles: [] });
            }
            entries.get(id).profiles.push({ profile: profile.id, value });
        }
    }
    return [...entries.values()];
}
function declaredProfiles(project) {
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
function describeActivation(activation) {
    if (!activation || typeof activation !== 'object') {
        return '';
    }
    const parts = [];
    if (str(activation, 'activeByDefault') === 'true') {
        parts.push('por defecto');
    }
    const jdk = str(activation, 'jdk');
    if (jdk) {
        parts.push(`jdk ${jdk}`);
    }
    const os = activation.os;
    if (os && typeof os === 'object') {
        const bits = ['name', 'family', 'arch', 'version'].map(k => str(os, k)).filter(Boolean);
        if (bits.length) {
            parts.push(`so ${bits.join('/')}`);
        }
    }
    const property = activation.property;
    if (property && typeof property === 'object') {
        const name = str(property, 'name');
        const value = str(property, 'value');
        if (name) {
            parts.push(value ? `${name}=${value}` : name);
        }
    }
    const file = activation.file;
    if (file && typeof file === 'object') {
        const exists = str(file, 'exists');
        const missing = str(file, 'missing');
        if (exists) {
            parts.push(`existe ${exists}`);
        }
        if (missing) {
            parts.push(`falta ${missing}`);
        }
    }
    return parts.join(', ');
}
function describeContributions(node) {
    const counts = [];
    const add = (n, label) => { if (n > 0) {
        counts.push(`${n} ${label}`);
    } };
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
class PomEntryItem extends vscode.TreeItem {
    constructor(entry, icon) {
        const onlyInProfiles = !entry.base;
        super(onlyInProfiles ? `* ${entry.label}` : entry.label, entry.profiles.length > 0
            ? vscode.TreeItemCollapsibleState.Collapsed
            : vscode.TreeItemCollapsibleState.None);
        this.entry = entry;
        this.description = summarise(entry);
        this.iconPath = icon;
        this.contextValue = 'pomEntry';
        this.tooltip = buildTooltip(entry);
    }
}
exports.PomEntryItem = PomEntryItem;
/** Fila hija: lo que aporta un perfil concreto. */
class PomVariantItem extends vscode.TreeItem {
    constructor(variant) {
        super(`perfil: ${variant.profile}`, vscode.TreeItemCollapsibleState.None);
        this.description = variant.value;
        this.iconPath = new vscode.ThemeIcon('filter');
        this.contextValue = 'pomVariant';
    }
}
exports.PomVariantItem = PomVariantItem;
/**
 * Valor resumido de la fila.
 *
 * Sin declaración base solo cabe describir las variantes, y ahí '(varía)' solo
 * es cierto si de verdad varían: un plugin declarado en dos perfiles con la
 * misma versión no varía, y decir que sí obligaría a desplegar para descubrir
 * que no había nada que ver. Una propiedad declarada vacía tampoco es lo mismo
 * que una sin declarar, así que se distingue.
 */
function summarise(entry) {
    if (entry.base) {
        return entry.base.value || '(vacío)';
    }
    const values = new Set(entry.profiles.map(v => v.value));
    if (values.size === 1) {
        return entry.profiles[0].value || '(vacío)';
    }
    return '(varía)';
}
function buildTooltip(entry) {
    const lines = [`**${entry.id}**`, ''];
    if (entry.base) {
        lines.push(`- fuera de perfiles: \`${entry.base.value || '(vacío)'}\``);
    }
    else {
        lines.push('- no se declara fuera de ningún perfil');
    }
    for (const variant of entry.profiles) {
        lines.push(`- perfil \`${variant.profile}\`: \`${variant.value || '(vacío)'}\``);
    }
    return new vscode.MarkdownString(lines.join('\n'));
}
function makeInfoItem(label) {
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = new vscode.ThemeIcon('info');
    return item;
}
//# sourceMappingURL=PomModel.js.map