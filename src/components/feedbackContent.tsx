import React from 'react';

export const FeedbackContent = (
  thumb: JSX.Element,
  text: string,
  textColor: string
): JSX.Element => {
  return (
    <div className="feedback__content">
      {thumb}
      <p
        className="full-width  feedback__buttons-text"
        style={{ color: textColor }}
      >
        {text}
      </p>
    </div>
  );
};
