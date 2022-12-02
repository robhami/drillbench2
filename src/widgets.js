import React from 'react';
import UnitCon from './Apps/UnitCon/UnitCon.js';
import BHAEntry from './Apps/BHAEntry/BHAEntry.js';
// import MyFirstGrid from '../components/BHADrag/MyFirstGrid.js';

export const widgets = [

	{
		id: 0,
		name: 'Units Converter',
		image: 'https://cdn.iconscout.com/icon/free/png-128/emi-calculator-1795294-1522560.png',
		value: 'Units Converter',
		app: <UnitCon/>
		
	},

	{
		id: 1,
		name: 'BHA entry',
		image: 'https://cdn.iconscout.com/icon/premium/png-128-thumb/oil-well-6-1049520.png',
		value: 'BHA entry',
		app: <BHAEntry/>

	},

	{
		id: 2,
		name: 'Parameter entry',
		image: 'https://cdn.iconscout.com/icon/premium/png-128-thumb/parameters-1980829-1672484.png',
		value: 'Parameter entry'
	},


	{
		id: 3,
		name: 'BHA Builder',
		image: 'https://cdn.iconscout.com/icon/premium/png-128-thumb/parameters-1980829-1672484.png',
		value: 'BHA Builder',
		// app: <MyFirstGrid/>
	},






]