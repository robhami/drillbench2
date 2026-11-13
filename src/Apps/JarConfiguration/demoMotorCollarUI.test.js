import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import JarPositionMatrix from './JarPositionMatrix';
import live from '../../../docs/ValidationStudies/NeutralPointNumericalLimitFix.request.json';
import { demoMotorCollarGeometry, DEMO_MOTOR_NOTICE } from './demoMotorCollar';

jest.mock('./ConfigurationPlot', () => props => <div data-testid="demo-plot" data-plot={JSON.stringify({ data: props.data, layout: props.layout })}>{props.layout.title?.text}</div>);
jest.mock('./createJarPositionMatrixWorker', () => ({ createJarPositionMatrixWorker: () => ({
  postMessage(request) { Promise.resolve().then(() => this.onmessage?.({ data: require('../../engineering/jar/jarPositionMatrix').calculatePositionMatrix(request) })); },
  terminate() {}
}) }));
const demoAt = bitMdFt => demoMotorCollarGeometry(live.bha, { bitMdFt });

test('retained motor research matrix labels its surrogate and leaves the loaded BHA unchanged', async () => {
  const before = JSON.stringify(live.bha), demo = demoAt(10000);
  expect(demo.valid).toBe(true);
  render(<JarPositionMatrix bha={live.bha} demo={demo} />);
  expect(screen.getByText(DEMO_MOTOR_NOTICE)).toBeInTheDocument();
  expect(screen.getByLabelText('Study mode')).toHaveValue('C');
  fireEvent.change(screen.getByLabelText('L1 samples'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('L2 samples'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  expect(await screen.findAllByTestId('demo-plot')).not.toHaveLength(0);
  expect(JSON.parse(screen.getAllByTestId('demo-plot')[0].getAttribute('data-plot')).layout.title.text).toBe(DEMO_MOTOR_NOTICE);
  expect(JSON.stringify(live.bha)).toBe(before);
});

test('retained motor research results clear when its deployment basis changes', async () => {
  const view = render(<JarPositionMatrix bha={live.bha} demo={demoAt(10000)} />);
  fireEvent.change(screen.getByLabelText('L1 samples'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('L2 samples'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run Analysis' }));
  await screen.findAllByTestId('demo-plot');
  view.rerender(<JarPositionMatrix bha={live.bha} demo={demoAt(9500)} />);
  expect(screen.queryByTestId('demo-plot')).not.toBeInTheDocument();
});
