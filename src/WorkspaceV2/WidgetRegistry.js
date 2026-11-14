import JarPlacement from '../Apps/JarPlacement/JarPlacement';
import JarConfiguration from '../Apps/JarConfiguration/JarConfiguration';
import BHAEntry from '../Apps/BHAEntry/BHAEntry';
import AnalysisInputs from '../Apps/AnalysisInputs/AnalysisInputs';
import BHASummary from '../Apps/BHASummary/BHASummary';
import EngineeringResults from '../Apps/EngineeringResults/EngineeringResults';
import EngineeringStringCard from '../Apps/EngineeringString/EngineeringStringCard';
import Survey from '../Apps/Survey/Survey';
import JarClearance from '../Apps/JarClearance/JarClearance';
import JarForces from '../Apps/JarForces/JarForces';
const WidgetRegistry = {
    jarForces: { title: 'Hookload Calculations', component: JarForces, brand: 'drillframe' },
    jarClearance: { title: 'Neutral Point Behaviour', component: JarClearance, brand: 'drillframe' },
    survey: { title: 'Survey', component: Survey, brand: 'drillframe' },
    jarConfiguration: { title: 'Jar Position Analysis', component: JarConfiguration, brand: 'jarframe' },
    jarPlacement: { title: 'Impact & Impulse', component: JarPlacement, brand: 'jarframe' },
    bhaEntry: {
        title: 'BHA Data Entry',
        component: BHAEntry,
        brand: 'drillframe'
    },

    analysisInputs: {
        title: 'Parameter Entry',
        component: AnalysisInputs,
        brand: 'drillframe'
    },

    bhaSummary: {
        title: 'BHA Summary',
        component: BHASummary,
        brand: 'drillframe'
    },

    engineeringResults: {
        title: 'Engineering Results',
        component: EngineeringResults,
        brand: 'drillframe'
    },
    engineeringString: {
        title: 'Engineering String',
        component: EngineeringStringCard,
        brand: 'drillframe'
    }










};

export default WidgetRegistry;
