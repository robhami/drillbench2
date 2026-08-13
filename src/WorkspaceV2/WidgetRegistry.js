import BHASummary from '../Apps/BHASummary/BHASummary';
import EngineeringResults from '../Apps/EngineeringResults/EngineeringResults';

const WidgetRegistry = {
    bhaSummary: {
        title: 'BHA Summary',
        component: BHASummary
    },

    engineeringResults: {
        title: 'Engineering Results',
        component: EngineeringResults
    }
};

export default WidgetRegistry;