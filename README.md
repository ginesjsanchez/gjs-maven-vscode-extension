# Gjs Maven VS Code Extension — VS Code Extension

> Maven project support for **any language**: Java, C++, Python, Kotlin, Scala and more.  
> Version **1.2.0** - **22/08/2026**
> Focus on excellent `pom.xml` editing and Maven command management.

📖 **[User Guide](docs/USER-GUIDE.md)** — module and language detection, Maven Update,
and how the C/C++ include path follows the module you are working on.

---

## Features

### 📝 pom.xml Intelligence
| Feature | Details |
|---|---|
| **Autocomplete** | Element names, scope values, packaging types, lifecycle phases, common plugins |
| **Hover docs** | Explanations for every POM element and scope value |
| **Diagnostics** | Warns about missing required elements, duplicate dependencies, version-less deps |
| **Snippets** | Full POM templates for Java, Spring Boot, C++ (NAR), Python/Jython |

### ⚡ Maven Commands
- Run any lifecycle phase from the sidebar, command palette (`Ctrl+Shift+P`) or right-click on `pom.xml`
- **Commands**: `clean`, `compile`, `test`, `package`, `install`, `deploy`, `verify`, `clean install`, custom
- Show **Effective POM** and **Dependency Tree**
- **Add Dependency** — pick from curated list or enter coordinates manually
- Automatically uses `mvnw`/`mvnw.cmd` wrapper if present

### 🗂️ Sidebar Explorer
Four tree views in the Gjs Maven VS Code Extension activity bar:

| View | Contents |
|---|---|
| **Projects** | All `pom.xml` files with groupId / artifactId / version |
| **Lifecycle** | Clickable goals — run any phase with one click |
| **Plugins** | Plugins declared in the active POM |
| **Dependencies** | All dependencies with scope icons |

### 🌐 Language Support (Polyglot!)
Gjs Maven VS Code Extension works with projects in **any language**. It detects what languages your project uses and recommends the right VS Code extensions:

| Language | Detected via | Recommended Extension |
|---|---|---|
| **Java** | `maven-compiler-plugin`, `.java` files | Language Support for Java (Red Hat) |
| **C++** | `nar-maven-plugin`, `.cpp/.h` files | C/C++ (Microsoft) |
| **Python** | `jython`, `exec-maven-plugin`, `.py` files | Python (Microsoft) |
| **TypeScript** | `frontend-maven-plugin`, `.ts` files | ESLint |
| **Kotlin** | `kotlin` in POM, `.kt` files | Kotlin Language |
| **Scala** | `scala` in POM, `.scala` files | Metals |

