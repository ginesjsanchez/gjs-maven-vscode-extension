# Gjs Maven VS Code Extension — VS Code Extension

> Maven project support for **any language**: Java, C++, Python, Kotlin, Scala and more.  
> Focus on excellent `pom.xml` editing and Maven command management.

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
| **Kotlin** | `kotlin` in POM, `.kt` files | Kotlin Language |
| **Scala** | `scala` in POM, `.scala` files | Metals |

> Gjs Maven VS Code Extension itself focuses on the **build layer** (pom.xml + Maven commands).  
> Language-specific editing (IntelliSense, debugging) is delegated to the appropriate language extension.

---

## Getting Started

1. Open a folder containing a `pom.xml`
2. The Gjs Maven VS Code Extension icon appears in the Activity Bar
3. Use the **Lifecycle** panel to run goals, or `Ctrl+Shift+P` → `Maven: Run Command`

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

---

## Extension Structure

```
gjs-maven-vscode-extension/
├ src/
│   ├ extension.ts                  # Entry point
│   ├ commands/
│   │   ├ MavenCommandRunner.ts     # Terminal command execution
│   │   └ AddDependencyCommand.ts   # Interactive dependency picker
│   ├ providers/
│   │   ├ PomXmlCompletionProvider.ts
│   │   ├ PomXmlHoverProvider.ts
│   │   ├ PomXmlDiagnosticsProvider.ts
│   │   ├ MavenProjectsProvider.ts  # Tree view: projects
│   │   ├ MavenLifecycleProvider.ts # Tree view: lifecycle
│   │   └ MavenPluginsProvider.ts   # Tree views: plugins + deps
│   ├ language/
│   │   └ LanguageSupportManager.ts # Polyglot detection + suggestions
│   ├ ui/
│   │   └ MavenStatusBar.ts
│   └ tasks/
│       └ MavenTaskProvider.ts      # VS Code tasks integration
├ snippets/
│   └ pom-snippets.json
├ package.json
└ tsconfig.json
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
code --install-extension gjs-maven-vscode-extension-1.0.0.vsix
```
