import { ReactWidget, UseSignal } from '@jupyterlab/apputils';

import React, { useState, useEffect, useRef } from 'react';

import { ISignal } from '@lumino/signaling';

import { useTable } from 'react-table';

import { Backend } from './formulabar';

import amplitude from 'amplitude-js';
/**
 * React component for a counter.
 *
 * @returns The React component
 */
const DataVisualizerComponent = (props: { logic: Backend }): JSX.Element => {
  //console.log('------> Rendering Data Visualizer UI');
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [columnTypes, setColumnTypes] = useState([]);
  const [shape, setShape] = useState({});
  const [columnTypesTop, setColumnTypesTop] = useState(0);
  const darkHeadRef = useRef(null);

  useEffect(() => {
    if (darkHeadRef.current) {
      setColumnTypesTop(darkHeadRef.current.clientHeight - 2);
    }
  });

  const separateThousands = number => {
    let stringNumber = number + '';
    const rgx = /(\d+)(\d{3})/;
    while (rgx.test(stringNumber)) {
      stringNumber = stringNumber.replace(rgx, '$1' + '.' + '$2');
    }
    return stringNumber;
  };

  if (props.logic._resetStateDatavisualizerFlag === true) {
    console.log('RESETING DATA VISUALIZER STATE');
    setColumns([]);
    setData([]);
    setShowTable(false);
    setActiveTab(0);
    props.logic._resetStateDatavisualizerFlag = false;
  }

  useEffect(() => {
    const getDataForVisualization = async () => {
      try {
        const dfs = props.logic.dataframesLoaded;
        console.log('Dataframes', dfs);
        if (dfs[activeTab]) {
          const result = await props.logic.pythonGetDataForVisualization(
            dfs[activeTab].value
          );
          setShowTable(true);
          setColumns([...result['columns']]);
          setData([...result['data']]);
          setColumnTypes([...result['columnTypes']]);
          setShape({ ...result['shape'] });
          console.log('Backend result', result);
        }
      } catch (e) {
        setShowTable(false);
      }
    };
    getDataForVisualization();
  }, [props.logic.dataframesLoaded, activeTab]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow
  } = useTable({ columns, data });

  const cutString = (string, requiredLength) => {
    return string.length > requiredLength
      ? `${string.slice(0, requiredLength)}...`
      : string;
  };

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

  const onBlur = (e: any, index: number): void => {
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

  return (
    <div className="full-height-container">
      {showTable ? (
        <div className="full-height-container">
          <nav className="scroll-nav">
            <div className="dropdown-container">
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
                      onClick={() => {
                        setActiveTab(index);
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
                      }}
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
            <p className={'disclaimer'}>
              Data shape: {separateThousands(shape['rows'])} rows and{' '}
              {shape['columns']} columns. Preview: first {data.length} rows and{' '}
              {shape['displayedColumns']} columns.
            </p>
          </nav>
          <div className="tab-item">
            <table
              {...getTableProps()}
              className="table table-striped table-hover"
            >
              <thead className="thead-dark">
                {headerGroups.map(headerGroup => (
                  <tr ref={darkHeadRef} {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                      <th {...column.getHeaderProps()}>
                        {column.render('Header')}
                      </th>
                    ))}
                  </tr>
                ))}
                <tr role="row" className="data-type-info">
                  {columnTypes.map((columnType, index) => (
                    <td
                      role="cell"
                      key={index}
                      style={{
                        top: columnTypesTop
                      }}
                    >
                      {columnType.type}
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody {...getTableBodyProps()}>
                {rows.map(row => {
                  prepareRow(row);
                  return (
                    <tr {...row.getRowProps()}>
                      {row.cells.map(cell => {
                        return (
                          <td {...cell.getCellProps()}>
                            {cell.render('Cell')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
function UseSignalComponent(props: {
  signal: ISignal<Backend, void>;
  logic: Backend;
}) {
  return (
    <UseSignal signal={props.signal}>
      {() => <DataVisualizerComponent logic={props.logic} />}
    </UseSignal>
  );
}

/**
 * A Counter Lumino Widget that wraps a CounterComponent.
 */
export class DataVisualizerWidget extends ReactWidget {
  /**
   * Constructs a new CounterWidget.
   */

  private _backend = null;

  constructor(backend: Backend) {
    super();
    this.addClass('jp-ReactWidget');
    this._backend = backend;
  }

  render(): JSX.Element {
    return (
      <UseSignalComponent signal={this._backend.signal} logic={this._backend} />
    );
  }
}
