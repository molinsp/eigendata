# eigendata jupyterlab extension

![Github Actions Status](https://github.com/my_name/myextension/workflows/Build/badge.svg)

## Requirements

* JupyterLab >= 2.0
* Python libraries: fastcore, pandas, numpydoc
  * `pip install pandas fastcore numpydoc`
* Recommended to use with fastdata package
  * `pip install -i https://test.pypi.org/simple/ fastdata`

## Installation for alpha testers

Make sure you have installed the python dependencies listed above.

You need to be an authorized alpha tester in npm. Once you have been authorized, you can login to npm (`npm login`) and run:

```bash
jupyter labextension install @molinsp/eigendata
```

Contact pere@eigendata.co for any issues with the process.



### Uninstall

```bash
jupyter labextension uninstall @molinsp/eigendata
```

