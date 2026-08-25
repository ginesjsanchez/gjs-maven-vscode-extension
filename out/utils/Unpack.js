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
exports.unpackDependencies = unpackDependencies;
const tar = __importStar(require("tar"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const AdmZip = require('adm-zip');
async function unpackDependencies(dependencyPath, targetPath) {
    if (!fs.existsSync(targetPath))
        fs.mkdirSync(targetPath, { recursive: true });
    const files = fs.readdirSync(dependencyPath);
    for (const file of files) {
        const fullPath = path.join(dependencyPath, file);
        const destDir = path.join(targetPath, stripExtensions(file));
        try {
            if (isZipLike(file))
                unpackZip(fullPath, destDir);
            else if (isTarLike(file))
                await unpackTar(fullPath, destDir);
            else {
                // .so .a .dll .lib → copiar directamente a lib/
                const libDir = path.join(targetPath, 'lib');
                fs.mkdirSync(libDir, { recursive: true });
                fs.copyFileSync(fullPath, path.join(libDir, file));
            }
        }
        catch (e) {
            console.warn(`No se pudo desempaquetar ${file}: ${e.message}`);
        }
    }
}
//  Detección de tipo 
function isZipLike(file) {
    return ['.nar', '.zip', '.jar', '.pyz'].some(ext => file.endsWith(ext));
}
function isTarLike(file) {
    return ['.tar.gz', '.tgz', '.tar.bz2', '.tar.xz', '.tar'].some(ext => file.endsWith(ext));
}
//  Desempaquetadores 
function unpackZip(fullPath, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    const zip = new AdmZip(fullPath);
    zip.extractAllTo(destDir, true);
}
async function unpackTar(fullPath, destDir) {
    fs.mkdirSync(destDir, { recursive: true });
    await tar.extract({ file: fullPath, cwd: destDir });
}
//  Utilidad 
function stripExtensions(file) {
    // Elimina extensiones compuestas como .tar.gz antes que path.basename
    return file
        .replace(/\.(tar\.gz|tar\.bz2|tar\.xz)$/, '')
        .replace(/\.[^.]+$/, '');
}
//# sourceMappingURL=Unpack.js.map