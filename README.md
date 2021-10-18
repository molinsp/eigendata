

![logo](/img/logo.png)

Eigendata is a **low-code tool for data analysis** aimed at empowering users that know a bit of code but are not highly productive yet. 

Eigendata renders a form interface below cells in a jupyter notebook (can be hidden/shown with  `Ctrl E`), providing fast acess to common data transformatiosn without needing to remember syntax or the exact name of the method. It enables users to become more productive by googling less, reducing syntax errors and keeping track of the data at all times.

You can try it without installing [here](https://cloud.eigendata.co/).

![logo](/img/eigendata_overview.png)

Besides these improvements, **Eigendata provides options to simplify the JupyterLab interface** for new users:

1. All the menus that can be found through `⌘ ⇧ C` are removed from the UI for simplicity
2. Intuitive coda/notion like shortcuts for the sidebars `⌘ /` `⌘ \`
3. When you close a tab, the kernel is shut down

All of these configurations can also be disabled through the advanced settings `⌘ ,`

## Eigendata extension framework for low-code UIs 

Eigendata is not just a set of hard-coded UI elements on top of a library. It aims to build a generalizable framework to create GUIs for code libraries. The core framework is based on [react-jsonschema-form](https://react-jsonschema-form.readthedocs.io/en/latest/), with several extensions. You can lear more about the transformation UI spec and how to create your own transformations in our [transformation documentation](/Transformation_documentation.ipynb).

To user your own custom transformations, you can either add the json code to user transformations in the settings of the eigendata extension. If you want to share transformations across a team (e.g. common features), you can also provide a transformation sever url that serves a file with the transformations. This can be setup with the `transformationServer` and `transformationAuth` in eigendata settings.

Example transformatio UI from a JSON definition:

```json 
"read_csv" : {
      "form" : {
        "properties" : {
          "filepath_or_buffer" : {
            "type" : "string",
            "title" : "file path",
            "description" : "Location of the file relative to the notebook. E.g. /Documents/Data/testdata.csv."
          },
          "sep" : {
            "type" : "string",
            "default" : ",",
            "title" : "separator",
            "description" : "Character used to separate columns (e.g. commas, semicolons, etc.)."
          },
          "decimal" : {
            "type" : "string",
            "default" : ".",
            "description" : "Character used to indicate decimals."
          },
          "header" : {
            "type" : "number",
            "description" : "Row to use for the column labels (first row is 0)."
          },
          "new table name" : {
            "type" : "string"
          }
        },
        "required" : [
          "filepath_or_buffer"
        ],
        "title" : "Read CSV file",
        "type" : "object",
        "callerObject" : "pd",
        "function" : "read_csv",
        "transformationType" : "dataLoading",
        "description" : "Load the csv in a table."
      },
      "uischema" : {
        "new table name" : {
          "ui:placeholder" : "Leave blank to modify selected table"
        }
      },
      "library" : {
        "name" : "pandas",
        "importStatement" : "import pandas as pd",
        "namespace" : "pd"
      },
      "keywords" : [
        "csv",
        "load",
        "read"
      ]
    }
```

## Install

```bash
pip install eigendata
```


## Requirements

* JupyterLab >= 3.0
* Pandas, Nupy, [Fastdata](https://pypi.org/project/fastdata/) (our own library with pandas utilities)

## Uninstall

```bash
pip uninstall eigendata
```

