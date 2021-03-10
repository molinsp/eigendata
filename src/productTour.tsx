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
    content: 'Here is where you enter the parameters, like the csv file name. We have already entered the name of a demo file for you.',
    target: '#root_filepath_or_buffer',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: (
      <div>
        <p>
          To see your files, you can use the file browser on the
          left.
        </p>
        <p>You can also hide it by clicking the browser icon on the top-left</p>
      </div>
    ),
    target: '#filebrowser',
    // Remove beacon with circle to enable autostart
    disableBeacon: true,
    placement: 'left' as 'left'
  },
  {
    content:
      'To execute a transformation, press Submit',
    target: '.btn-info',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: (
      <div>
        <p>The data will be displayed in the data visualizer.</p>
      </div>
    ),
    target: '.full-height-container',
    // Remove beacon with circle to enable autostart
    disableBeacon: true,
    placement: 'left' as 'left'
  },
  {
    content: (
      <div>
        <p>And the code will be written into the Jupyter Notebook</p>
        <p>Enjoy your data!</p>
      </div>
    ),
    target: 'li[data-type="document-title"][style="z-index: 0;"]',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  }
];

export default productTourSteps;
