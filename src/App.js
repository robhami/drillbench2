import React, {Component} from 'react';
import CardList from './CardList';
import {widgets} from './widgets';
import './App.css';
import Navbar from './Navbar.js'
import Scroll from './Scroll.js'
import SearchDrop from './SearchDrop.js';
import UnitCon from './Apps/UnitCon/UnitCon.js';

class App extends Component {
 
   state = {
    widgets: widgets,
    searchfield: []
  
  }

  onChange = (event) => { 
    console.log(event)
    console.log(event.length)
    let x
    let searchArray=[]
    for (x=0;x<(event.length);x++){
      searchArray.push(event[x].value)
      console.log(searchArray)
    }
    this.setState({searchfield: searchArray}) 
  }


  render(){
    const {widgets, searchfield} = this.state
    const filteredWidgets = widgets.filter(widget=>{
      return (    
        this.state.searchfield.includes(widget.value)
      )  
      console.log(filteredWidgets)   
    })
    
    return !widgets.length ?
      <h1>Loading</h1> :
    (
      <div>
        <Navbar/>         
        <SearchDrop 
        widgets={widgets} onChange={this.onChange}/>        
        <Scroll>        
          <CardList widgets={filteredWidgets}/> 
          {/* <MyFirstGrid/> */}
        </Scroll>
      </div>
    )       
  } 
}

export default App;
