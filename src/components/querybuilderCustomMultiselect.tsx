// [COMPONENT] Custom select
//   -> Custom widget for query builder multi selects
//   -> Used in: Querybuilder

import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { querySelectStyles } from '../styles/reactSelectStyles';

export const QuerybuilderCustomMultiselect = (props): JSX.Element => {
  const [options, setOptions] = useState([]);
  useEffect(() => {
    // React select requires 'value' field for options
    const modifiedOptions = props.listValues.map(listValue => {
      return { label: listValue.title, value: listValue.value };
    });
    setOptions(modifiedOptions);
  }, []);
  return (
    <Select
      onChange={(selection: ISelection[]): void => {
        props.setValue(selection.map(item => item.value));
      }}
      isMulti
      options={options}
      menuPortalTarget={document.body}
      styles={querySelectStyles}
    />
  );
};

interface ISelection {
  value: string;
  label: string;
}
