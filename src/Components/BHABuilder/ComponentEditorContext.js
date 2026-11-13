import { createContext } from 'react';

// The active workspace owns editor window placement and lifetime.
const ComponentEditorContext = createContext(null);
export default ComponentEditorContext;
