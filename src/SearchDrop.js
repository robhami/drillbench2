import React, {Component} from 'react'
import Select from 'react-select'

class SearchDrop extends Component {
 render() {
    const {widgets, onChange} = this.props
    // console.log(this.props)
       return (
            <div>
              <Selectlist2 widgets={widgets} onChange={onChange}/>
           </div>      
        )     
  }    
}

const Selectlist2 = (props) => {
  const onChange=props.onChange
  const ddvalues2=props.widgets.map((x) => (
       {       
        value: x.name,
        label: x.name,
        id: x.id
       } 

    ));
  // console.log(ddvalues2)
 
  return (
    <Select 
        id="testSelect"
        isMulti
        data-value=""
        options={ddvalues2} 
        onChange={onChange}
        />
    )
}




export default SearchDrop ; 