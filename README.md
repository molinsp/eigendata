

![logo](https://eigendata.co/assets/images/image05.png?v=ff441110)

## Introduction

Product managers, business analysts, operations managers, and other non-technical personas often need to analyze data and build workflows in a repeatable way. This is often done in spreadsheets in a way that is not scalable or robust. To overcome challenges found in spreadsheets, many have learned basic coding to automate business processes or analyze data. But for them, the cognitive overhead of remembering code syntax is too high.

Eigendata empowers these users with a low-code tool that makes manipulating data as easy as a GUI tool but without any of the limitations. With eigendata, all your transformation steps are built on top of industry-standard open-source packages. You can share code with developers once it needs to be productionized, leverage custom code for instances where the tool does not provide a solution and manipulate everything programmatically.

## Eigendata notebook extension

Eigendata renders a form interface below cells in a Jupyter Notebook (can be hidden/shown with  `Ctrl E`), providing fast access to common data transformations without needing to remember the syntax or the exact name of the method. It enables users to become more productive by googling less, reducing syntax errors, and keeping track of the data at all times.

You can try it without installing [here](https://cloud.eigendata.co/).

![logo](https://raw.githubusercontent.com/molinsp/eigendata-doc/master/docs/media/eigendata_overview.png)

Besides these improvements, **Eigendata provides options to simplify the JupyterLab experience** for new users:
- Intuitive shortcuts for the sidebars `⌘ /` `⌘ \`
- When you close a tab, the kernel is shut down

All of these configurations can also be disabled through the advanced settings `⌘ ,`

## Install

```bash
pip install eigendata
```

## Eigendata framework for declarative API GUIs

Eigendata is not just a set of hard-coded UI elements on top of a library. It aims to build a generalizable framework to create GUIs for code libraries. The core framework is based on [react-jsonschema-form](https://react-jsonschema-form.readthedocs.io/en/latest/), with several extensions. You can learn more about the transformation UI spec and how to create your own transformations in our [transformation documentation](/Transformation_documentation.ipynb).

To use your own custom transformations, you can add the JSON code to user transformations in the settings of the eigendata extension. If you want to share transformations across a team (e.g. common features), you can also provide a transformation sever URL that serves a file with the transformations. This can be set up with the `transformationServer` and `transformationAuth` in eigendata settings.

Example transformation UI from a JSON definition:

```json 
"pandas.DataFrame.drop" : {
  "form" : {
        "required" : [
          "columns"
        ],
        "definitions" : {
          "columns" : {
            "type" : "array",
            "uniqueItems" : true,
            "items" : {
              "type" : "string",
              "enum" : []
            }
          }
        },
        "properties" : {
          "columns" : {
            "$ref" : "#/definitions/columns",
            "description" : "Select the columns that you want to remove."
          }
        },
        "title" : "Drop columns",
        "description" : "Drop columns from the dataframe.",
        "type" : "object",
        "callerObject" : "DataFrame",
    		"returnType" : "DataFrame",
        "function" : "drop"
      }
}
```

And the UI rendered based on this definition:

<img src="https://raw.githubusercontent.com/molinsp/eigendata-doc/master/docs/media/transformations_drop.png" alt="logo" style="zoom:50%;" />

## Requirements

* JupyterLab >= 3.0
* Pandas, Nupy, [Fastdata](https://pypi.org/project/fastdata/) (our own library with pandas utilities)

## Uninstall

```bash
pip uninstall eigendata
```

