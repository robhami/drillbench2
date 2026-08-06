import React from 'react';
import { useState } from 'react';
import Draggable from 'react-draggable';
import Button from 'react-bootstrap/Button';
// import LockButton from '../components/LockButton.js';


//passed from CardList

const Card= ({ name, id, image, app } ) => {

// hook that allows state to be used in function components, checked is variable and setChecked is function that updates it 	
	const [checked, setChecked] = useState(true)
	
	const onSlide = (event) => {		
		setChecked(!checked)
		console.log(checked)
	}

	return (
        	<div>
  <Draggable
    disabled={!checked}
    handle=".cardDragHandle"
    cancel="input, textarea, select, button, option"
  >
    <div className="bg-light-green dib br3 pa3 ma2 grow bw shadow-5">
      <div className="cardHeader">
        <span className="cardDragHandle">☰</span>
      </div>

      <div>{app}</div>
    </div>
  </Draggable>
</div>
		);
}

export default Card;