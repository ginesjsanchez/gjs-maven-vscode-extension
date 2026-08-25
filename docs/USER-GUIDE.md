# Gjs Maven VS Code Extension — User Guide

This guide covers how the extension decides what you are working on, what
**Maven Update** does for each language, and how the C/C++ include path is kept
in sync in multi-module projects.

For the feature list, settings and snippets, see the [README](../README.md).

---

## 1. How the extension knows where you are

The extension tracks two different things. They are related but not the same,
and knowing which is which explains most of its behaviour.

| Concept | What it is | When it changes |
|---|---|---|
| **Active POM** | The `pom.xml` you are *looking at* | Only when a `pom.xml` is the active editor |
| **Active module** | The module the file you are *editing* belongs to | With any file, of any type |

The active module is found by walking up from the edited file to the nearest
`pom.xml`, without leaving the workspace folder. Editing
`my-module/src/main/c/foo.c` makes `my-module` the active module.

Opening a file that belongs to no module — a loose text file, a global
settings file — does **not** clear the active module. Glancing at something
else is not a reason to tear down your C/C++ configuration.

### Module language

The language of a module is the value of the Maven property
`gjs.source.language`: `c`, `c++`, `java`, `python`, `typescript`.

It is resolved in three steps, cheapest first:

1. The property declared literally in the module's own `pom.xml`.
2. A value already resolved for that module earlier in the session (cached).
3. `mvn help:evaluate`, run quietly in the background, to resolve the property
   through the POM inheritance chain.

Step 3 is what makes it work for projects that do not declare the property
themselves and inherit it from a parent — which is the normal case. It takes a
few seconds the first time for each module, and nothing at all afterwards.

> **POM packaging is deliberately excluded.** A parent or aggregator POM has no
> language of its own, even when it declares `gjs.source.language` for its
> children — the property describes its descendants, not itself. Modules with
> `<packaging>pom</packaging>` are reported as having no language, and they are
> never queried through Maven.

Projects that do not use `gjs.source.language` at all still get language
*detection* for the extension recommendations, based on the plugins declared in
the POM and the source files present in the workspace.

---

## 2. Maven Update

**Maven Update** is the equivalent of Eclipse's *Maven Update Project*: it
brings whatever the IDE needs up to date, **without compiling anything**.

Run it from the `pom.xml` context menu, or from the command palette with
`Maven: Maven Update`.

What it does depends on the module's language:

| Language | What runs |
|---|---|
| `c`, `c++` | `mvn process-sources` — resolves and unpacks the native libraries, then recalculates the include path |
| Anything else | `dependency:copy-dependencies` followed by `dependency:unpack-dependencies` into `target/unpacked` |

For C/C++ the reason it stops at `process-sources` is that the NAR lifecycle
binds `nar-download`, `nar-unpack` and `nar-include-path` to phases *before*
`compile`. Going any further would compile the module, which defeats the point:
you want the IDE to understand a project that does not build yet.

> Invoked from the command palette with no `pom.xml` open, Maven Update applies
> to the **active module** — never to the workspace root. Running it on an
> aggregator would drag the whole tree in.

---

## 3. C/C++ include path

In a multi-module C/C++ project, `.vscode/c_cpp_properties.json` follows the
module you are working on.

### How it works

The extension does not compute include paths. The `nar-include-path` goal of
the `nar-maven-plugin` publishes a complete, ready-made configuration at:

```
<module>/target/nar/c_cpp_properties.json
```

That file already carries the include directories, the `defines`, the compiler
path, the language standard and the IntelliSense mode of the build mode
currently in use. The extension's job is only to put the right one in place.

### Switching modules

When you move to a file in a different C/C++ module, its generated file is
copied over `<workspace>/.vscode/c_cpp_properties.json`. A few details worth
knowing:

- There is a short delay (a quarter of a second) before it reacts, so moving
  quickly between files does not cause a write per keystroke.
- If the contents would be identical, nothing is written — every write costs
  IntelliSense a reparse.
- Moving to a module that is **not** C/C++ leaves the configuration untouched.
  Opening a POM or a Java class is no reason to break IntelliSense.
