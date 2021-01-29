// [COMPONENT] Custom select
//   -> Custom widget for query builder selects
//   -> Used in: Querybuilder

import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { querySelectStyles } from '../styles/reactSelectStyles';

export const QuerybuilderCustomSelect = (props): JSX.Element => {
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState<ISelection>();

  useEffect(() => {
    // React select requires 'value' field for options
    const modifiedOptions = props.items.map(item => {
      return { value: item.key, label: item.label };
    });
    if (props.operatorField) {
      const defaultOperator = {
        value: props.selectedKey,
        label: props.selectedLabel
      };
      setSelectedOption(defaultOperator);
    }
    console.log(props);
    setOptions(modifiedOptions);
  }, []);

  return (
    <Select
      value={selectedOption}
      onChange={(selection: ISelection): void => {
        props.setField(selection.value);
        setSelectedOption(selection);
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
