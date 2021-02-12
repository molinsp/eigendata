// [COMPONENT] Empty state component
//   -> Description: is shown if there are no dataframes loaded
//   -> Used in: Datavizualizer

import React from 'react';
import { noDataMagnifier } from '../assets/svgs';

export const EmptyStateComponent = ({ onLinkClick }: Props): JSX.Element => {
  return (
    <div className="empty-state__container">
      <p className="empty-state__title">No data loaded</p>
      <p className="empty-state__link">
        Use the Magic Formula Bar to load data
      </p>
      <div>{noDataMagnifier}</div>
    </div>
  );
};

type Props = {
  onLinkClick?(): void;
};
