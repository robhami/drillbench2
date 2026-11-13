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
    jarForces: { title: 'Hookload Calculations', component: JarForces },
    jarClearance: { title: 'Neutral Point Behaviour', component: JarClearance },
    survey: { title: 'Survey', component: Survey },
    jarConfiguration: { title: 'Jar Position Analysis', component: JarConfiguration },
    jarPlacement: { title: 'Impact & Impulse', component: JarPlacement },
    bhaEntry: {
        title: 'BHA Data Entry',
        component: BHAEntry
    },

    analysisInputs: {
        title: 'Parameter Entry',
        component: AnalysisInputs
    },

    bhaSummary: {
        title: 'BHA Summary',
        component: BHASummary
    },

    engineeringResults: {
        title: 'Engineering Results',
        component: EngineeringResults
    },
    engineeringString: {
        title: 'Engineering String',
        component: EngineeringStringCard
    }










};

export default WidgetRegistry;
