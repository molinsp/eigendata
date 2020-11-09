import { ReactWidget, UseSignal} from '@jupyterlab/apputils';

import React, { useState, useEffect } from 'react';

import { ISignal } from '@lumino/signaling';

import { useTable } from 'react-table';

import { Backend } from './formulabar';

/**
 * React component for a counter.
 *
 * @returns The React component
 */
const DataVisualizerComponent = (props: {logic: Backend, columns: object[], data: object[], showTable: boolean}): JSX.Element => {
  console.log('------> Rendering Data Visualizer UI');

  const {columns, data, showTable} = props;
  const {
      getTableProps,
      getTableBodyProps,
      headerGroups,
      rows,
      prepareRow,
  } = useTable({columns, data});

  return (
    <div>
        {showTable ?
        <table {...getTableProps()} className="table table-striped table-hover">
            <thead className="thead-dark">
            {headerGroups.map(headerGroup => (
                <tr {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map(column => (
                        <th {...column.getHeaderProps() }>
                            {column.render('Header')}
                        </th>
                    ))}
                </tr>
            ))}
            </thead>
            <tbody {...getTableBodyProps()}>
            {rows.map(row => {
                prepareRow(row);
                return(
                    <tr {...row.getRowProps()}>
                        {row.cells.map(cell => {
                            return(
                                <td {...cell.getCellProps()}>
                                    {cell.render('Cell')}
                                </td>
                            )
                        })}
                    </tr>
                )
            })}
            </tbody>
        </table>
        : <p>No data available</p>
        }
    </div>
  );
}

// This allows to re-render the component whene there is a signal emitted (Read about signals here https://jupyterlab.readthedocs.io/en/stable/developer/patterns.html)
// This is the recommended approach from the Jupyter team: https://jupyterlab.readthedocs.io/en/stable/developer/virtualdom.html
// Inspired by this example: https://github.com/jupyterlab/jupyterlab/blob/master/docs/source/developer/virtualdom.usesignal.tsx
// ...and this example: https://github.com/jupyterlab/jupyterlab/blob/f2e0cde0e7c960dc82fd9b010fcd3dbd9e9b43d0/packages/running/src/index.tsx#L157-L159
function UseSignalComponent(props: { signal: ISignal<Backend, void>, logic: Backend}) {
    const [columns, setColumns] = useState([]);
    const [data, setData] = useState([]);
    const [showTable, setShowTable] = useState(false);

    useEffect(() => {
        const getDataForVisualization = async () => {
            try {
                const dfs = props.logic.dataframesLoaded;
                console.log("Dataframes", dfs);
                if (dfs.length !== 0) {
                    const result = await props.logic.pythonGetDataForVisualization(dfs[dfs.length-1].value);
                    setShowTable(true);
                    setColumns([...result['columns']]);
                    setData([...result['data']]);
                    console.log('Backend result', result);
                }
            } catch (e) {
                setShowTable(false);
            }
        };
        getDataForVisualization();
    }, [props.logic.dataframesLoaded]);

  return <UseSignal signal={props.signal}>{() =>
      <DataVisualizerComponent
          columns={columns}
          data={data}
          showTable={showTable}
          logic={props.logic}
      />}
  </UseSignal>;
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
    return <UseSignalComponent signal={this._backend.signal} logic={this._backend} />;
  }
}