- The configuration keeps the module's artifactId as its name, so the C/C++
  status bar tells you which module is currently active.

### Keeping it up to date

Anything that regenerates the file is picked up automatically — Maven Update,
a full build from the extension, or `mvn` run by hand in a Cygwin console. The
extension watches the generated file rather than trying to guess which commands
produce it.

### When the file is not there

If the module has been cleaned or never built, a notification offers to run
**Maven Update**, which generates it without compiling. It is asked once per
module and session; the notification also stays in the Notifications bell if
you miss it.

### The first overwrite

If a `.vscode/c_cpp_properties.json` already exists when the extension is about
to take over, it asks for permission once per workspace before replacing it.

---

## 3b. Headers of C modules

VS Code associates `.h` with **C++** out of the box. Its built-in `cpp`
extension gives `.c` and `.i` to the `c` language and everything else — `.cpp`,
`.hpp`, and `.h` among them — to `cpp`. In a pure C module every header
therefore opens in C++ mode, before the C/C++ extension gets to have an opinion.

Since the extension knows each module's real language from
`gjs.source.language`, it corrects this by adding an entry to
`files.associations` in the workspace settings:

```json
"files.associations": {
  "**/gjs-c/gjs-c-common-components/gjs-c-common-log/**/*.h": "c"
}
```

Only modules whose language is `c` get an entry; `c++` modules are already
right by default. The pattern is the module path relative to the workspace
folder, not just its directory name, so two modules with the same name in
different parts of the tree do not collide.

Entries appear as you visit modules — resolving the language of every module up
front would cost one Maven call per module. Entries whose module no longer
exists are removed on the next start.

> **`settings.json` is yours.** Unlike `c_cpp_properties.json`, it is never
> rewritten as a whole: only the extension's own keys are added and removed,
> through the VS Code configuration API, leaving everything else — including
> any `files.associations` you wrote yourself — untouched.

Set `gjsMaven.cpp.associateHeaders` to `false` to turn this off.

---

## 3c. The Editor Language Status panel

**Editor Language Status** is the panel that opens from the `{}` icon on the
right of the status bar. Language extensions publish what they know about the
current file there — the C/C++ extension, for one, reports the configuration
it picked and whether IntelliSense is ready.

The extension adds its own entry, **GJS Maven**:

```
GJS Maven   gjs-c-common-log (C)   gjs.source.language   [ Maven Update ]
```

The panel is a narrow column, and its rows do not wrap: anything that does not
fit ends up behind a horizontal scrollbar. So the detail is kept to the bare
source of the claim, and the longer explanation lives in the button's tooltip.

The point is that this line is not a guess. What the other entries say about a
`.h` is heuristics; this one comes from `gjs.source.language` in the effective
POM — the same source that drives the include path and the header
associations. When they disagree, this is the one that knows.

The entry shows the active module's `artifactId` and its language, and its
selector follows the active module, so it only appears on files it can actually
answer for. On a file outside any module it disappears rather than blaming the
last module you visited.

| Module | Detail | Button |
|---|---|---|
| C/C++, include path calculated | `gjs.source.language` | **Maven Update** |
| C/C++, no `target/nar/c_cpp_properties.json` | `includePath sin calcular`, as a warning | **Maven Update** |
| Java, Python, … | `gjs.source.language` | **Open pom.xml** |
| Language not defined | `sin gjs.source.language` | **Open pom.xml** |

The C/C++ warning tracks the file as it appears and disappears, so generating
the include path clears it without changing modules.

Set `gjsMaven.showLanguageStatus` to `false` to turn this off.

---

## 4. Things to know

**Keep `.vscode/` out of version control.** From the moment the extension takes
over, `c_cpp_properties.json` is a generated file that changes every time you
move between modules. Beyond the noise in your diffs, IDE configuration is
personal to each developer. Add `.vscode/` to `.gitignore`.

**Split editors follow the focused one.** VS Code has a single active C/C++
configuration per window. With two modules open side by side, the include path
follows whichever editor has the focus, and the other may show false squiggles.
This is the trade-off for keeping exactly one configuration in the file, which
is what makes switching reliable.

