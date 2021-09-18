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
        if(selection){
          props.setValue(selection.map(item => item.value));
        }
        // Handle the case wehre there is only one selection and it is cleared by the user
        else{
          props.setValue(null);
        }
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
