import React from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

const AppNavbar = ({

  currentBha,
  savedBhas = [],
  saveBha,
  loadBha,
  newBha,
  deleteBha,
  duplicateBha
}) => {


  return (
    <Navbar className="dbNavbar">
      <Container fluid className="dbNavbarInner">
        <div className="dbNavbarLeft">
          <Button
            type="button"
            variant="link"
            className="dbIconButton dbMenuButton"
            aria-label="Open menu"
            title="Menu"
          >
            <i className="bi bi-list" aria-hidden="true" />
          </Button>

          <Navbar.Brand className="dbBrand">
            <span className="dbTitle">WellBench</span>
            <span className="dbSubtitle">
              Drilling Analysis System
            </span>
          </Navbar.Brand>
        </div>

        <div className="dbToolbar">
          <Button
            type="button"
            variant="link"
            className="dbActionButton"
            onClick={newBha}
            title="New BHA"
          >
            <i className="bi bi-file-earmark-plus" aria-hidden="true" />
            <span>New</span>
          </Button>

          <Button
            type="button"
            variant="link"
            className="dbActionButton"
            onClick={saveBha}
            title="Save BHA"
          >
            <i className="bi bi-floppy" aria-hidden="true" />
            <span>Save</span>
          </Button>

          <Button
            type="button"
            variant="link"
            className="dbActionButton"
            onClick={duplicateBha}
            title="Duplicate BHA"
          >
            <i className="bi bi-files" aria-hidden="true" />
            <span>Duplicate</span>
          </Button>

          <Button
            type="button"
            variant="link"
            className="dbActionButton"
            onClick={() => deleteBha(currentBha.id)}
            disabled={!currentBha?.id}
            title="Delete BHA"
          >
            <i className="bi bi-trash" aria-hidden="true" />
            <span>Delete</span>
          </Button>

          <Form.Select
            className="dbBhaSelect"
            value={currentBha?.id || ''}
            onChange={(event) => {
              if (event.target.value) {
                loadBha(event.target.value);
              }
            }}
          >
            <option value="">Current BHA...</option>

            {savedBhas.map((bha) => (
              <option key={bha.id} value={bha.id}>
                {bha.name || 'Unnamed BHA'}
              </option>
            ))}
          </Form.Select>

          <Button
            type="button"
            variant="link"
            className="dbIconButton"
            aria-label="Open settings"
            title="Settings"
          >
            <i className="bi bi-gear" aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;