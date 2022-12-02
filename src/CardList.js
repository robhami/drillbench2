import React from 'react';
import Card from './Card';

//widgets is passed for Cardlist element in App

const CardList = ({widgets}) => {
	
	return (	
		<div>
		{
			widgets.map((user,i)=> {
				return (					
						<Card 
						key={i} 
						id={widgets[i].id} 
						name={widgets[i].name} 
						image={widgets[i].image}
						// app={widgets[i].app}
						/>
					
					
				);
			})	
		}
	    </div>
    );
}

export default CardList