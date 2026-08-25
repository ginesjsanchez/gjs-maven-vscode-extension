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
exports.MavenProjectContext = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MavenProjectContext {
    static get current() {
        return MavenProjectContext._current;
    }
    static get activeModule() {
        return MavenProjectContext._activeModule;
    }
    static get globalConfig() {
        return MavenProjectContext._globalConfig;
    }
    static activate(context) {
        // Update when active editor changes
        context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            MavenProjectContext.updateFromEditor(editor);
            void MavenProjectContext.updateActiveModule(editor);
        }));
        // Crear o borrar un pom cambia el reparto de ficheros entre módulos
        const modules = vscode.workspace.createFileSystemWatcher('**/pom.xml');
        modules.onDidCreate(() => MavenProjectContext._moduleDirCache.clear());
        modules.onDidDelete(() => MavenProjectContext._moduleDirCache.clear());
        context.subscriptions.push(modules);
        // Update when active pom.xml is saved
        context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.fileName.endsWith('pom.xml')) {
                // El pom pudo cambiar de lenguaje (o de padre): la caché ya no vale
                MavenProjectContext._languageCache.delete(path.dirname(doc.uri.fsPath));
                MavenProjectContext.updateFromDocument(doc.uri.fsPath);
            }
        }));
        // Init with current editor
        MavenProjectContext.updateFromEditor(vscode.window.activeTextEditor);
        void MavenProjectContext.updateActiveModule(vscode.window.activeTextEditor);
        // Load global Maven config asynchronously at startup
        // Se retarda y se llama desde extension.ts
        // MavenProjectContext.loadGlobalConfig();
    }
    /**
     * El evaluador no existe todavía cuando se llama a activate(), así que se
     * inyecta después. Al recibirlo se reprocesa el editor activo, porque su
     * pom pudo quedar sin lenguaje por no haber con quién resolverlo.
     */
    static setEvaluator(evaluator) {
        MavenProjectContext._evaluator = evaluator;
        MavenProjectContext.updateFromEditor(vscode.window.activeTextEditor);
        MavenProjectContext._requestedModuleDir = undefined; // forzar la reevaluación
        void MavenProjectContext.updateActiveModule(vscode.window.activeTextEditor);
    }
    static async loadGlobalConfig(evaluator, onLoaded) {
        const poms = await vscode.workspace.findFiles('pom.xml', null, 1);
        if (poms.length === 0) {
            return;
        }
        const projectDir = path.dirname(poms[0].fsPath);
        // Sin await, onLoaded se comprobaba antes de que Maven contestara: la ruta
        // todavía estaba vacía y el aviso no llegaba nunca. Quien espera por el
        // repositorio local —el panel de arquetipos— se quedaba sin lista.
        await MavenProjectContext.loadLocalRepository(projectDir, evaluator);
        if (MavenProjectContext._globalConfig.localRepository) {
            onLoaded?.();
        }
    }
    /**
     * Ruta del repositorio local, según Maven.
     *
     * help:evaluate escribe sus errores por la MISMA salida estándar que el
     * valor pedido, así que un pom que Maven no puede leer llega aquí como una
     * respuesta cualquiera. Sin comprobarlo se guardaba el volcado de [ERROR]
     * entero como si fuera la ruta, y de ahí pasaba al setContext y al panel de
     * arquetipos, que se quedaba mudo sin decir por qué.
     *
     * La comprobación es la única que importa: lo que Maven devuelva tiene que
     * ser un directorio que exista.
     */
    static async loadLocalRepository(projectDir, evaluator) {
        const answer = (await evaluator.evaluate('settings.localRepository', projectDir))?.trim();
        if (!answer || !MavenProjectContext.isDirectory(answer)) {
            const reason = !answer
                ? 'Maven no respondió'
                : MavenProjectContext.summarise(answer);
            MavenProjectContext._globalConfig = { localRepository: '', localRepositoryError: reason };
            console.log(`Gjs Maven VS Code Extension: no se pudo resolver settings.localRepository — ${reason}`);
            return;
        }
        MavenProjectContext._globalConfig = { localRepository: answer };
        vscode.commands.executeCommand('setContext', 'gjsMaven.localRepository', answer);
        console.log(`Gjs Maven VS Code Extension: localRepository = ${answer}`);
    }
    static isDirectory(candidate) {
        try {
            return fs.statSync(candidate).isDirectory();
        }
        catch {
            return false;
        }
    }
    /** Primera línea con contenido de la respuesta, recortada para el aviso. */
    static summarise(answer) {
        const line = answer.split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0) ?? answer;
        const clean = line.replace(/^\[ERROR\]\s*/, '').trim();
        return clean.length > 160 ? clean.slice(0, 160) + '…' : clean;
    }
    static updateFromEditor(editor) {
        if (!editor || !editor.document.fileName.endsWith('pom.xml')) {
            MavenProjectContext._current = undefined;
            vscode.commands.executeCommand('setContext', 'gjsMaven.isPom', false);
            vscode.commands.executeCommand('setContext', 'gjsMaven.packaging', '');
            vscode.commands.executeCommand('setContext', 'gjsMaven.isAggregator', false);
            vscode.commands.executeCommand('setContext', 'gjsMaven.hasParent', false);
            MavenProjectContext.setLanguageContext(undefined);
            MavenProjectContext._onDidChange.fire(undefined);
            return;
        }
        MavenProjectContext.updateFromDocument(editor.document.uri.fsPath);
    }
    static updateFromDocument(pomPath) {
        try {
            const text = fs.readFileSync(pomPath, 'utf8');
            const stripped = MavenProjectContext.stripNested(text);
            const groupId = (stripped.match(/<groupId>([^<]+)/) || [])[1]?.trim() ?? '';
            const artifactId = (stripped.match(/<artifactId>([^<]+)/) || [])[1]?.trim() ?? '';
            const version = (stripped.match(/<version>([^<]+)/) || [])[1]?.trim() ?? '';
            const packaging = MavenProjectContext.readPackagingFromPom(text);
            const hasParent = /<parent>/.test(text);
            const hasModules = /<modules>/.test(text);
            const projectDir = path.dirname(pomPath);
            let language;
            if (!MavenProjectContext.isLanguageless(packaging)) {
                // 1) Lectura barata: la propiedad declarada en el propio pom
                //    (así vienen los proyectos generados por los arquetipos gjs)
                language = MavenProjectContext.readLanguageFromPom(text);
                if (language) {
                    MavenProjectContext._languageCache.set(projectDir, language);
                }
                else {
                    // 2) Valor que Maven ya resolvió en una visita anterior
                    language = MavenProjectContext._languageCache.get(projectDir) || undefined;
                }
            }
            MavenProjectContext._current = {
                pomPath,
                groupId,
                artifactId,
                version,
                packaging,
                hasParent,
                hasModules,
                language
            };
            vscode.commands.executeCommand('setContext', 'gjsMaven.isPom', true);
            vscode.commands.executeCommand('setContext', 'gjsMaven.packaging', packaging);
            vscode.commands.executeCommand('setContext', 'gjsMaven.isAggregator', packaging === 'pom' && hasModules);
            vscode.commands.executeCommand('setContext', 'gjsMaven.hasParent', hasParent);
            MavenProjectContext.setLanguageContext(language);
            MavenProjectContext._onDidChange.fire(MavenProjectContext._current);
            // 3) Sigue sin saberse: casi siempre se hereda de un pom padre, y eso
            //    solo lo sabe Maven. Consulta de fondo, una sola vez por módulo.
            if (!language && !MavenProjectContext.isLanguageless(packaging)) {
                void MavenProjectContext.resolveLanguage(pomPath, projectDir);
            }
        }
        catch {
            MavenProjectContext._current = undefined;
            MavenProjectContext.setLanguageContext(undefined);
            MavenProjectContext._onDidChange.fire(undefined);
        }
    }
    /**
     * Recalcula el módulo activo a partir del fichero que se edita, sea del
     * tipo que sea. No se anuncia hasta conocer el lenguaje, para que quien
     * escuche reciba un módulo completo y no tenga que esperar un segundo aviso.
     */
    static async updateActiveModule(editor) {
        const filePath = editor?.document.uri.fsPath;
        const projectDir = filePath ? MavenProjectContext.findModuleDir(filePath) : undefined;
        // Un fichero fuera de todo módulo (un settings.json, un fichero suelto)
        // no invalida el último módulo conocido: no hay motivo para tumbar la
        // configuración de C/C++ por asomarse un momento a otra cosa.
        if (!projectDir) {
            return;
        }
        if (projectDir === MavenProjectContext._requestedModuleDir) {
            return;
        }
        MavenProjectContext._requestedModuleDir = projectDir;
        const language = await MavenProjectContext.getLanguage(projectDir);
        // Mientras se resolvía el lenguaje pudo pedirse otro módulo
        if (MavenProjectContext._requestedModuleDir !== projectDir) {
            return;
        }
        if (MavenProjectContext._activeModule?.projectDir === projectDir &&
            MavenProjectContext._activeModule?.language === language) {
            return;
        }
        const pomPath = path.join(projectDir, 'pom.xml');
        MavenProjectContext._activeModule = {
            projectDir,
            pomPath,
            artifactId: MavenProjectContext.readArtifactId(pomPath),
            language
        };
        MavenProjectContext._onDidChangeActiveModule.fire(MavenProjectContext._activeModule);
    }
    /**
     * Módulo al que pertenece un fichero: el pom.xml más cercano subiendo por
     * el árbol, sin salir de la carpeta del workspace.
     */
    static findModuleDir(filePath) {
        const start = path.dirname(filePath);
        const cached = MavenProjectContext._moduleDirCache.get(start);
        if (cached !== undefined) {
            return cached || undefined;
        }
        const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath))?.uri.fsPath;
        const visited = [];
        let dir = start;
        let found = '';
        while (true) {
            visited.push(dir);
            if (fs.existsSync(path.join(dir, 'pom.xml'))) {
                found = dir;
                break;
            }
            if (folder && path.relative(folder, dir) === '') {
                break;
            }
            const parent = path.dirname(dir);
            if (parent === dir) {
                break;
            }
            dir = parent;
        }
        // Todo lo recorrido cuelga del módulo encontrado (o de ninguno)
        for (const each of visited) {
            MavenProjectContext._moduleDirCache.set(each, found);
        }
        return found || undefined;
    }
    /**
     * Un pom de este packaging no aporta código propio: es un padre o un
     * agregador. Aunque defina gjs.source.language —y los parents de gjs lo
     * hacen— esa propiedad describe a los proyectos que heredan de él.
     */
    static isLanguageless(packaging) {
        return packaging === 'pom';
    }
    /**
     * Read only the top-level project fields, not nested ones.
     * Strip <parent> and <dependencies> blocks to avoid false matches.
     */
    static stripNested(text) {
        return text
            .replace(/<parent>[\s\S]*?<\/parent>/g, '')
            .replace(/<dependencies>[\s\S]*?<\/dependencies>/g, '')
            .replace(/<plugins>[\s\S]*?<\/plugins>/g, '');
    }
    /**
     * artifactId propio del pom. Es la única coordenada que un pom siempre
     * declara —groupId y version pueden heredarse—, así que basta con leer el
     * fichero: no hace falta molestar a Maven para nombrar al módulo.
     */
    static readArtifactId(pomPath) {
        try {
            const stripped = MavenProjectContext.stripNested(fs.readFileSync(pomPath, 'utf8'));
            return (stripped.match(/<artifactId>([^<]+)/) || [])[1]?.trim() || undefined;
        }
        catch {
            return undefined;
        }
    }
    static readPackagingFromPom(text) {
        const stripped = MavenProjectContext.stripNested(text);
        return (stripped.match(/<packaging>([^<]+)/) || [])[1]?.trim() ?? 'jar';
    }
    /** Busca gjs.source.language declarado literalmente en el texto del pom. */
    static readLanguageFromPom(text) {
        const raw = (text.match(/<gjs\.source\.language>([^<]*)<\/gjs\.source\.language>/) || [])[1];
        return MavenProjectContext.normalizeLanguage(raw);
    }
    /**
     * Lenguaje canónico (gjs.source.language) del módulo que hay en projectDir.
     * Punto de entrada único: primero la propiedad literal del pom, y si no
     * está, la herencia resuelta por Maven — que cuesta segundos, así que el
     * resultado se cachea, incluida la ausencia de la propiedad.
     * Devuelve undefined mientras no haya evaluador disponible.
     */
    static async getLanguage(projectDir) {
        const cached = MavenProjectContext._languageCache.get(projectDir);
        if (cached !== undefined) {
            return cached || undefined;
        }
        const pending = MavenProjectContext._languagePending.get(projectDir);
        if (pending) {
            return pending;
        }
        try {
            const pomPath = path.join(projectDir, 'pom.xml');
            if (fs.existsSync(pomPath)) {
                const text = fs.readFileSync(pomPath, 'utf8');
                // Un pom padre o agregador no es código en ningún lenguaje: la
                // propiedad, si la declara, habla de su descendencia. Cortar
                // aquí ahorra además una llamada a Maven por cada pom padre.
                if (MavenProjectContext.isLanguageless(MavenProjectContext.readPackagingFromPom(text))) {
                    MavenProjectContext._languageCache.set(projectDir, '');
                    return undefined;
                }
                // Lectura barata: la propiedad declarada en el propio pom del módulo
                const literal = MavenProjectContext.readLanguageFromPom(text);
                if (literal) {
                    MavenProjectContext._languageCache.set(projectDir, literal);
                    return literal;
                }
            }
        }
        catch { /* pom ilegible: que decida Maven */ }
        const evaluator = MavenProjectContext._evaluator;
        if (!evaluator) {
            return undefined;
        }
        const promise = (async () => {
            try {
                const raw = await evaluator.evaluateSilent('gjs.source.language', projectDir);
                const language = MavenProjectContext.normalizeLanguage(raw);
                MavenProjectContext._languageCache.set(projectDir, language ?? '');
                console.log(`Gjs Maven VS Code Extension: language(${projectDir}) = ${language ?? '<sin definir>'}`);
                return language;
            }
            finally {
                MavenProjectContext._languagePending.delete(projectDir);
            }
        })();
        MavenProjectContext._languagePending.set(projectDir, promise);
        return promise;
    }
    /** Resuelve el lenguaje del pom activo y, si llega a tiempo, lo publica. */
    static async resolveLanguage(pomPath, projectDir) {
        const language = await MavenProjectContext.getLanguage(projectDir);
        if (!language) {
            return;
        }
        // El editor activo pudo cambiar mientras Maven trabajaba
        if (MavenProjectContext._current?.pomPath !== pomPath) {
            return;
        }
        MavenProjectContext._current = { ...MavenProjectContext._current, language };
        MavenProjectContext.setLanguageContext(language);
        MavenProjectContext._onDidChange.fire(MavenProjectContext._current);
    }
    /**
     * Filtra lo que no es un lenguaje: propiedad sin definir ('null object or
     * invalid expression'), placeholder sin interpolar o mensajes sueltos.
     */
    static normalizeLanguage(raw) {
        const value = raw?.trim().toLowerCase();
        if (!value) {
            return undefined;
        }
        if (value.includes('${')) {
            return undefined;
        }
        if (/\s/.test(value)) {
            return undefined;
        }
        return value;
    }
    static setLanguageContext(language) {
        vscode.commands.executeCommand('setContext', 'gjsMaven.language', language ?? '');
    }
}
exports.MavenProjectContext = MavenProjectContext;
MavenProjectContext._globalConfig = { localRepository: '' };
MavenProjectContext._onDidChange = new vscode.EventEmitter();
/**
 * Lenguaje ya resuelto, indexado por directorio de proyecto.
 * La cadena vacía es una entrada negativa: "ya se preguntó a Maven y este
 * proyecto no define gjs.source.language". Evita repetir la consulta.
 */
MavenProjectContext._languageCache = new Map();
/** Consultas a Maven en vuelo: los interesados comparten la misma promesa. */
MavenProjectContext._languagePending = new Map();
MavenProjectContext._onDidChangeActiveModule = new vscode.EventEmitter();
/** Directorio → módulo al que pertenece ('' = ninguno). */
MavenProjectContext._moduleDirCache = new Map();
MavenProjectContext.onDidChange = MavenProjectContext._onDidChange.event;
MavenProjectContext.onDidChangeActiveModule = MavenProjectContext._onDidChangeActiveModule.event;
//# sourceMappingURL=MavenProjectContext.js.map