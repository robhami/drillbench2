import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';

const JarAnalysisInputs = ({ bha, updateBha }) => {
  return (
    <Container>
      <Card className="analysisInputsCard">


        <Card.Body>
          <div className="analysisInputGrid">
            <Form.Group>
              <Form.Label>BHA Name</Form.Label>
              <Form.Control
                type="text"
                value={bha.name}
                placeholder='8½" Production BHA'
                onChange={(event) =>
                  updateBha({
                    name: event.target.value
                  })
                }
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Hole Size</Form.Label>

              <div className="bhaInputWithUnit">
                <Form.Control
                  type="text"
                  inputMode="decimal"
                  value={bha.holeSize}
                  placeholder="8.500"
                  onChange={(event) =>
                    updateBha({
                      holeSize: event.target.value
                    })
                  }
                />

                <span>in</span>
              </div>
            </Form.Group>

            <Form.Group>
              <Form.Label>Mud Weight</Form.Label>

              <div className="bhaInputWithUnit">
                <Form.Control
                  type="text"
                  inputMode="decimal"
                  value={bha.mudWeight}
                  placeholder="12.0"
                  onChange={(event) =>
                    updateBha({
                      mudWeight: event.target.value
                    })
                  }
                />

                <span>ppg</span>
              </div>
            </Form.Group>

            <Form.Group>
              <Form.Label>Inclination (°)</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" max="90" step="0.1"
                  value={bha.inclination ?? 0}
                  onChange={(event) => updateBha({ inclination: event.target.value })} />
                
              </div>
            </Form.Group>
            <Form.Group>
              <Form.Label>Friction coefficient (μ)</Form.Label>
              <Form.Control type="number" min="0" max="1" step="0.05"
                value={bha.frictionCoefficient ?? 0.25}
                onChange={(event) => updateBha({ frictionCoefficient: event.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>RPM</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" step="1"
                  value={bha.rpm ?? ''}
                  placeholder="120"
                  onChange={(event) => updateBha({ rpm: event.target.value })} />
                <span>rpm</span>
              </div>
            </Form.Group>
            <Form.Group>
              <Form.Label>ROP</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" step="1"
                  value={bha.rop ?? ''}
                  placeholder="60"
                  onChange={(event) => updateBha({ rop: event.target.value })} />
                <span>ft/hr</span>
              </div>
            </Form.Group>
            <Form.Group>
              <Form.Label>WOB</Form.Label>

              <div className="bhaInputWithUnit">
                <Form.Control
                  type="text"
                  inputMode="decimal"
                  value={bha.wob}
                  placeholder="35"
                  onChange={(event) =>
                    updateBha({
                      wob: event.target.value
                    })
                  }
                />

                <span>klbf</span>
              </div>
            </Form.Group>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default JarAnalysisInputs;