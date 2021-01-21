import { ReactWidget, UseSignal } from '@jupyterlab/apputils';
import React, { useState, useEffect } from 'react';
import { useTable, useResizeColumns, useBlockLayout } from 'react-table';
import amplitude from 'amplitude-js';
import { ISignal } from '@lumino/signaling';
import { Backend } from '../core/backend';
import {
  getUSDString,
  cutString,
  separateThousands
} from '../utils/stringUtils';

/**
 * React component for a counter.
 *
 * @returns The React component
 */
const DataVisualizerComponent = (props: { logic: Backend }): JSX.Element => {
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [variables, setVariables] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [columnTypes, setColumnTypes] = useState([]);
  const [shape, setShape] = useState({});

  const url = window.location.href;
  const binderUrl = url.includes('molinsp-eigendata-trial');

  if (props.logic.resetStateDatavisualizerFlag === true) {
    console.log('RESETING DATA VISUALIZER STATE');
    setColumns([]);
    setData([]);
    setShowTable(false);
    setActiveTab(0);
    setVariables([]);
    props.logic.resetStateDatavisualizerFlag = false;
  }

  // Set active tab to the latest dataframe/variable
  useEffect(() => {
    const dataframeValues = props.logic.dataframesLoaded.map(df => df?.value);
    if (dataframeValues.length > 0) {
      const currentDataframeValue = props.logic.dataframeSelection;
      console.log('1) ', dataframeValues);
      console.log('2) ', currentDataframeValue);
      //if there is variable name, indexOf returns -1 - index of variable tab
      const index = dataframeValues.indexOf(currentDataframeValue)
      setActiveTab(index);
    }
  }, [props.logic.dataframeSelection]);

  //Rerender variables table
  useEffect(() => {
    const variables = props.logic.variablesLoaded;
    console.log('vars: ', variables, activeTab);
    setVariables([...variables]);
    if (isVariableTab(activeTab)) {
      const keys = Object.keys(variables[0]);
      const columns = keys.map(key => ({
        accessor: key,
        Header: key,
        Cell: (props): string => getUSDString(props.value)
      }));
      setColumns([...columns]);
      setData([...variables]);
    }
  }, [activeTab, props.logic.variablesLoaded]);

  //Rerender other tables
  useEffect(() => {
    const getDataForVisualization = async (): Promise<void> => {
      try {
        const dataframes = props.logic.dataframesLoaded;
        console.log('Dataframes', dataframes);
        if (dataframes[activeTab]) {
          const result = await props.logic.pythonGetDataForVisualization(
            dataframes[activeTab].value
          );
          // Add missing methods and properties
          const columns = result['columns'].map((column, index) => {
            if (index === 0) {
              column.width = 55;
            }
            column.Cell = (props): string => getUSDString(props.value);
            return column;
          });
            setShowTable(true);
            setColumns([...columns]);
            setData([...result['data']]);
            setColumnTypes([...result['columnTypes']]);
            setShape({ ...result['shape'] });
        }
      } catch (e) {
        setShowTable(false);
      }
    };

    const dataframeValues = props.logic.dataframesLoaded.map(df => df?.value);
    if (dataframeValues.includes(props.logic.dataframeSelection) || !props.logic.dataframeSelection) {
      getDataForVisualization();
    }
  }, [activeTab, props.logic.dataframesLoaded]);

  // Default size of columns
  const defaultColumn = React.useMemo(
    () => ({
      minWidth: 30,
      width: 80
    }),
    []
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow
  } = useTable(
    { columns, data, defaultColumn },
    useBlockLayout,
    useResizeColumns
  );

  const closeDropdownMenu = (element: Element): void => {
    element.className = element.className.replace(' show', '');
  };

  const openDropdownMenu = (index: number): void => {
    const dropdown = document.querySelector(
      `#dropdown-${index} .dropdown-menu`
    );
    if (dropdown.className.indexOf('show') === -1) {
      dropdown.className += ' show';
    } else {
      closeDropdownMenu(dropdown);
    }
  };

  const onBlur = (e, index: number): void => {
    const dropdown = document.querySelector(
      `#dropdown-${index} .dropdown-menu`
    );
    const target = e.relatedTarget;
    if (target.className !== 'dropdown-item') {
      closeDropdownMenu(dropdown);
    }
  };

  const deleteTab = async (table: string): Promise<void> => {
    await props.logic.pythonRemoveTable(table);
    const dropdowns = document.querySelectorAll('.dropdown-menu');
    const element = Array.from(dropdowns).find(element =>
      element.className.includes('show')
    );
    if (element) {
      closeDropdownMenu(element);
    }
  };

  const isLastRow = (row: number): boolean => {
    return row === headerGroups.length - 1;
  };

  const isVariableTab = (tab: number): boolean => {
    return tab === -1;
  };

  const onTabClick = (index: number): void => {
    setActiveTab(index);
    props.logic.dataframeSelection = props.logic.dataframesLoaded[index].value;
    if (
      props.logic._production &&
      props.logic.shareProductData
    ) {
      amplitude
        .getInstance()
        .logEvent('Datavisualizer: change tab', {
          index: index
        });
    }
  }

  return (
    <div className="full-height-container">
      {binderUrl && (
        <div className="binderButtonSeparator">
          <a
            href="https://calendly.com/molinsp/eigendata-demo"
            className="binderButton"
          >
            BOOK A DEMO
          </a>
        </div>
      )}
      {showTable ? (
        <div className="full-height-container">
          <nav className="scroll-nav">
            <div className="dropdown-container">
              {variables.length > 0 && (
                <button
                  type="button"
                  className={`tab-button ${isVariableTab(activeTab) &&
                    'tab-button_active'} variables-button`}
                  onClick={(): void => {
                    setActiveTab(-1);

                  }}
                >
                  Variables
                </button>
              )}
              {props.logic.dataframesLoaded.map((dataframe, index) => {
                return (
                  <div
                    className="dropdown"
                    id={'dropdown-' + index}
                    key={'dropdown-' + index}
                  >
                    <button
                      type="button"
                      className={`tab-button ${
                        activeTab === index
                          ? 'tab-button_active'
                          : 'tab-button_inactive'
                      }`}
                      onClick={(): void => {onTabClick(index)}}
                      title={dataframe.label}
                    >
                      {cutString(dataframe.label, 20)}
                    </button>
                    <button
                      type="button"
                      className={`dropdown-button dropdown-toggle ${
                        activeTab === index
                          ? 'tab-button_active'
                          : 'tab-button_inactive'
                      }`}
                      onClick={(): void => openDropdownMenu(index)}
                      onBlur={(e): void => onBlur(e, index)}
                      key={'dropdown-button' + index}
                    >
                      <span className="dropdown-arrow" />
                    </button>
                    <div
                      className="dropdown-menu"
                      key={'dropdown-menu' + index}
                    >
                      <a
                        className="dropdown-item"
                        href="#"
                        onClick={(): Promise<void> =>
                          deleteTab(dataframe.label)
                        }
                      >
                        Delete table
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
            {activeTab === -1 ? (
              <p className="disclaimer">
                Data shape: {separateThousands(variables.length)} rows.
              </p>
            ) : (
              <p className="disclaimer">
                Data shape: {separateThousands(shape['rows'])} rows and{' '}
                {shape['columns']} columns. Preview: first {data.length} rows
                and {shape['displayedColumns']} columns.
              </p>
            )}
          </nav>
          <div className="tab-item">
            <div
              {...getTableProps()}
              className="div-table div-table-striped"
              role="table"
            >
              <div className="thead-dark sticky" role="thead">
                {headerGroups.map((headerGroup, rowIndex) => (
                  <div
                    {...headerGroup.getHeaderGroupProps()}
                    className="tr"
                    role="tr"
                  >
                    {isLastRow(rowIndex) && !isVariableTab(activeTab) && (
                      <div className="header-white-row" />
                    )}
                    {headerGroup.headers.map((column, index) => (
                      <div
                        {...column.getHeaderProps()}
                        className="th"
                        role="th"
                      >
                        <div
                          className={`th ${index === 0 &&
                            column.Header === 'index' &&
                            'index-column-header'}`}
                        >
                          {column.render('Header')}
                        </div>
                        <div
                          {...column.getResizerProps()}
                          className="delimiter-wrapper"
                        >
                          <div className="delimiter" />
                        </div>
                        {isLastRow(rowIndex) && (
                          <div>
                            {!isVariableTab(activeTab) && (
                              <div className="data-type-info">
                                {columnTypes[index] && columnTypes[index].type}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div {...getTableBodyProps()} className="tbody" role="tbody">
                {rows.map(row => {
                  prepareRow(row);
                  return (
                    <div {...row.getRowProps()} className="tr" role="tr">
                      {row.cells.map(cell => {
                        return (
                          <div
                            {...cell.getCellProps()}
                            title={getUSDString(cell.value)}
                            className="td"
                            role="td"
                          >
                            {cell.render('Cell')}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p>No data available</p>
      )}
    </div>
  );
};

// This allows to re-render the component whene there is a signal emitted (Read about signals here https://jupyterlab.readthedocs.io/en/stable/developer/patterns.html)
// This is the recommended approach from the Jupyter team: https://jupyterlab.readthedocs.io/en/stable/developer/virtualdom.html
// Inspired by this example: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx
// ...and this example: https://github.com/jupyterlab/jupyterlab/blob/f2e0cde0e7c960dc82fd9b010fcd3dbd9e9b43d0/packages/running/src/index.tsx#L157-L159
const UseSignalComponent = (props: {
  signal: ISignal<Backend, void>;
  logic: Backend;
}): JSX.Element => {
  return (
    <UseSignal signal={props.signal}>
      {(): JSX.Element => <DataVisualizerComponent logic={props.logic} />}
    </UseSignal>
  );
};

/**
 * A Counter Lumino Widget that wraps a CounterComponent.
 */
export class DataVisualizerWidget extends ReactWidget {
  /**
   * Constructs a new CounterWidget.
   */

  private readonly backend = null;

  constructor(backend: Backend) {
    super();
    this.addClass('jp-ReactWidget');
    this.backend = backend;
  }

  render(): JSX.Element {
    return (
      <UseSignalComponent signal={this.backend.signal} logic={this.backend} />
    );
  }
}
