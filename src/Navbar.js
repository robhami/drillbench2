import React from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';

const AppNavbar = () => {
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
            aria-label="Save project"
            title="Save"
          >
            <i className="bi bi-floppy" aria-hidden="true" />
            <span>Save</span>
          </Button>

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