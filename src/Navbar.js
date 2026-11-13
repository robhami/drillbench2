import React from 'react';
import Navbar from 'react-bootstrap/Navbar';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { useDemoPresentation } from './Components/DemoPresentation';

const AppNavbar = ({

  currentBha,
  savedBhas = [],
  saveBha,
  saveBhaAs,
  renameBha,
  loadBha,
  newBha,
  deleteBha,
  duplicateBha,
  developerPanels = false,
  onDeveloperPanelsChange,
  onDemoPresentationChange
}) => {
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const demoPresentation = useDemoPresentation();


  return (
    <Navbar className="dbNavbar">
      <Container fluid className="dbNavbarInner">
        <div className="dbNavbarLeft">
          <Navbar.Brand className="dbBrand">
            <span className="dbTitle">Drill<span className="dbTitleFrame">Frame</span></span>
            <span className="dbSubtitle">
              DRILLING ANALYSIS SUITE
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

          <Button type="button" variant="link" className="dbActionButton"
            onClick={saveBhaAs} title="Save a separate copy with a new name">
            <i className="bi bi-save2" aria-hidden="true" />
            <span>Save As</span>
          </Button>

          <Button type="button" variant="link" className="dbActionButton"
            onClick={renameBha} title="Rename current BHA">
            <i className="bi bi-pencil-square" aria-hidden="true" />
            <span>Rename</span>
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
            aria-label="Saved BHA workspace"
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
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(open => !open)}
            title="Settings"
          >
            <i className="bi bi-gear" aria-hidden="true" />
          </Button>
          {settingsOpen && <div role="group" aria-label="Workspace settings"
            style={{ position: 'absolute', right: 12, top: '100%', zIndex: 10000, padding: '8px 12px', background: 'white', border: '1px solid #d8dee5', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {onDemoPresentationChange && <label style={{ display: 'block' }}><input type="checkbox" checked={demoPresentation}
              onChange={event => onDemoPresentationChange(event.target.checked)} /> Demo Presentation View</label>}
            <label><input type="checkbox" checked={developerPanels}
              onChange={event => onDeveloperPanelsChange?.(event.target.checked)} /> Show developer panels</label>
          </div>}
        </div>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
