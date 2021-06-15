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
    content: (
      <div>
        <p>Here you search for data transformations.</p>
        <p>We will start by loading a csv file.</p>
      </div>
    ),
    target: '#transformationselect',
    // Remove beacon with circle to enable autostart
    disableBeacon: true
  },
  {
    content: (
      <div>
        <p> On the right you select which dataset you want to transform</p>
        <p> Right now there is no data loaded</p>
      </div>
    ),
    target: '#dataselect',
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
        <p>To see your files, you can use the file browser on the left.</p>
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
    target: '.lm-Widget .p-Widget .jp-dataviz',
    // Remove beacon with circle to enable autostart
    disableBeacon: true,
    placement: 'left' as 'left'
  }
];

export default productTourSteps;
