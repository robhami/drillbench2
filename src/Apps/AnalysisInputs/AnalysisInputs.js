import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import { wobAnalysisInputs, validateWobAnalysis } from '../../engineering/bha/wobAnalysisInputs';
import { inferTrajectoryMode, resolveActiveSurvey, surveyGeometry, trajectorySelectionPatch } from '../Survey/surveyAssociation';

const AnalysisInputs = ({ bha = {}, updateBha }) => {
  const selectedTrajectoryMode = bha.trajectoryMode;
  const surveyState = bha.surveyState;
  const trajectoryMode = React.useMemo(() => inferTrajectoryMode({ trajectoryMode: selectedTrajectoryMode, surveyState }), [selectedTrajectoryMode, surveyState]);
  const directionalSurveyValid = React.useMemo(() => {
    const source = resolveActiveSurvey({ trajectoryMode: 'directional', surveyState });
    return Boolean(surveyGeometry(source)?.valid);
  }, [surveyState]);
  const wobRange = wobAnalysisInputs(bha);
  const wobError = validateWobAnalysis(wobRange);
  const updateWobRange = (key, value) => updateBha?.({
    wobAnalysis: { ...bha.wobAnalysis, ...wobRange, [key]: value, source: 'user' }
  });
  return <Container fluid className="px-0">
    <Card className="analysisInputsCard">
      <Card.Body>
        <div className="parameterTrajectoryRow">
          <span className="parameterTrajectoryLabel">Well Trajectory:</span>
          <div className="parameterTrajectorySelector" role="group" aria-label="Well Trajectory">
            {['vertical', 'directional'].map(mode => <button key={mode} type="button" aria-pressed={trajectoryMode === mode}
              disabled={!updateBha} onClick={() => updateBha?.(trajectorySelectionPatch(mode))}>
              {mode === 'vertical' ? 'Vertical' : 'Directional'}
            </button>)}
          </div>
          {trajectoryMode === 'directional' && !directionalSurveyValid && <span className="parameterTrajectoryRequired" role="status">Survey required</span>}
        </div>
        <div className="analysisInputGrid parameterEntryGrid">
          <Form.Group controlId="analysisMudWeight">
            <Form.Label>Mud Weight (ppg)</Form.Label>
            <Form.Control type="number" min="0" step="any" value={bha.mudWeight ?? ''}
              onChange={event => updateBha?.({ mudWeight: event.target.value })} />
          </Form.Group>
          <Form.Group controlId="analysisLowWob">
            <Form.Label>Low WOB (klbf)</Form.Label>
            <Form.Control type="number" min="0" step="any" value={wobRange.minWobKlbf}
              onChange={event => updateWobRange('minWobKlbf', event.target.value)} />
          </Form.Group>
          <Form.Group controlId="analysisHighWob">
            <Form.Label>High WOB (klbf)</Form.Label>
            <Form.Control type="number" min="0" step="any" value={wobRange.maxWobKlbf}
              onChange={event => updateWobRange('maxWobKlbf', event.target.value)} />
          </Form.Group>
          <Form.Group controlId="analysisRpm">
            <Form.Label>RPM</Form.Label>
            <Form.Control type="number" min="0" step="1" value={bha.rpm ?? ''}
              onChange={event => updateBha?.({ rpm: event.target.value })} />
          </Form.Group>
          <Form.Group controlId="analysisRop">
            <Form.Label>ROP (ft/hr)</Form.Label>
            <Form.Control type="number" min="0" step="1" value={bha.rop ?? ''}
              onChange={event => updateBha?.({ rop: event.target.value })} />
          </Form.Group>
        </div>
        {wobError && <p className="parameterEntryError" role="alert">{wobError}</p>}
      </Card.Body>
    </Card>
  </Container>;
};

export default AnalysisInputs;
