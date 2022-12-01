const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger')();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(pino);

app.get('/api/greeting', (req, res) => {
  const name = req.query.name || 'World';
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({ greeting: `Hello ${name}!` }));
});

app.listen(3001, () =>
  console.log('Express server is running on localhost:3001')
);



// const path = require("path")
// const express = require("express");
// const app = express(); // create express app
// 
// // app.get("/", (req, res) => {
// //   res.send("This is from express.js");
// // });
// 
// 
// app.use(express.static(path.join(__dirname, "..",  "build")));
// app.use(express.static("public"));
// 
// 
// app.use((req, res, next) => {
//   res.sendFile(path.join(__dirname, "..", "build", "index.html"));
// });
// 
// // app.get("/", (req, res) => {
// //   res.sendFile(path.join( __dirname, "..", "public", "index.html"));
// // });
// 
// // start express server on port 5000
// app.listen(5000, () => {
//   console.log("server started on port 5000");
// });