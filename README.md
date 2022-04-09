

![logo](https://doc.eigendata.co/media/logo.png)

## Introduction

Product managers, business analysts, operations managers, and other non-technical personas often need to analyze data or complete repetitive tasks in the context of a business process. 

This is often done in spreadsheets in a way that is not scalable or robust. To overcome challenges found in spreadsheets, many have learned basic coding. 

But **for these "semi-technical" users, the cognitive overhead of remembering code syntax is often too high**, hampering their productivity.

**Eigendata empowers "semi-technical" users with a Python low-code tool that makes manipulating data as easy as spreadsheets, without any of the limitations**. 

1. You can easily do a quick and dirty analysis without having to deal with the overhead of remembering basic python syntax 
2. If you need to automate the process, you can leverage the underlying code generated  using the tool to turn the transformations into a repeatable process. 
3. If the process needs to be "productionized" by an engineering they can start from a code-base based on standard python packages

## Eigendata JupyerLab Extension

**Eigendata renders a low-code interface below cells in a [JupyterLab Notebook](https://jupyter.org/)**, providing fast access to common data transformations without needing to remember the syntax or the exact name of the method. 

Open a JupyerLab notebook, and you will see



Besides these improvements, **Eigendata provides options to simplify the JupyterLab experience** for new users:
- Intuitive shortcuts for the sidebars `⌘ /` `⌘ \`
- When you close a tab, the kernel is shut down

All of these configurations can also be disabled through the advanced settings `⌘ ,`

## Install

You can try a free cloud instance [here](https://cloud.eigendata.co/) or install with pip

```bash
pip install eigendata
```

## Eigendata Core: Framework for declarative GUIs

Eigendata is built on top of an extensible framework to render Python methods as GUIs.

To use your own custom transformations:

1. You can add the JSON code to user transformations in the settings of the eigendata extension. 
2. If you want to share transformations across a team (e.g. common features), you can also provide a transformation sever URL that serves a file with the transformations. This can be set up with the `transformationServer` and `transformationAuth` in eigendata settings.

You can learn more about the transformation UI spec and how to create your own transformations in our [transformation documentation](/Transformation_documentation.ipynb).

**Example transformation UI from a JSON definition:**

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
* Pandas, Numpy, [Fastdata](https://pypi.org/project/fastdata/) (our own library with pandas utilities)

## Uninstall

```bash
pip uninstall eigendata
```

