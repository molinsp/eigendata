import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { querySelectStyles } from '../styles/reactSelectStyles';

export const QuerybuilderCustomSelect = (props): JSX.Element => {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    // React select requires 'value' field for options
    const modifiedOptions = props.items.map(item => {
      return { value: item.key, label: item.label };
    });

    setOptions(modifiedOptions);
  }, []);

  return (
    <Select
      onChange={(selection: ISelection): void => {
        props.setField(selection.value);
      }}
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