**Test sources are not covered yet.** Only `target/nar/c_cpp_properties.json`
is used — the compile-scope include path. The `nar-test-include-path` goal
publishes an equivalent for test sources at `target/test-nar/`, but the NAR
lifecycle binds the test goals to phases *after* `compile`, so that file cannot
be produced without building the module first. Until the plugin rebinds them,
editing files under `src/test/...` uses the main configuration.

---

## 5. Troubleshooting

Open `Help ▸ Toggle Developer Tools ▸ Console` to see what the extension
resolved. Useful lines:

```
Gjs Maven VS Code Extension: language(<dir>) = c++
Gjs Maven VS Code Extension: c_cpp_properties.json <- <dir>
```

**The language comes out as `<sin definir>`.** Either the module really does not
define `gjs.source.language` anywhere in its inheritance chain, or `mvn` could
not run. The background query inherits the environment of the VS Code process,
not the one of your Cygwin console: if `mvn` is only on the PATH of that
console, the query fails silently. Set `gjsMaven.mavenExecutable` to the full
path of the executable.

**No line appears when opening a POM.** Expected in two cases: the module's
language was already resolved earlier in the session and came from the cache,
or the POM has `<packaging>pom</packaging>` and is therefore never queried.

**The include path does not change.** Check that the module is C/C++, that
`<module>/target/nar/c_cpp_properties.json` exists, and that the workspace
folder actually contains the module — the file is written to the `.vscode` of
the workspace folder the module belongs to.

---

## 6. Living with the Java language server

Language Support for Java (Red Hat) activates on `workspaceContains:pom.xml`. One
POM anywhere in the tree is enough — it does not check whether there is any Java.
In a polyglot tree that means it imports modules it has no business in, builds
them, and reports problems about them.

### Why `java.import.exclusions` does not help

The obvious lever looks like `java.import.exclusions`. It does not work when the
workspace root is an **aggregator**. Those globs filter the *filesystem scan* for
build files; they do not filter the reactor. Once the root `pom.xml` is found —
and the root is never excluded — the Maven importer pulls in every module listed
in its `<modules>`, whatever the globs say.

Measured on a 120-module tree with `**/gjs-c/**` and three more subtrees
excluded: **119 projects imported**. The exclusions changed nothing.

### What this extension does instead

**Maven: Import Only Java Modules Into The Java Language Server** computes the
selection for you and hands it straight to the Java server.

The language of every module comes from a single `mvn help:effective-pom` over
the aggregator: one Maven call returns the effective POM of the whole reactor,
inheritance already resolved — which matters, because modules rarely declare
`gjs.source.language` themselves, they inherit it from a parent. Each module's
directory comes from `<build><directory>`, absolute in the effective POM.

Modules whose effective language is `java` **and whose packaging is not `pom`**
are imported; everything already imported that is not Java is dropped.

That second condition matters more than it looks. A parent POM declares
`gjs.source.language` *for its descendants, not for itself*, so the parents come
back from Maven claiming to be Java without holding a single class. Measured on
a 120-module tree: 35 modules report `java`, and 14 of them are parents. It is
the same rule `MavenProjectContext.isLanguageless()` applies everywhere else in
this extension.

On that tree the result is 21 imported projects instead of 120.

### Why it has to run again on every start

Dropping projects does not stick. With `java.import.projectSelection` at its
default `automatic`, every start re-imports the whole reactor and takes any
selection with it. Measured on the same tree:

| | Projects |
|---|---|
| After a normal start | 119 |
| After running the command | 96 |
| **After reloading the window** | **120** |

So the selection is saved, and reapplied on every start:

```
.vscode/gjs-maven-java-modules.json
```

That file is both the list and the switch. Paths are relative to the workspace
folder, so it survives moving or sharing the tree; it is plain JSON so you can
read and correct it by hand; and **deleting it turns the feature off** — there
is no hidden state anywhere else. A module listed there that no longer has a
`pom.xml` is ignored. **Maven: Stop Restricting The Java Language Server**
deletes it for you.

Reapplying is cheap because the list is already known: no Maven call, just the
selection handed back to the server when it announces — through its public
`onDidProjectsImport` — that it has finished importing.

### What this does not fix

