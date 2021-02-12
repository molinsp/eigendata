// [COMPONENT] Empty state component
//   -> Description: is shown if there are no dataframes loaded
//   -> Used in: Datavizualizer

import React from 'react';
import { noDataMagnifier } from '../assets/svgs';

export const EmptyStateComponent = ({ onLinkClick }: Props): JSX.Element => {
  return (
    <div className="empty-state__container">
      <p className="empty-state__title">No data loaded</p>
      <a className="empty-state__link" onClick={(): void => onLinkClick()}>
        Click here to load data with the magic formula bar
      </a>
      <div>{noDataMagnifier}</div>
    </div>
  );
};

type Props = {
  onLinkClick?(): void;
};
