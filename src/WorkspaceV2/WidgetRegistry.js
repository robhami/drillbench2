import BHAEntry from '../Apps/BHAEntry/BHAEntry';
import AnalysisInputs from '../Apps/AnalysisInputs/AnalysisInputs';
import BHASummary from '../Apps/BHASummary/BHASummary';
import EngineeringResults from '../Apps/EngineeringResults/EngineeringResults';
import EngineeringStringCard from '../Apps/EngineeringString/EngineeringStringCard';
const WidgetRegistry = {
    bhaEntry: {
        title: 'BHA Data Entry',
        component: BHAEntry
    },

    analysisInputs: {
        title: 'Analysis Inputs',
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