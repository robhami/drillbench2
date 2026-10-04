import { render, screen } from '@testing-library/react';
import App from './App';

test('renders WellBench application', () => {
  render(<App />);
  expect(screen.getByText('WellBench')).toBeInTheDocument();
});
