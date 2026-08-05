const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const cors = require('cors');
// const c = require ('./public/script.js');

// console.log(c.saveObject);

app.use(cors());
app.use(bodyParser.json());
// app.use(express.static(__dirname + '/Public'))

// app.get('/request', function(req, res){
// 	console.log()
//     // run your request.js script
//     // when index.html makes the ajax call to www.yoursite.com/request, this runs
//     // you can also require your request.js as a module (above) and call on that:
//     res.send(datax.saveJSON); 
// });

const knex = require ('knex') 


const db  = knex({
  	client: 'pg',
  	connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'Elodie2005',
    database : 'bhadata'
  }
});

const dbTool =knex({
  	client: 'pg',
  	connection: {
    host : '127.0.0.1',
    user : 'postgres',
    password : 'Elodie2005',
    database : 'tooldata'
  }
});



// console.log("DBX", db.select('*').from('bhainput'));

let saveName = {"name" : "bhainput"};
let count=0;

//pulls data from database
app.get('/' ,(req, res)=>{
	console.log("loading ", saveName.name)
	db.select('*').from(saveName.name)
	.then(function(data) {
		res.send(data);
		// let saveData=res.send(data);
	})
	.catch (error=> {
		// res.status(500).json({error: err});
		console.error('Error:', error);
	})
	
	// res.send("hello");
	

});

//get list of table names
app.get('/tableName' ,(req, res)=>{
		
	db('pg_catalog.pg_tables')

	.select('tablename')
	.where({schemaname:'public'})
	
	.then(function(data) {
		res.send(data);
	});
});

//get list of tooltypes
app.get('/toolType' ,(req, res)=>{
	console.log(req.query.name)	
	let toolTable=req.query.name;
	dbTool
	// ('pg_catalog.pg_tables')

	.select('*').from(toolTable)
	
	
	.then(function(data) {
		res.send(data);
	});
});

app.get('/toolData' ,(req, res)=>{
	console.log(req.query.name)	
	let toolTable=req.query.name;
	dbTool('pg_catalog.pg_tables')

	.select('Tool').from(toolTable)
	
	
	.then(function(data) {
		res.send(data);
	});
});


//update variable saveName
app.put('/saveName', async (req, res)=>{
	
	saveName = await req.body
	res.send(saveName)
	console.log("This save name has been sent to server: ",saveName)
	
})

//add new data to existing table, need to make table name dynamic
app.put('/',(req,res)=>{
console.log("put adding data to existing table")	
	
	console.log("count: ",count);
	const newRows=req.body;
	console.log(newRows)
	console.log("below row added to table ",saveName.name,req.body);
	// console.log("req params",req.params);
	// console.log("above data added to this table: ",saveName.name);
	 db(saveName.name)
	 	
		.returning('*')
		.insert({
			// id: ,
			No: newRows.No,	
			Type: newRows.Type,
			Tool: newRows.Tool,
			OD: newRows.OD,
			ID: newRows.ID,
			Weight: newRows.Weight,
			Length: newRows.Length
		})
		
	.then(response => {
		res.json(response);
	})
	.catch((error) => {
	  		console.error('Error:', error);
	});
	count++;
})

//create new table, need function is script.js to send req.body.name
app.post('/',(req,res)=>{
	
	let newTable=req.body.name;
	console.log("creating new table: ", newTable);
	// res.send(newTable);
	db.schema.createTable(newTable, function(table) {
		table.increments('id');
	 	table.integer('No');
	 	table.string('Type')
	 	table.string('Tool');
	 	table.decimal('OD');
	 	table.decimal('ID');
	 	table.decimal('Weight');
	 	table.decimal('Length');
	 	// table.timestamps();
	 })

	.then(function(data) {
		res.json({success: true, message: 'ok'});
		// res.send(data);
		// let saveData=res.send(data);
	});

})

//deletes rows from database, also used when new saveFunction called
app.delete('/deleteRows',(req,res)=>{
console.log("deleting saveName: ", saveName.name);
	db(saveName.name)	 	
		 .del()
		.then(response => {
			res.json(response)
		})

	})

app.delete('/dropTable',(req,res)=>{
	console.log("dropping table: ", saveName.name);
// only deletes rows need to find a way to hide or fully delete table- done with del prefix

	db.schema.dropTable(saveName.name)

	// console.log("renaming table: ", saveName.name);
	// db.schema.renameTable('new save 6', 'deleted')
	// console.log("now called", saveName.name)

})

// to rename table with del prefix
app.get('/rename',(req,res) => {
	// const {name}=req.params('name');
	// res.send(req.query)
	console.log(req.query.name)
	// add del prefix and rename table
	let delName=('del_'+req.query.name)
	console.log(delName)
	db.schema.renameTable(req.query.name,delName)
	// console.log({name})
	// res.json(name)
	.then(response => {
			res.json(response)
		})
})

app.listen(3000, ()=>{
	console.log('app is running on port 3000');
});