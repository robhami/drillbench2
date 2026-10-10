import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';

const JarAnalysisInputs = ({ bha, updateBha, drillingMode = 'slide', setDrillingMode }) => {
  return (
    <Container fluid className="px-0">
      <Card className="analysisInputsCard">


        <Card.Body>
          <div className="analysisInputGrid">
            <Form.Group controlId="analysisBhaName" className="analysisNameField">
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

            <Form.Group controlId="analysisHoleSize">
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

            <Form.Group controlId="analysisMudWeight">
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

            <Form.Group controlId="analysisInclination">
              <Form.Label>Inclination (°)</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" max="90" step="0.1"
                  value={bha.inclination ?? 0}
                  onChange={(event) => updateBha({ inclination: event.target.value })} />
                <span>°</span>
              </div>
            </Form.Group>
            <Form.Group controlId="analysisFriction">
              <Form.Label>Friction coefficient</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" max="1" step="0.05"
                  value={bha.frictionCoefficient ?? 0.25}
                  onChange={(event) => updateBha({ frictionCoefficient: event.target.value })} />
                <span>μ</span>
              </div>
            </Form.Group>
            <Form.Group controlId="analysisRpm">
              <Form.Label>RPM</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" step="1"
                  value={bha.rpm ?? ''}
                  placeholder="120"
                  onChange={(event) => updateBha({ rpm: event.target.value })} />
                <span>rpm</span>
              </div>
            </Form.Group>
            <Form.Group controlId="analysisRop" className="analysisWideNumber">
              <Form.Label>ROP</Form.Label>
              <div className="bhaInputWithUnit">
                <Form.Control type="number" min="0" step="1"
                  value={bha.rop ?? ''}
                  placeholder="60"
                  onChange={(event) => updateBha({ rop: event.target.value })} />
                <span>ft/hr</span>
              </div>
            </Form.Group>
            <Form.Group controlId="analysisWob" className="analysisWideNumber">
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
            <Form.Group controlId="analysisDrillingMode">
              <Form.Label>Drilling Mode</Form.Label>
              <Form.Select value={drillingMode} disabled={!setDrillingMode}
                onChange={event => setDrillingMode(event.target.value)}>
                <option value="slide">Slide</option>
                <option value="rotate">Rotate</option>
                <option value="reference">Reference</option>
              </Form.Select>
            </Form.Group>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default JarAnalysisInputs;
