# eigendata jupyterlab extension

![Github Actions Status](https://github.com/my_name/myextension/workflows/Build/badge.svg)

## Requirements

* JupyterLab >= 2.0
* react-jsonschema-form
* react-select
* bootstrap3
* loadash
* react-awesome-querybuilder (under testing)
* react-querybuildre (under testing)

## Install

```bash
jupyter labextension install eigendata-formula-bar
```

## Contributing

### Install

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Move to eigendata-formula_bar-v2 directory

# Install dependencies
jlpm
# Build Typescript source
jlpm build
# Link your development version of the extension with JupyterLab
jupyter labextension install .
# Rebuild Typescript source after making changes
jlpm build
# Rebuild JupyterLab after making any changes
jupyter lab build
```

You can watch the source directory and run JupyterLab in watch mode to watch for changes in the extension's source and automatically rebuild the extension and application.

```bash
# Watch the source directory in another terminal tab
jlpm watch
# Run jupyterlab in watch mode in one terminal tab
jupyter lab --watch
```

Now every change will be built locally and bundled into JupyterLab. Be sure to refresh your browser page after saving file changes to reload the extension (note: you'll need to wait for webpack to finish, which can take 10s+ at times).

### Uninstall

```bash
jupyter labextension uninstall eigendata-formula-bar-v2
```

## Changes to tsconfig from default

* Commented out strict which was set to true
* Changes to make JSON work
  * resolveJsonModule -> true
  * esModuleInterop -> true
  * Composite -> false

## Architecture

Arkit installed as a dev-dependency to create overview diagrams. More info [here](https://github.com/dyatko/arkit)

- Main files

  - **index.ts:** file starts the extension and creates an instance of the FormWidget class, which holds all the logic
  - **widget.tsx:** Both logic (Backend class) and UI (FormComponent function) are in the file

- Support files

  - **initscript.ts:** holts a string with the script that is run in the kernel when the application starts. It is held sepparately to make it easier to read
  - **kernelconnector.ts:** is taken [variable inspector package](https://github.com/lckr/jupyterlab-variableInspector). It is mainly used to execute python scripts in the kernel
    - The core version of jupyterlab has a similar implementation so it may be wiser to use that 
  - **CellUtilities.ts:** is based on an [open-source project](https://github.com/CDAT/jupyter-vcdat/blob/master/src/CellUtilities.ts). Using only the insertRunShow function to insert a new cell and run it in a notebook
  - **transformations.json:** Holds the UI definition of data transformation functions in python
- **demo.tsx:** Holds code to test the react-awesome-querybuilder
  
  