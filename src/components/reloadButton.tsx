import React from 'react';
import { reloadIcon } from '../assets/svgs';

export const ReloadButton = ({ onClick, title }: Props) => {
  return (
    <div className="reload-button__container">
      <button
        id="reload-button"
        onClick={() => {
          if (onClick) {
            onClick();
          }
        }}
      >
        {reloadIcon}
      </button>
      <label htmlFor="reload-button">{title}</label>
    </div>
  );
};

type Props = {
  onClick?(): void;
  title: string;
};
