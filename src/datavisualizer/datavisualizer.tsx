import 'abortcontroller-polyfill';
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
import { binIcon } from '../assets/svgs';
import { PaginationPanel } from '../components/paginationPanel';
import { Option } from 'react-select/src/filters';
import { EmptyStateComponent } from '../components/noDataLoadedComponent';
import { ReloadButton } from '../components/reloadButton';

/**
 * React component for a counter.
 *
 * @returns The React component
 */

//A controller object that allows to abort requests as and when desired
const controller = new window.AbortController();
const signal = controller.signal;

const getOptions = (from: number, to: number, counter: number, label: string): Option[] => {
  const array = [];
  for (let i = from; i <= to; i += counter) {
    array.push({value: i, label: `${label} ${i}`})
  }
  return array
}

const defaultPanelState = {
  currentPageOptions: [],
  pageSizeOptions: getOptions(10, 40, 5, 'Show'),
  currentPageSelection: {value: 1, label: 'Page 1'},
  pageSizeSelection: {value: 25, label: 'Show 25'}
}

const DataVisualizerComponent = (props: { logic: Backend }): JSX.Element => {
  const [columns, setColumns] = useState([]);
  const [data, setData] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [columnTypes, setColumnTypes] = useState([]);
  const [shape, setShape] = useState({});
  const [columnSizes, setColumnSizes] = useState({});
  const [sortConfig, setSortConfig] = useState({sortBy: undefined, ascending: undefined})
  const [loading, setLoading] = useState(false);
  const [paginationPanelState, setPaginationPanelState] = useState({ ...defaultPanelState });

  const resetState = (): void => {
    console.log('RESETING DATA VISUALIZER STATE');
    setColumns([]);
    setData([]);
    setShowTable(false);
    setActiveTab(0);
    setPaginationPanelState({...defaultPanelState});
    setSortConfig({sortBy: undefined, ascending: undefined});
    setColumnSizes({});
    setColumnTypes([]);
    setShape({});
  }

    if (props.logic.resetStateDatavisualizerFlag === true) {
     resetState();
     props.logic.resetStateDatavisualizerFlag = false;
    }

  /*--------------------------------------------------------------------
    PAGINATION: Set the page number the user is seeing
    Triggered when:
      - shape['rows']: When the size of the data changes
      - props.logic.dataframeSelection: The user changes the dataframe
  ----------------------------------------------------------------------*/
  useEffect(() => {
    const pageSize = Math.ceil(shape['rows']/paginationPanelState.pageSizeSelection.value);
    setPaginationPanelState({
      ...defaultPanelState,
      currentPageOptions: getOptions(1, pageSize, 1, 'Page')
    });
  }, [shape['rows'], props.logic.dataframeSelection])

  /*--------------------------------------------------------------------
    VARIABLES TAB: Display variables
    Triggered when:
      - activeTab: Change the variables tab
      - props.logic.variablesLoaded: Change in variables loaded
  ----------------------------------------------------------------------*/
  useEffect(() => {
    const variables = props.logic.variablesLoaded;
    if (isVariableTab(activeTab)) {
      try{
        const keys = Object.keys(variables[0]);
        const columns = keys.map((key, index) => ({
          accessor: key,
          Header: key,
          Cell: (props): string => getUSDString(props.value),
          //if there are custom sizes for columns - apply them
          width: columnSizes['variables'] ? columnSizes['variables'][index]
            // else - use default 160 : 80 : 160 sizes for columns
            : (index === 0 || index === 2) ? 160 : 80
        }));
        setColumns([...columns]);
        setData([...variables]);
      } catch(e){
        props.logic.dataframeSelection = props.logic.dataframesLoaded[0].value;
        setActiveTab(0);
        console.log('Error switching to the variables tab');
      }

    }
  }, [activeTab, props.logic.variablesLoaded]);

  /*--------------------------------------------------------------------
    DATAFRAMES TABS: Display variables
    Triggered when:
      - activeTab: Change the variables tab
      - dataframesLoaded: User load new or delete dataframe
      - sortConfig: User select one of sort options
      - paginationPanelState: User interacts with pagination panel
  ----------------------------------------------------------------------*/
  useEffect(() => {
    const getDataForVisualization = async (): Promise<void> => {
      try {
        const dataframes = props.logic.dataframesLoaded;
        if (dataframes[activeTab]) {
          //start data loading (get dataframes from backend)
          setLoading(true);
          const result = await props.logic.pythonGetDataForVisualization(
            dataframes[activeTab].value,
            sortConfig.sortBy,
            sortConfig.ascending,
            paginationPanelState.currentPageSelection.value,
            paginationPanelState.pageSizeSelection.value
          );
          // Add missing methods and properties
          const columns = result['columns'].map((column, index) => {
            if (!columnSizes[dataframes[activeTab].value]) {
              if (index === 0) {
                column.width = 55;
              }
            } else {
              // eslint-disable-next-line prettier/prettier
              column.width = columnSizes[dataframes[activeTab].value][index] ?? 80
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
      } finally {
        //loading is finished (no matter success or not)
        setLoading(false);
      }
    };

    //wrap getDataForVisualization() function in cancelable Promise
    const getDataForVisualizationWrapper = (signal): Promise<void> => {
      return new Promise((resolve, reject) => {
        getDataForVisualization().then(() => resolve());
        //if abort() method was called we reject this Promise
        signal.addEventListener('abort', () => {
          reject('Promise aborted')
        });
      });
    }

    const cancelPromise = (): void => {
      controller.abort()
    }

    if (loading) {
      cancelPromise();
    //else let it (the last one) be resolved
    } else {
      getDataForVisualizationWrapper(signal).catch();
    }

  }, [
    activeTab,
    props.logic.dataframesLoaded,
    sortConfig,
    paginationPanelState.pageSizeSelection,
    paginationPanelState.currentPageSelection
  ]);

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

  const closeDropdownMenus = (menuName: string): void => {
    const dropdowns = document.querySelectorAll(menuName);
    const element = Array.from(dropdowns).find(element =>
      element.className.includes('show')
    );
    if (element) {
      element.className = element.className.replace(' show', '');
    }
  };

  const openDropdownMenu = (menuToOpen: string, menusToClose: string): void => {
    const dropdown = document.querySelector(menuToOpen);
    if (dropdown.className.indexOf('show') === -1) {
      dropdown.className += ' show';
    } else {
      closeDropdownMenus(menusToClose);
    }
  }

  const onBlur = (e, menusToClose): void => {
    const target = e.relatedTarget;
    if (!target || target?.className !== 'dropdown-item') {
      closeDropdownMenus(menusToClose);
    }
  };

  // Delte a dataframe
  const deleteTab = async (table: string, menusToClose: string): Promise<void> => {
    console.log('Delete tab');
    await props.logic.pythonRemoveData(table);
    closeDropdownMenus(menusToClose);
    
    // If more than one tabs go back to the previous tab
    if(props.logic.dataframesLoaded.length >= 1 && activeTab != 0){
      console.log('Go to previous tab');
      setActiveTab(activeTab-1);
    }

  };

  const deleteVariable = async (variable: string): Promise<void> => {
    await props.logic.pythonRemoveData(variable);
    if (props.logic.variablesLoaded.length === 0) {
      setActiveTab(0);
      props.logic.dataframeSelection = props.logic.dataframesLoaded[0].value;
    }
  }

  const isLastRow = (row: number): boolean => {
    return row === headerGroups.length - 1;
  };

  const isVariableTab = (tab: number): boolean => {
    return tab === -1;
  };

  const onTabClick = (index: number): void => {
    setActiveTab(index);
    setPaginationPanelState({...defaultPanelState});
    props.logic.dataframeSelection = props.logic.dataframesLoaded[index].value;
    if (props.logic.production && props.logic.shareProductData) {
      amplitude
        .getInstance()
        .logEvent('Datavisualizer: change tab', {
          index: index
        });
    }
    setSortConfig({sortBy: undefined, ascending: undefined});
  }

  const onMouseUpHandler = (): void => {
    const columnHeaders = document.querySelectorAll('div.th');
    const data = isVariableTab(activeTab)
      ? 'variables'
      : props.logic.dataframesLoaded[activeTab].value
    const getWidths = (): number[] => {
      const res = [];
      for (const node of columnHeaders) {
        res.push(node.clientWidth);
      }
      return res;
    }
    if (data) {
      setColumnSizes({
        ...columnSizes,
        [data]: getWidths()
      });
    }
  }

  const sortColumn = (sortBy: string, ascending: boolean, menusToClose: string): void => {
    setSortConfig({ sortBy, ascending });
    closeDropdownMenus(menusToClose);
  }

  const getSortArrow = (sorted: boolean | undefined): string => {
    switch (sorted) {
      case true: return '↑';
      case false: return '↓';
      default: return '';
    }
  }

  const goToThePage = (page: number): void => {
    setPaginationPanelState({
      ...paginationPanelState,
      currentPageSelection: paginationPanelState.currentPageOptions[page-1]
    })
  };

  return (
    <div className="full-height-container"> {showTable ?
        <div className="full-height-container">
          <nav className="scroll-nav">
            <div className="dropdown-container">
              {props.logic.variablesLoaded.length > 0 &&
              <button type="button"
                      className={`tab-button ${isVariableTab(activeTab) && 'tab-button_active'} variables-button`}
                       onClick={(): void => setActiveTab(-1)}
              >
                Variables
              </button>}
              {props.logic.dataframesLoaded.map((dataframe, index) => {
                return (
                  <div className="dropdown"
                       id={'dropdown-' + index}
                       key={'dropdown-' + index}
                  >
                    <button type="button"
                            className={`tab-button ellipsized ${
                              activeTab === index
                                ? 'tab-button_active'
                                : 'tab-button_inactive'
                            }`}
                            onClick={(): void => {onTabClick(index)}}
                            title={dataframe.label}
                    >
                      {cutString(dataframe.label, 20)}
                    </button>
                    <button type="button"
                            className={`dropdown-button dropdown-toggle ${
                              activeTab === index
                                ? 'tab-button_active'
                                : 'tab-button_inactive'
                            }`}
                            onClick={(): void => openDropdownMenu(`#dropdown-${index} .dropdown-menu`, '.dropdown-menu')}
                            onBlur={(e): void => onBlur(e, '.dropdown-menu')}
                            key={'dropdown-button' + index}
                    >
                      <span className="dropdown-arrow" />
                    </button>
                    <div className="dropdown-menu" key={'dropdown-menu' + index}>
                      <a className="dropdown-item"
                         href="#"
                         onClick={(): Promise<void> =>
                           deleteTab(dataframe.label, '.dropdown-menu')
                         }
                      >
                        Delete table
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
            {isVariableTab(activeTab)
              ? <p className="disclaimer">Shape: {separateThousands(props.logic.variablesLoaded.length)} rows.</p>
              : <p className="disclaimer">
                Data shape: {separateThousands(shape['rows'])} rows and{' '}
                {shape['columns']} columns. {shape['columns'] > shape['displayedColumns']
                ? 'Only '+ shape['displayedColumns'] + ' displayed.'
                : ''}
              </p>}
          </nav>
          <div className="tab-item">
            <div{...getTableProps()}
                className="div-table div-table-striped"
                role="table"
                onMouseUp={onMouseUpHandler}
            >
              <div className="thead-dark sticky" role="thead">
                {headerGroups.map((headerGroup, rowIndex) => (
                  <div {...headerGroup.getHeaderGroupProps()} className="tr" role="tr">
                    {isLastRow(rowIndex) && !isVariableTab(activeTab) &&
                    <div className="header-white-row" />}
                    {headerGroup.headers.map((column, index) => (
                      <div {...column.getHeaderProps()}
                           className="th"
                           role="th"
                           id={`dropdown-header-${column.Header}-${index}`}
                      >
                        <div className={`ellipsized header ${index === 0 && column.Header === 'index' ? 'index-column-header' : ''}`}
                             title={column.Header}
                        >
                          {column.render('Header')}
                          <p className={`sort-arrow ${column.Header === sortConfig.sortBy ? 'show' : ''}`}>{getSortArrow(sortConfig.ascending)}</p>
                          {column.Header !== 'index' && !isVariableTab(activeTab) &&
                          <button className="dropdown-header-button"
                                  onClick={(): void => openDropdownMenu(`#dropdown-header-${column.Header}-${index} .dropdown-header-menu`, '.dropdown-header-menu')}
                                  onBlur={(e): void => onBlur(e,  '.dropdown-header-menu')}
                          >
                            <div className="dropdown-arrow"/>
                          </button>}
                        </div>
                        <div {...column.getResizerProps()} className="delimiter-wrapper">
                          <div className="delimiter" />
                        </div>
                        {isLastRow(rowIndex) && (
                          <div> {!isVariableTab(activeTab) &&
                            <div className="data-type-info">
                              {columnTypes[index] && columnTypes[index].type}
                            </div>}
                          </div>
                        )}
                        <div className="dropdown-header-menu" key={'dropdown-menu' + index}>
                          <p className="sort-header">SORT</p>
                          <a className="dropdown-item"
                             href="#"
                             onClick={ (): void=> {sortColumn(column.Header, true, '.dropdown-header-menu');}}
                          >
                            Ascending ↑
                          </a>
                          <a className="dropdown-item"
                             href="#"
                             onClick={ (): void =>  sortColumn(column.Header, false, '.dropdown-header-menu')}
                          >
                            Descending ↓
                          </a>
                          <a className="dropdown-item"
                             href="#"
                             onClick={ (): void =>  sortColumn(undefined, undefined, '.dropdown-header-menu')}
                          >
                            Reset
                          </a>
                        </div>
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
                          <div {...cell.getCellProps()}
                               title={getUSDString(cell.value)}
                               className="td ellipsized"
                               role="td"
                          >
                            {cell.render('Cell')}
                          </div>
                        );
                      })}
                      <button
                        className="trash-bin-button"
                        onClick={async (): Promise<void> => await deleteVariable(row.cells[0].value)}
                      >
                        {isVariableTab(activeTab) && binIcon}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {(!isVariableTab(activeTab)) &&
            <div style={{display: 'flex'}}>
              <PaginationPanel
                pageSize={Math.ceil(shape['rows']/paginationPanelState.pageSizeSelection.value)}
                pageSizeSelectionConfig={{
                  options: paginationPanelState.pageSizeOptions,
                  selectedOption: paginationPanelState.pageSizeSelection,
                  onSelect: (value): void => {
                    const pageSize: number = Math.ceil(shape['rows']/value.value);
                    setPaginationPanelState({
                      ...paginationPanelState,
                      currentPageOptions: getOptions(1, pageSize, 1, 'Page'),
                      pageSizeSelection: value,
                      currentPageSelection: paginationPanelState.currentPageSelection.value > pageSize
                        ? { value: pageSize, label: 'Page ' + (pageSize) }
                        : paginationPanelState.currentPageSelection
                    });
                  }
                }}
                currentPageConfig={{
                  options: paginationPanelState.currentPageOptions,
                  selectedOption: paginationPanelState.currentPageSelection,
                  onSelect: (value): void => setPaginationPanelState({...paginationPanelState, currentPageSelection: value})
                }}
                onFirstClick={(): void => goToThePage(1)}
                onLastClick={(): void => goToThePage(Math.ceil(shape['rows']/paginationPanelState.pageSizeSelection.value))}
                onPrevClick={(): void => goToThePage(paginationPanelState.currentPageSelection.value - 1)}
                onNextClick={(): void => goToThePage(paginationPanelState.currentPageSelection.value + 1)}
              />
              <ReloadButton title="Reload" onClick={resetState}/>
            </div>
          }
        </div>
       : <EmptyStateComponent onReloadButtonClick={resetState}/>}
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
    this.addClass('jp-dataviz');
    this.backend = backend;
  }

  render(): JSX.Element {
    return (
      <UseSignalComponent signal={this.backend.signal} logic={this.backend} />
    );
  }
}
