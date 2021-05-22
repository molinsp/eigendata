// [COMPONENT] React spinner
//   -> Description: Bar loader spinner
//   -> Used in: Formulabar

import BarLoader from 'react-spinners/BarLoader';
import React from 'react';

export const Spinner = React.memo(() => (
  <div className="spinner-wrapper">
    <BarLoader width={'100%'} color={'#2684FF'} />
  </div>
));
