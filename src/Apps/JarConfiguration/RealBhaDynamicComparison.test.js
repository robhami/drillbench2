import React from 'react';
import {render,screen,fireEvent} from '@testing-library/react';
import frozen from '../../../docs/ValidationStudies/OES8p5Stage6C2.fixture.v1.json';
import RealBhaDynamicComparison,{dynamicRanking} from './RealBhaDynamicComparison';
test('physical inputs start blank and hypothetical template never bypasses acknowledgement',()=>{
 const prepare=jest.fn();render(<RealBhaDynamicComparison bha={frozen.workingCopy} jarIndex={0} alternatives={[]} bitMdFt={9318} onPrepare={prepare}/>);
 expect(screen.getByLabelText('Effective hammer mass (kg)')).toHaveValue(null);
 fireEvent.click(screen.getByText('Fill explicitly hypothetical study assumptions'));
 expect(screen.getByLabelText('Effective hammer mass (kg)')).toHaveValue(100);
 fireEvent.click(screen.getByText('Calculate assumed-parameter dynamics'));
 expect(screen.getByRole('alert')).toHaveTextContent('Acknowledge');
 fireEvent.click(screen.getByText('Prepare current and ±30 ft Mode A alternatives'));expect(prepare).toHaveBeenCalledTimes(1);
});
test('rankings suppress invalid/indeterminate results and preserve numerical ties and signed convention',()=>{
 const rows=[{valid:true,movementFt:0,metrics:{peakTransmittedN:1000,fixedSignedNs:-10}},{valid:true,movementFt:30,metrics:{peakTransmittedN:1000.1,fixedSignedNs:-11}}];
 expect(dynamicRanking(rows,'peakTransmittedN')).toEqual([0,30]);
 expect(dynamicRanking(rows,'fixedSignedNs')).toEqual([30]);
 expect(dynamicRanking([...rows,{valid:false,movementFt:-30}],'peakTransmittedN')).toBeNull();
 expect(dynamicRanking(rows,'firstImpulseNs')).toBeNull();
});

test('Jar Up sweep exposes MD conversion, fixed-terminal assumptions and bounded Mode A controls',()=>{
 render(<RealBhaDynamicComparison bha={frozen.workingCopy} jarIndex={0} alternatives={[]} bitMdFt={9318}/>);
 fireEvent.change(screen.getByLabelText('Jar Up scenario'),{target:{value:'sweep'}});
 fireEvent.change(screen.getByLabelText('Fixed stuck point above bit (ft)'),{target:{value:'100'}});
 fireEvent.change(screen.getByLabelText('Stuck-point coordinate'),{target:{value:'md'}});
 expect(screen.getByLabelText('Fixed stuck-point MD (ft)')).toHaveValue(9218);
 fireEvent.click(screen.getByText('Use current ±30 ft sweep'));
 expect(screen.getByLabelText('Minimum jar centre above bit (ft)')).toHaveValue(610.83);
 expect(screen.getByLabelText('Maximum jar centre above bit (ft)')).toHaveValue(670.83);
 expect(screen.getByText(/all string below it is dynamically excluded/)).toBeInTheDocument();
 expect(screen.getByText(/Maximum 25 positions/)).toBeInTheDocument();
});
