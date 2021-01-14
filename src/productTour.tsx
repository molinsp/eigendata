/*-----------------------------------
PRODUCT TOUR
-----------------------------------*/
import React from 'react';

const productTourSteps = [
  {
    content: (
      <div>
        <p>This is the magic formula bar, your gateway to data superpowers</p>
      </div>
    ),
    target: '.data-transformation-form',
    // Remove beacon with circle to enable autostart
    disableBeacon: true,
    placement: 'bottom-start' as 'bottom-start'
  },
  {
    content: 'On the left you select which dataset you want to transform',
    target: '#dataselect',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: (
      <div>
        <p>On the right you search for data transformations.</p>
        <p>We will start by loading a csv file.</p>
      </div>
    ),
    target: '#transformationselect',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: 'Here is where you enter the parameters, like the csv file name.',
    target: '#root_filepath_or_buffer',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: (
      <div>
        <p>
          To get the name of the csv files, you can use the file browser on the
          left.
        </p>
        <p>You can also hide it by clicking the browser icon</p>
      </div>
    ),
    target: '#filebrowser',
    // Remove beacon with circle to enable autostart
    disableBeacon: true,
    placement: 'left' as 'left'
  },
  {
    content:
      'After entering the file-name, press Submit to run your transformations.',
    target: '.btn-info',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: (
      <div>
        <p>The data will be displayed in the data visualizer.</p>
        <p>Enjoy your data.</p>
      </div>
    ),
    target: '.full-height-container',
    // Remove beacon with circle to enable autostart
    disableBeacon: true,
    placement: 'left' as 'left'
  }
];

export default productTourSteps;