It **undoes, it does not prevent**. On every start the Java server still imports
all the modules and builds them; only then does the selection get reapplied.
Measured on the 120-module tree: `Workspace initialized in 44669ms`, then the
build, then the drop.

What that buys you is a clean steady state — no problem markers from modules
that are not Java, and no rebuild when you clean a C/C++ module. What it does
not buy you is a faster startup.

The alternative would be `java.import.projectSelection: "manual"`, which does
prevent the import. This extension deliberately does not set it: with `manual`
the server starts in **LightWeight on every start**, not once — it is forced in
its `initialize()` — leaving you with no Java support at all until you import by
hand. That is a worse trade than arriving late.

### The catch

This drives two **internal, undocumented** commands of `redhat.java` —
`java.project.changeImportedProjects` and `java.project.getAll`, both through
`java.execute.workspaceCommand`. They are what its own manual-selection flow
uses underneath, but they are not public API and a future version may rename or
remove them. Everything that touches them is wrapped: if they are gone, it says
so and changes nothing.

Two details that cost real debugging, in case they ever change again:

- `java.project.getAll` returns **only the projects with a Java nature** unless
  you pass `{"includeNonJava": true}`. On the sample tree that is 45 projects
  instead of 120 — and a selection computed from the short list silently leaves
  most of the tree imported.
- The result includes `jdt.ls-java-project`, the invisible container jdt.ls uses
  for files that belong to no project. It must never be dropped.

Parent and aggregator POMs are not imported, and do not need to be: Maven
resolves parents from disk and from the local repository, not from the Eclipse
workspace.

### Settings worth knowing

None of these are set by the extension; they are yours to choose.

| Setting | Effect |
|---|---|
| `java.configuration.updateBuildConfiguration: "disabled"` | Editing a POM no longer triggers a classpath re-resolution — the main source of both plugins running Maven at once |
| `java.import.projectSelection: "manual"` | Prevents the import entirely, at the cost of LightWeight on every start |
| `java.autobuild.enabled: false` | Stops the Eclipse auto-build entirely |
| `java.project.resourceFilters` | Name regexes kept out of the workspace refresh — useful when the server holds handles in `target/` and `mvn clean` cannot delete it |

---

## 7. The side panels and profiles

**Properties**, **Dependencies**, **Managed Dependencies**, **Plugins** and
**Managed Plugins** show what the POM in the active editor declares. They read
the XML tree, not the text: `<dependencies>` inside a `<plugin>`, inside a
`<profile>` and at project level all look the same to a regular expression and
mean entirely different things.

### One row per element

Profiles exist so that things *vary*, so the same property or plugin routinely
appears more than once in a POM. A flat list would repeat the row, and one
property overridden in five profiles would read as five different properties.

Instead, each element gets exactly one row, and what each profile declares hangs
below it:

```
java.version        (varies)   ▸
     profile jdk-25    25
     profile jdk-21    21
     profile jdk-17    17
```

Identity is the property name; for plugins `groupId:artifactId`; for
dependencies `groupId:artifactId:type:classifier` — the same pair with a
different type or classifier is a different dependency (a `test-jar`, a
`sources`, a platform-classified native), and merging those would be the same
mistake in reverse.

### Reading the marks

These rows are narrow, so the line stays clean and the detail lives in the
tooltip, which lists the full identity and every declaration.

| Mark | Meaning |
|---|---|
| Expand arrow | Some profile declares this too |
| `*` before the name | Declared **only** inside profiles — no project-level declaration |
| `(varies)` | No base declaration and the profiles disagree on the value |
| `(empty)` | Declared with an empty value, which is not the same as not declared |

A POM with no profiles looks exactly as it always did: no arrows, no asterisks.

### What is not shown

Active profiles are not taken into account, so the panels show what the file
declares rather than what a build would resolve. That is deliberate for now: a
profile is not activated only by `-P` but also by `activeByDefault`, `<jdk>`,
`<os>`, `<property>` and `<file>`, and the extension cannot know the resolved
set without asking Maven. Marking the winning variant is a natural next step;
guessing it would not be.

Plugins under `<reporting>` are not listed either — that is a different section
with a different purpose from `<build><plugins>`.
