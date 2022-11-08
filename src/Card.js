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
			        >
		        	<div className='bg-light-green dib br3 pa3 ma2 grow bw shadow-5'>	
		        			{/* <div className="handle">Drag from here</div> */}
							{/* <LockButton onChange={onSlide}/> */}
							
							<div> {app} </div>	
					</div>	
		        </Draggable>	
			</div>
		);
}

export default Card;