import React, { Component } from 'react';

import CardList from './CardList';
import { createWidgets } from './widgets';
import './App.css';
import Navbar from './Navbar.js';
import Scroll from './Scroll.js';
import SearchDrop from './SearchDrop.js';


const createEmptyRow = () => ({
  rowId: `${Date.now()}-${Math.random()}`,
  category: '',
  selectedToolId: '',
  toolName: '',
  od: '',
  idSize: '',
  weight: '',
  length: ''
});



class App extends Component {
  state = {
    searchfield: [
      'BHA Data Entry',
      'Analysis Inputs',
      'BHA Summary',
      'Engineering Results'






    ],
    well: {
      name: '',
      field: '',
      operator: '',
      currentBha: {
        id: '',
        name: '',
        holeSize: '',
        mudWeight: '',
        wob: '',
        rows: [createEmptyRow()]
      },
      savedBhas: []
    }
  };

  componentDidMount() {
    const savedWell = localStorage.getItem('drillbenchWell');
    const savedSearchfield =
      localStorage.getItem('drillbenchOpenWidgets');

    const stateChanges = {};

    if (savedWell) {
      const parsedWell = JSON.parse(savedWell);

      stateChanges.well = {
        name: parsedWell.name || '',
        field: parsedWell.field || '',
        operator: parsedWell.operator || '',
        currentBha: {
          id: '',
          name: '',
          holeSize: '',
          mudWeight: '',
          wob: '',
          rows: [createEmptyRow()],
          ...parsedWell.currentBha
        },
        savedBhas: parsedWell.savedBhas || []
      };
    }

    if (savedSearchfield) {
      stateChanges.searchfield =
        JSON.parse(savedSearchfield);
    }

    this.setState(stateChanges);
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.well !== this.state.well) {
      localStorage.setItem(
        'drillbenchWell',
        JSON.stringify(this.state.well)
      );
    }

    if (prevState.searchfield !== this.state.searchfield) {
      localStorage.setItem(
        'drillbenchOpenWidgets',
        JSON.stringify(this.state.searchfield)
      );
    }
  }

  updateBha = (changes) => {
    this.setState((currentState) => ({
      well: {
        ...currentState.well,
        currentBha: {
          ...currentState.well.currentBha,
          ...changes
        }
      }
    }));
  };

  updateRow = (rowId, changes) => {
    this.setState((currentState) => ({
      well: {
        ...currentState.well,
        currentBha: {
          ...currentState.well.currentBha,
          rows: currentState.well.currentBha.rows.map((row) =>
            row.rowId === rowId
              ? { ...row, ...changes }
              : row
          )
        }
      }
    }));
  };

  addRow = () => {
    this.setState((currentState) => ({
      well: {
        ...currentState.well,
        currentBha: {
          ...currentState.well.currentBha,
          rows: [
            ...currentState.well.currentBha.rows,
            createEmptyRow()
          ]
        }
      }
    }));
  };

  removeRow = (rowId) => {
    this.setState((currentState) => {
      const rows = currentState.well.currentBha.rows;

      return {
        well: {
          ...currentState.well,
          currentBha: {
            ...currentState.well.currentBha,
            rows:
              rows.length === 1
                ? rows
                : rows.filter((row) => row.rowId !== rowId)
          }
        }
      };
    });
  };

  reorderRows = (activeId, overId) => {
    this.setState((currentState) => {
      const rows = currentState.well.currentBha.rows;

      const oldIndex = rows.findIndex(
        (row) => row.rowId === activeId
      );

      const newIndex = rows.findIndex(
        (row) => row.rowId === overId
      );

      if (oldIndex === -1 || newIndex === -1) {
        return null;
      }

      const reorderedRows = [...rows];
      const [movedRow] = reorderedRows.splice(oldIndex, 1);

      reorderedRows.splice(newIndex, 0, movedRow);

      return {
        well: {
          ...currentState.well,
          currentBha: {
            ...currentState.well.currentBha,
            rows: reorderedRows
          }
        }
      };
    });
  };

  saveBha = () => {
    this.setState((currentState) => {
      const currentBha = currentState.well.currentBha;

      const bhaId =
        currentBha.id || `${Date.now()}`;

      const bhaToSave = {
        ...currentBha,
        id: bhaId
      };

      const existingIndex =
        currentState.well.savedBhas.findIndex(
          (bha) => bha.id === bhaId
        );

      let savedBhas;

      if (existingIndex >= 0) {
        savedBhas = currentState.well.savedBhas.map(
          (bha) =>
            bha.id === bhaId
              ? bhaToSave
              : bha
        );
      } else {
        savedBhas = [
          ...currentState.well.savedBhas,
          bhaToSave
        ];
      }

      return {
        well: {
          ...currentState.well,
          currentBha: bhaToSave,
          savedBhas
        }
      };
    });
  };

  loadBha = (bhaId) => {
    this.setState((currentState) => {
      const bhaToLoad =
        currentState.well.savedBhas.find(
          (bha) => bha.id === bhaId
        );

      if (!bhaToLoad) {
        return null;
      }

      return {
        well: {
          ...currentState.well,
          currentBha: {
            ...bhaToLoad
          }
        }
      };
    });
  };

  deleteBha = (bhaId) => {
    this.setState((currentState) => ({
      well: {
        ...currentState.well,
        savedBhas:
          currentState.well.savedBhas.filter(
            (bha) => bha.id !== bhaId
          )
      }
    }));
  };

  newBha = () => {
    this.setState((currentState) => ({
      well: {
        ...currentState.well,
        currentBha: {
          id: '',
          name: '',
          holeSize: '',
          mudWeight: '',
          wob: '',
          rows: [createEmptyRow()]
        }
      }
    }));
  };

  duplicateBha = () => {
    this.setState((currentState) => {
      const currentBha = currentState.well.currentBha;

      const duplicate = {
        ...currentBha,
        id: `${Date.now()}`,
        name: `${currentBha.name || 'New BHA'} Copy`,
        rows: currentBha.rows.map((row) => ({
          ...row,
          rowId: `${Date.now()}-${Math.random()}`
        }))
      };

      return {
        well: {
          ...currentState.well,
          currentBha: duplicate,
          savedBhas: [
            ...currentState.well.savedBhas,
            duplicate
          ]
        }
      };
    });
  };
















  render() {
    const { well, searchfield } = this.state;
    const bha = well.currentBha;

    const widgets = createWidgets({
      bha,
      savedBhas: well.savedBhas,
      saveBha: this.saveBha,
      loadBha: this.loadBha,
      deleteBha: this.deleteBha,
      newBha: this.newBha,
      updateBha: this.updateBha,
      updateRow: this.updateRow,
      addRow: this.addRow,
      removeRow: this.removeRow,
      reorderRows: this.reorderRows
    });

    const filteredWidgets = widgets.filter((widget) =>
      searchfield.includes(widget.value)
    );

    return (
      <div>
        <Navbar
          currentBha={bha}
          savedBhas={well.savedBhas}
          saveBha={this.saveBha}
          loadBha={this.loadBha}
          newBha={this.newBha}
          duplicateBha={this.duplicateBha}
          deleteBha={this.deleteBha}
        />



        <SearchDrop
          widgets={widgets}
          onChange={this.onChange}
        />

        <Scroll>
          <CardList widgets={filteredWidgets} />
        </Scroll>
      </div>
    );
  }
}
export default App;