> When the project declares the `gjs.source.language` property, that value wins over
> the heuristics above — see [Module language](docs/USER-GUIDE.md#module-language).

> Gjs Maven VS Code Extension itself focuses on the **build layer** (pom.xml + Maven commands).  
> Language-specific editing (IntelliSense, debugging) is delegated to the appropriate language extension.

**Maven: Import Only Java Modules Into The Java Language Server** keeps the Red Hat
Java extension off the modules that are not Java — it imports the whole reactor
otherwise. Run it once; the selection is saved to
`.vscode/gjs-maven-java-modules.json` and reapplied on every start, because
dropping projects does not persist on its own. Delete that file, or run
**Maven: Stop Restricting The Java Language Server**, to turn it off. See
[Living with the Java language server](docs/USER-GUIDE.md#6-living-with-the-java-language-server).

---

## Getting Started

1. Open a folder containing a `pom.xml`
2. The Gjs Maven VS Code Extension icon appears in the Activity Bar
3. Use the **Lifecycle** panel to run goals, or `Ctrl+Shift+P` → `Maven: Run Command`

Working on a multi-module C/C++ project? See
[C/C++ include path](docs/USER-GUIDE.md#3-cc-include-path) in the User Guide —
`.vscode/c_cpp_properties.json` is kept in sync with the module you are editing,
and should be kept out of version control.

---

## Snippets

Type these prefixes in any `pom.xml`:

| Prefix | Inserts |
|---|---|
| `pom-basic` | Minimal POM template |
| `pom-spring-boot` | Spring Boot parent POM |
| `pom-cpp-nar` | C++ native project (nar-maven-plugin) |
| `pom-python` | Python/Jython via exec-maven-plugin |
| `dep` | Single dependency block |
| `plugin` | Plugin block |
| `execution` | Plugin execution block |
| `profile` | Build profile |
| `props` | Common properties block |

---

## Configuration

| Setting | Default | Description |
|---|---|---|
| `gjsMaven.mavenExecutable` | `mvn` | Maven executable path (auto-detects `mvnw`) |
| `gjsMaven.javaHome` | `""` | Override `JAVA_HOME` |
| `gjsMaven.terminal.useExistingTerminal` | `true` | Reuse Maven terminal |
| `gjsMaven.pomXml.validateOnSave` | `true` | Validate pom.xml on save |
| `gjsMaven.showStatusBar` | `true` | Show Maven status bar item |
| `gjsMaven.showLanguageStatus` | `true` | Show the active module and its language in the Editor Language Status panel ([why](docs/USER-GUIDE.md#3c-the-editor-language-status-panel)) |
| `gjsMaven.cpp.associateHeaders` | `true` | Associate `.h` files of C modules with the `c` language ([why](docs/USER-GUIDE.md#3b-headers-of-c-modules)) |

---

## Extension Structure

```
gjs-maven-vscode-extension/
├ icons/
│   └ MavenVSExtension.png                 	
├ src/
│   ├ extension.ts                  	# Entry point
│   ├ commands/
│   │   ├ CygwinScriptRunner.ts
│   │   ├ MavenArchetypeRunner.ts
│   │   ├ MavenCommandRunner.ts    		# Terminal command execution
│   │   ├ MavenEvaluator.ts
│   │   ├ MavenOptionsManager.ts
│   │   ├ MavenProfileManager.ts
│   │   ├ ImportJavaModulesCommand.ts	# prunes redhat.java down to the Java modules
│   │   ├ MavenUpdateCommand.ts
│   │   ├ AddPluginCommand.ts
│   │   ├ AddPropertyCommand.ts
│   │   └ AddDependencyCommand.ts  		# Interactive dependency picker
│   ├ context/
│   │   └ MavenProjectContext.ts    		# Active POM, active module, module language
│   ├ cpp/
│   │   ├ CppPropertiesManager.ts   		# c_cpp_properties.json per active module
│   │   └ HeaderAssociationManager.ts		# .h files of C modules -> 'c' language
│   ├ data/
│   │   ├ KnownDependencies.ts
│   │   └ KnownPlugins.ts
│   ├ providers/
│   │   ├ PomXmlCompletionProvider.ts
│   │   ├ PomXmlHoverProvider.ts
│   │   ├ PomXmlDiagnosticsProvider.ts
│   │   ├ MavenDependenciesProvider.ts
│   │   ├ MavenParentProvider.ts
│   │   ├ MavenPropertiesProvider.ts
│   │   ├ MavenProjectsProvider.ts  	# Tree view: projects
│   │   ├ MavenLifecycleProvider.ts 	# Tree view: lifecycle
│   │   └ MavenPluginsProvider.ts   	# Tree views: plugins + deps
│   ├ language/
│   │   └ LanguageSupportManager.ts 	# Polyglot detection + suggestions
│   ├ ui/
│   │   ├ MavenArchetypesView.ts
│   │   ├ MavenOptionsView.ts
│   │   ├ MavenProfilesView.ts
│   │   ├ MavenStatusBar.ts
│   │   └ ModuleLanguageStatus.ts	# Active module + language in Language Status
│   └ utils/
│   │   └ Unpack.ts      		
│   ├ tasks/
│   │   └ MavenTaskProvider.ts      	# VS Code tasks integration
│   ├ terminal/
│   │     └ CygwinTerminalProvider.ts   # Cygwin terminal
│   └ types/
│       └ PomTextStatus.ts      		
├ snippets/
│   └ pom-snippets.json
├ docs/
│   └ USER-GUIDE.md
├ package.json
├ tsconfig.json
├ LICENSE
└ README.md
```

---

## Building & Installing

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package as .vsix
npm install -g @vscode/vsce
vsce package

# Install locally
code --install-extension gjs-maven-vscode-extension-1.2.0.vsix
```
